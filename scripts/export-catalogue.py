#!/usr/bin/env python3
"""
Packs the free-book library (every `gutenberg-<id>` book with its chapters) into small compressed files you can upload to a server:
    python3 scripts/export-catalogue.py                 # everything  -> ./catalogue/
    python3 scripts/export-catalogue.py --limit 40      # a small sample, for testing
It streams straight into gzip, so it needs little memory or disk. On the server, prisma/import-catalogue.ts loads the files.
"""
import gzip, json, os, sqlite3, sys, datetime

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(root, "prisma", "dev.db")
out = os.path.join(root, "catalogue")
limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
PART = 250 * 1024 * 1024  # uncompressed bytes per chapters file (about 80 MB once compressed)

c = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
c.row_factory = sqlite3.Row
iso = lambda ms: datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).isoformat() if ms else None

os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.endswith(".ndjson.gz"): os.remove(os.path.join(out, f))

sql = "select * from Book where externalId like 'gutenberg-%' and status='APPROVED' order by externalId" + (f" limit {limit}" if limit else "")
books = c.execute(sql).fetchall()
pubs = {r["id"]: r for r in c.execute("select * from Publisher")}

with gzip.open(os.path.join(out, "books.ndjson.gz"), "wt", encoding="utf-8", compresslevel=6) as bf:
    seen = set()
    for b in books:
        p = pubs[b["publisherId"]]
        if p["externalId"] not in seen:
            seen.add(p["externalId"]); bf.write(json.dumps({"t": "publisher", "externalId": p["externalId"], "name": p["name"]}) + "\n")
        bf.write(json.dumps({"t": "book", "externalId": b["externalId"], "publisherExternalId": p["externalId"], "title": b["title"], "author": b["author"], "category": b["category"], "description": b["description"], "language": b["language"], "coverUrl": b["coverUrl"], "coverHue": b["coverHue"], "status": b["status"], "isFree": bool(b["isFree"]), "baseCurrency": b["baseCurrency"], "totalChars": b["totalChars"], "chapterCount": b["chapterCount"], "createdAt": iso(b["createdAt"]), "approvedAt": iso(b["approvedAt"])}) + "\n")
        for pr in c.execute("select currency, amountMinor from BookPrice where bookId=?", (b["id"],)):
            bf.write(json.dumps({"t": "price", "bookExternalId": b["externalId"], "currency": pr["currency"], "amountMinor": pr["amountMinor"]}) + "\n")

part, size, n, chapters = 0, 0, 0, 0
cf = None
for i, b in enumerate(books):
    for ch in c.execute('select "index", title, content, startChar, charCount from Chapter where bookId=? order by "index"', (b["id"],)):
        if cf is None or size >= PART:
            if cf: cf.close()
            part += 1; size = 0
            cf = gzip.open(os.path.join(out, f"chapters-{part:03d}.ndjson.gz"), "wt", encoding="utf-8", compresslevel=6)
        line = json.dumps({"b": b["externalId"], "i": ch["index"], "t": ch["title"], "c": ch["content"], "s": ch["startChar"], "n": ch["charCount"]}) + "\n"
        cf.write(line); size += len(line); chapters += 1
    if (i + 1) % 500 == 0: print(f"  {i + 1}/{len(books)} books", flush=True)
if cf: cf.close()
total = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
print(f"Done: {len(books)} books, {chapters} chapters in {part} chapter file(s) + books.ndjson.gz -> {out} ({total / 1048576:.0f} MB)")
