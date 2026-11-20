# Objeo private image similarity worker
# Runs server-side with a service-role key; never expose this key to browser code.
import io, os, logging
from datetime import datetime, timezone
import numpy as np
import requests
from PIL import Image, ImageOps
from supabase import create_client
import torch
from transformers import CLIPModel, CLIPProcessor

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
URL=os.environ["SUPABASE_URL"]
KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
MODEL=os.environ.get("OBJEO_CLIP_MODEL","openai/clip-vit-base-patch32")
LIMIT=min(int(os.environ.get("OBJEO_IMAGE_LIMIT","30")),100)
db=create_client(URL,KEY)
model=CLIPModel.from_pretrained(MODEL).eval()
processor=CLIPProcessor.from_pretrained(MODEL)
session=requests.Session()
def embed(bucket,path):
    if not path: return None
    signed=db.storage.from_(bucket).create_signed_url(path,120)
    url=signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url")
    if not url: return None
    response=session.get(url,timeout=20);response.raise_for_status()
    if len(response.content)>6_000_000: return None
    im=ImageOps.exif_transpose(Image.open(io.BytesIO(response.content))).convert("RGB")
    inputs=processor(images=im,return_tensors="pt")
    with torch.no_grad(): vector=model.get_image_features(**inputs)
    if not isinstance(vector,torch.Tensor): vector=vector.pooler_output
    vec=vector[0].detach().cpu().numpy().astype(np.float32)
    return vec/(np.linalg.norm(vec)+1e-8)
def run():
    # Limit work to existing text candidates, so private inventory is not scanned indiscriminately.
    rows=db.table("objeo_saved_object_matches").select("id,owner_id,saved_object_id,found_ad_id,match_score,match_reasons,visual_checked_at").is_("visual_checked_at","null").order("created_at").limit(LIMIT).execute().data or []
    saved_cache={};ad_cache={};vectors={}
    for row in rows:
        try:
            sid=row["saved_object_id"];aid=row["found_ad_id"]
            if sid not in saved_cache:
                data=db.table("objeo_saved_objects").select("id,owner_id,photo_path").eq("id",sid).maybe_single().execute().data
                saved_cache[sid]=data
            if aid not in ad_cache:
                ad_cache[aid]=db.table("ads").select("id,user_id,photo_path,status,kind").eq("id",aid).maybe_single().execute().data
            saved=saved_cache[sid];ad=ad_cache[aid]
            if not saved or not ad or saved["owner_id"]!=row["owner_id"] or ad["kind"]!="found" or ad["status"]!="open" or saved["owner_id"]==ad["user_id"]:
                db.table("objeo_saved_object_matches").update({"visual_checked_at":datetime.now(timezone.utc).isoformat()}).eq("id",row["id"]).execute()
                continue
            if not saved.get("photo_path") or not ad.get("photo_path"):
                db.table("objeo_saved_object_matches").update({"visual_checked_at":datetime.now(timezone.utc).isoformat()}).eq("id",row["id"]).execute()
                continue
            akey=("objeo-private-objects",saved["photo_path"]);bkey=("ad-photos",ad["photo_path"])
            if akey not in vectors: vectors[akey]=embed(*akey)
            if bkey not in vectors: vectors[bkey]=embed(*bkey)
            va,vb=vectors[akey],vectors[bkey]
            if va is None or vb is None: continue
            similarity=float(np.dot(va,vb))
            # A heuristic score, NOT a calibrated ownership probability.
            visual_score=round(max(0,min(100,(similarity-0.15)/0.65*100)))
            text_score=int(row.get("match_score") or 0)
            combined=round(text_score*.65+visual_score*.35)
            reasons=["Comparaison visuelle indicative"] if visual_score>=65 else ["Photos peu similaires"]
            db.table("objeo_saved_object_matches").update({
                "visual_score":visual_score,"match_score":combined,
                "match_reasons":(row.get("match_reasons") or [])+reasons,
                "visual_checked_at":datetime.now(timezone.utc).isoformat()
            }).eq("id",row["id"]).execute()
            logging.info("Scored match %s",row["id"])
        except Exception:
            logging.exception("Could not score match %s",row.get("id"))
if __name__=="__main__":run()
