import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

type EventRecord = { id: string; recipient_id: string; claim_id?: string; found_ad_id?: string; event_type?: string };
type Payload = { type: string; table: string; schema?: string; record?: EventRecord };
const SITE = (Deno.env.get("SITE_URL") || "https://objeo.online").replace(/\/$/, "");
const htmlEscape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]!);
const allowed = new Set(["objeo_claim_notifications", "objeo_match_notifications", "objeo_saved_object_matches"]);
export default {
 fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status:405 });
  const db = ctx.supabaseAdmin;
  let notification: EventRecord | undefined;
  let table = "";
  let reserved = false;
  try {
   const p = await req.json() as Payload;
   table = p.table;
   if (p.type !== "INSERT" || !allowed.has(table) || !p.record) return Response.json({ ignored:true });
   notification = p.record;
   if (!notification.id || !notification.recipient_id) return Response.json({error:"Invalid notification"}, {status:400});
   // Verify webhook data against the real DB row; never trust arbitrary email addresses from payload.
   const {data: real, error: readError} = await db.from(table).select("*").eq("id",notification.id).maybeSingle();
   if (readError || !real || real.recipient_id !== notification.recipient_id) throw Error("Notification not found or invalid");
   if (table === "objeo_claim_notifications" && !["new_claim","accepted","rejected"].includes(real.event_type)) throw Error("Unknown claim event");
   let subject = "", heading = "", body = "";
   if (table === "objeo_claim_notifications") {
    const {data: claim} = await db.from("objeo_claims").select("ad_id").eq("id",real.claim_id).maybeSingle();
    const {data: ad} = claim?.ad_id ? await db.from("ads").select("title").eq("id",claim.ad_id).maybeSingle() : {data:null};
    const title = htmlEscape(String(ad?.title || "votre objet"));
    if (real.event_type === "new_claim") {
     subject="Objeo : nouvelle demande de restitution";
     heading="Vous avez reçu une demande de restitution";
     body="Une personne indique être propriétaire de « "+title+" ». Connectez-vous pour consulter sa justification et lui répondre.";
    } else if (real.event_type === "accepted") {
     subject="Objeo : votre demande a été acceptée";
     heading="Votre revendication a été acceptée";
     body="Bonne nouvelle ! Le détenteur a accepté votre demande concernant « "+title+" ». Consultez Objeo pour la suite.";
    } else {
     subject="Objeo : réponse à votre revendication";
     heading="Votre demande de restitution a été refusée";
     body="Le détenteur n'a pas accepté votre revendication concernant « "+title+" ». Vous pouvez consulter son statut sur Objeo.";
    }
   } else if (table === "objeo_saved_object_matches") {
    const {data: ad} = await db.from("ads").select("title").eq("id",real.found_ad_id).maybeSingle();
    subject="Objeo : votre objet enregistré a peut-être été retrouvé";
    heading="Une annonce pourrait correspondre à un objet de votre inventaire";
    body="Une annonce d’objet trouvé"+(ad?.title ? " (« "+htmlEscape(String(ad.title))+" »)" : "")+" ressemble à l’un de vos objets enregistrés. Vérifiez les informations sur Objeo avant toute démarche. Cette alerte ne prouve pas que l’objet vous appartient.";
   } else {
    const {data: ad} = await db.from("ads").select("title").eq("id",real.found_ad_id).maybeSingle();
    subject="Objeo : une correspondance possible !";
    heading="Un objet trouvé pourrait être le vôtre";
    body="Une nouvelle annonce"+(ad?.title ? " (« "+htmlEscape(String(ad.title))+" »)" : "")+" pourrait correspondre à votre objet perdu. Vérifiez les détails avant de contacter le détenteur.";
   }
   const {data: existing} = await db.from("objeo_email_alert_log").select("status").eq("source_table",table).eq("notification_id",real.id).maybeSingle();
   if (existing) return Response.json({ignored:true,reason:"already_processed"});
   const {data: reservation,error: reserveError} = await db.from("objeo_email_alert_log").upsert(
    {source_table:table,notification_id:real.id,recipient_id:real.recipient_id,status:"processing"},
    {onConflict:"source_table,notification_id",ignoreDuplicates:true}
   ).select("notification_id").maybeSingle();
   if (reserveError) throw Error("Anti-duplicate: "+reserveError.message);
   if (!reservation) return Response.json({ignored:true,reason:"duplicate"});
   reserved=true;
   const {data: userData,error:userError} = await db.auth.admin.getUserById(real.recipient_id);
   if (userError || !userData.user?.email) throw Error("Recipient email unavailable");
   const key=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("RESEND_FROM");
   if (!key || !from) throw Error("Missing Resend secrets");
   const html='<div style="max-width:560px;margin:auto;font-family:Arial,sans-serif;color:#243041"><h1 style="color:#ed711f">Objeo</h1><h2>'+heading+'</h2><p style="line-height:1.7">'+body+'</p><p><a href="'+htmlEscape(SITE)+'" style="display:inline-block;padding:13px 20px;border-radius:9px;background:#ed711f;color:white;text-decoration:none">Voir mon compte Objeo</a></p><p style="color:#6b7280;font-size:12px">Vous recevez cet e-mail à la suite d’une activité sur votre compte Objeo.</p></div>';
   const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[userData.user.email],subject,html})});
   if (!response.ok) throw Error("Resend: "+(await response.text()).slice(0,400));
   const {error: doneError}=await db.from("objeo_email_alert_log").update({status:"sent",sent_at:new Date().toISOString()}).eq("source_table",table).eq("notification_id",real.id);
   if(doneError) console.error("Email sent but log update failed:",doneError);
   return Response.json({success:true,notification_id:real.id});
  } catch(e) {
   console.error("Objeo alert email:",e);
   if(reserved && notification?.id && allowed.has(table)) {
    // Retry after a confirmed failure. Resend may have accepted a message even if response failed;
    // in that rare case, retry can generate a duplicate.
    await db.from("objeo_email_alert_log").delete().eq("source_table",table).eq("notification_id",notification.id).eq("status","processing");
   }
   return Response.json({error:"Notification email failed"},{status:500});
  }
 })
};
