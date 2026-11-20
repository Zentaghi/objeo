"""Geocode municipality centroids for Objeo; service-role only, no precise GPS."""
import os,requests,logging,time,unicodedata
from supabase import create_client
logging.basicConfig(level=logging.INFO,format="%(levelname)s %(message)s")
db=create_client(os.environ["SUPABASE_URL"],os.environ["SUPABASE_SERVICE_ROLE_KEY"])
session=requests.Session()
cache={}
def norm(v):
 return ''.join(c for c in unicodedata.normalize('NFD',v.casefold().strip()) if unicodedata.category(c)!='Mn')
def place(name):
 if not name:return None
 if name in cache:return cache[name]
 try:
  postcode=name.strip().isdigit() and len(name.strip())==5
  params={"codePostal" if postcode else "nom":name,"fields":"nom,centre","boost":"population","limit":10}
  response=session.get("https://geo.api.gouv.fr/communes",params=params,timeout=12);response.raise_for_status()
  matches=response.json()
  result=next((c for c in matches if c.get("centre") and (postcode or norm(c["nom"])==norm(name))),None)
  coords=result["centre"]["coordinates"] if result else None
  value={"city_lat":coords[1],"city_lon":coords[0]} if coords else None
  cache[name]=value
  return value
 except Exception:
  logging.exception("Geocoding failed for a municipality")
  return None
def main():
 for table in ("objeo_saved_objects","ads"):
  query=db.table(table).select("id,city,city_lat,city_lon").is_("city_lat","null").limit(300)
  if table=="ads":query=query.eq("kind","found").eq("status","open")
  rows=query.execute().data or []
  updated=0
  for row in rows:
   value=place(row.get("city"))
   if value:
    db.table(table).update(value).eq("id",row["id"]).execute()
    updated+=1
   time.sleep(0.08)
  logging.info("%s: geocoded %s of %s rows",table,updated,len(rows))
def nearby_candidates():
 import math
 saved=db.table("objeo_saved_objects").select("id,owner_id,city,category,photo_path,city_lat,city_lon,search_radius_km").not_.is_("city_lat","null").limit(300).execute().data or []
 ads=db.table("ads").select("id,user_id,kind,status,category,photo_path,city_lat,city_lon").eq("kind","found").eq("status","open").not_.is_("city_lat","null").limit(300).execute().data or []
 existing=db.table("objeo_saved_object_matches").select("saved_object_id,found_ad_id").limit(1000).execute().data or []
 seen={(x["saved_object_id"],x["found_ad_id"]) for x in existing}
 count=0
 for s in saved:
  for a in ads:
   key=(s["id"],a["id"])
   if key in seen or s["owner_id"]==a["user_id"] or not s.get("photo_path") or not a.get("photo_path"):continue
   sc=(s.get("category") or "").casefold().strip();ac=(a.get("category") or "").casefold().strip()
   if not sc or not ac or not (sc==ac or sc.startswith(ac+" et ") or ac.startswith(sc+" et ")):continue
   la1,lo1,la2,lo2=map(math.radians,[s["city_lat"],s["city_lon"],a["city_lat"],a["city_lon"]])
   h=math.sin((la2-la1)/2)**2+math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
   km=6371.0088*2*math.asin(min(1,math.sqrt(h)))
   if km>int(s.get("search_radius_km") or 25):continue
   row={"owner_id":s["owner_id"],"saved_object_id":s["id"],"found_ad_id":a["id"],"match_score":45,"match_reasons":["Villes proches","Catégories compatibles","Photos à comparer (résultat provisoire)"],"distance_km":round(km,1)}
   db.table("objeo_saved_object_matches").upsert(row,on_conflict="saved_object_id,found_ad_id",ignore_duplicates=True).execute()
   seen.add(key);count+=1
 logging.info("Geographic photo candidates added: %s",count)
if __name__=="__main__":
 main()
 nearby_candidates()
