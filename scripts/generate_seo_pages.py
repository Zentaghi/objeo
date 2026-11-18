#!/usr/bin/env python3
"""Build public, crawlable Objeo ad pages from the public Supabase ads API."""
import html
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "annonces"
SITEMAP = ROOT / "sitemap.xml"
BASE = "https://objeo.online"
API = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
FIELDS = "id,kind,title,category,description,city,happened_on,created_at"
LIMIT = 500
MAX_PAGES = 100
XMLNS = "http://www.sitemaps.org/schemas/sitemap/0.9"
ET.register_namespace("", XMLNS)


def esc(value):
    return html.escape(str(value or ""), quote=True)


def fetch_ads():
    if not API or not KEY:
        raise RuntimeError("Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in GitHub Actions secrets.")
    items = []
    for page in range(MAX_PAGES):
        query = urllib.parse.urlencode({
            "select": FIELDS,
            "status": "eq.open",
            "order": "created_at.desc",
            "limit": str(LIMIT),
            "offset": str(page * LIMIT),
        })
        request = urllib.request.Request(
            API + "/rest/v1/ads?" + query,
            headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=35) as response:
            chunk = json.load(response)
        if not isinstance(chunk, list):
            raise RuntimeError("Unexpected Supabase response")
        items.extend(chunk)
        if len(chunk) < LIMIT:
            break
    else:
        raise RuntimeError("Pagination limit reached: refusing to publish incomplete sitemap")
    return items


def valid(ad):
    try:
        uuid.UUID(str(ad["id"]))
        return bool(ad.get("title") and ad.get("city") and ad.get("kind") in ("lost", "found"))
    except (ValueError, KeyError, TypeError):
        return False


def page_html(ad):
    ident = str(uuid.UUID(str(ad["id"])))
    url = BASE + "/annonces/" + ident + ".html"
    city = str(ad["city"])
    title = str(ad["title"])
    kind = "perdu" if ad["kind"] == "lost" else "trouvé"
    heading = title + " — objet " + kind + " à " + city
    description = ("Objet " + kind + " à " + city + " : " + title + ". Consultez cette annonce sur Objeo.")[:155]
    body = str(ad.get("description") or "Aucune description supplémentaire.")
    category = str(ad.get("category") or "Autre")
    date = str(ad.get("happened_on") or "")[:10]
    city_link = "/?ville=" + urllib.parse.quote(city) + "#annonces"
    structured = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": heading,
        "url": url,
        "description": description,
        "inLanguage": "fr-FR",
        "datePublished": str(ad.get("created_at") or "")[:10],
        "isPartOf": {"@type": "WebSite", "name": "Objeo", "url": BASE + "/"},
    }
    ld = json.dumps(structured, ensure_ascii=False).replace("<", "\\u003c")
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(heading)} | Objeo</title>
<meta name="description" content="{esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="{esc(url)}">
<meta property="og:type" content="article"><meta property="og:title" content="{esc(heading)}">
<meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{esc(url)}">
<script type="application/ld+json">{ld}</script>
<style>body{{margin:0;background:#fff;color:#26313b;font:16px system-ui,sans-serif}}header,main,footer{{max-width:860px;margin:auto;padding:22px}}header{{border-bottom:1px solid #eee}}a{{color:#cf5b12}}h1{{font-size:clamp(28px,5vw,42px)}}.box{{border:1px solid #e9e9e9;border-radius:12px;padding:22px;margin:20px 0}}.cta{{display:inline-block;padding:12px 18px;background:#ff6e14;color:#fff;border-radius:9px;text-decoration:none}}.muted{{color:#65717b}}.desc{{white-space:pre-wrap;overflow-wrap:anywhere}}</style>
</head><body><header><a href="/">Objeo — Accueil</a></header><main>
<p class="muted">Annonce d'objet {kind} · {esc(city)}</p>
<h1>{esc(title)}</h1>
<div class="box"><p><strong>Statut :</strong> Objet {kind}</p><p><strong>Ville :</strong> {esc(city)}</p>
<p><strong>Catégorie :</strong> {esc(category)}</p>
{('<p><strong>Date :</strong> ' + esc(date) + '</p>') if date else ''}
<h2>Description</h2><p class="desc">{esc(body)}</p></div>
<p><a class="cta" href="/?annonce={ident}">Consulter l'annonce et contacter l'auteur</a></p>
<p><a href="{esc(city_link)}">Voir d'autres annonces à {esc(city)}</a></p>
</main><footer class="muted">Objeo — objets perdus et trouvés en France</footer></body></html>
"""


def write_if_changed(path, content):
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def build_sitemap(ads):
    # Preserve existing static URLs; remove only previously generated ad URLs.
    tree = ET.parse(SITEMAP)
    root = tree.getroot()
    for child in list(root):
        loc = child.find(f"{{{XMLNS}}}loc")
        if loc is not None and loc.text and loc.text.startswith(BASE + "/annonces/"):
            root.remove(child)
    for ad in ads:
        ident = str(uuid.UUID(str(ad["id"])))
        node = ET.SubElement(root, f"{{{XMLNS}}}url")
        ET.SubElement(node, f"{{{XMLNS}}}loc").text = BASE + "/annonces/" + ident + ".html"
        modified = str(ad.get("created_at") or "")[:10]
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", modified):
            ET.SubElement(node, f"{{{XMLNS}}}lastmod").text = modified
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode") + "\n"
    write_if_changed(SITEMAP, xml)


def main():
    ads = fetch_ads()  # On error, do not remove existing pages.
    ads = [ad for ad in ads if valid(ad)]
    OUTPUT.mkdir(parents=True, exist_ok=True)
    expected = set()
    for ad in ads:
        ident = str(uuid.UUID(str(ad["id"])))
        name = ident + ".html"
        expected.add(name)
        write_if_changed(OUTPUT / name, page_html(ad))
    for old in OUTPUT.glob("*.html"):
        if old.name not in expected and re.fullmatch(r"[a-f0-9-]{36}\.html", old.name):
            old.unlink()
    build_sitemap(ads)
    print(f"Generated {len(ads)} public ad pages.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"SEO generation failed: {exc}", file=sys.stderr)
        sys.exit(1)
