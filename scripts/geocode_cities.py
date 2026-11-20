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
if __name__=="__main__":main()
