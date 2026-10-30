#!/usr/bin/env python3
"""Builds public/bible/ from public-domain sources (KJV + Strong's + Treasury cross references).
Usage: python3 scripts/build-bible.py <dir with osis.json, cross_references.txt, strongs-*.js>
Output: public/bible/index.json, kjv/<n>.json (per book), xref/<n>.json, strongs-g.json, strongs-h.json
Segment format: [text, strongs|0, flags]  flags bit1=Jesus's words (red), bit2=added word (italic), bit4=divine name (LORD)."""
import json, re, sys, os, html
src = sys.argv[1]; out = os.path.join(os.path.dirname(__file__), "..", "public", "bible")
os.makedirs(out + "/kjv", exist_ok=True); os.makedirs(out + "/xref", exist_ok=True)
d = json.load(open(src + "/osis.json"))
ABBR = "Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev".split()
tok = re.compile(r'<(/?)(w|q|transChange|divineName|note|rdg|title|inscription|catchWord|foreign|milestone|div)\b([^>]*?)(/?)>|([^<]+)')
red = False
books = []
for bi, b in enumerate(d["books"]):
    chapters = []
    for c in b["chapters"]:
        verses = []
        for v in c["verses"]:
            segs, stack, skip = [], [], 0
            strong, flags_i, flags_d = 0, 0, 0
            for m in tok.finditer(v["text"]):
                close, tag, attrs, selfc, text = m.groups()
                if text is not None:
                    if skip: continue
                    t = html.unescape(text)
                    f = (1 if red else 0) | (2 if flags_i else 0) | (4 if flags_d else 0)
                    if segs and segs[-1][1] == strong and segs[-1][2] == f: segs[-1][0] += t
                    else: segs.append([t, strong, f])
                    continue
                if tag == "q":
                    if close:
                        if stack and stack[-1] == "q-red": red = False
                        if stack: stack.pop()
                    elif not selfc:
                        isred = 'who="Jesus"' in attrs
                        if isred: red = True
                        stack.append("q-red" if isred else "q")
                elif tag in ("note", "rdg"):
                    skip += -1 if close else 1
                elif tag == "w":
                    if close: strong = 0
                    else:
                        s = re.findall(r'strong:([HG])0*(\d+)', attrs)
                        strong = s[-1][0] + s[-1][1] if s else 0
                        if len(s) > 1: strong = s[0][0] + s[0][1] if s[0][1] not in ("3588", "853") else strong
                elif tag == "transChange": flags_i = 0 if close else 1
                elif tag == "divineName": flags_d = 0 if close else 1
            for s in segs: s[0] = re.sub(r'\s+', ' ', s[0])
            verses.append([s for s in segs if s[0].strip() or s[0] == " "])
        chapters.append(verses)
    json.dump(chapters, open(f"{out}/kjv/{bi+1}.json", "w"), separators=(",", ":"), ensure_ascii=False)
    books.append({"n": bi + 1, "name": b["name"], "abbr": ABBR[bi], "ch": len(chapters), "t": "OT" if bi < 39 else "NT"})
json.dump({"books": books}, open(out + "/index.json", "w"), separators=(",", ":"))
print("red open at end:", red)

# Cross references (openbible.info, CC-BY): top 8 by votes per verse, grouped by book
bk = {a: i + 1 for i, a in enumerate(ABBR)}
bk.update({"Ps": 19, "Song": 22, "Phlm": 57})
x = {}
def ref(s):
    p = s.split("."); return (bk.get(p[0]), int(p[1]), int(p[2])) if len(p) == 3 and p[0] in bk else None
for line in open(src + "/cross_references.txt", encoding="utf-8"):
    if line.startswith("From") or not line.strip(): continue
    a, b2, votes = line.rstrip("\n").split("\t")[:3]
    fr = ref(a)
    parts = b2.split("-"); s = ref(parts[0]); e = ref(parts[1]) if len(parts) > 1 else s
    if not fr or not s or not e: continue
    x.setdefault(fr[0], {}).setdefault(f"{fr[1]}:{fr[2]}", []).append((int(votes), [s[0], s[1], s[2], e[1] if e[0] == s[0] else s[1], e[2] if e[0] == s[0] else s[2]]))
for n, vs in x.items():
    o = {k: [r for _, r in sorted(v, key=lambda t: -t[0])[:8]] for k, v in vs.items()}
    json.dump(o, open(f"{out}/xref/{n}.json", "w"), separators=(",", ":"))

# Strong's dictionaries (public domain)
for k, f in (("g", "greek"), ("h", "hebrew")):
    t = open(f"{src}/strongs-{f}-dictionary.js", encoding="utf-8").read()
    j = json.loads(t[t.index("{"): t.rindex("}") + 1])
    o = {}
    for key, v in j.items():
        num = key[0] + key[1:].lstrip("0")
        o[num] = [v.get("lemma", ""), v.get("translit") or v.get("xlit", ""), v.get("pron", ""), (v.get("strongs_def") or "").strip(), (v.get("kjv_def") or "").strip(), (v.get("derivation") or "").strip()]
    json.dump(o, open(f"{out}/strongs-{k}.json", "w"), separators=(",", ":"), ensure_ascii=False)
print("done")
