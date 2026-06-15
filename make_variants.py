#!/usr/bin/env python3
# Generate full-page font variants of the KG invitation so the user can compare in context.
# Each variant aliases the template's Latin-only 'newtemplate' font to a Cyrillic serif
# for Cyrillic glyphs only (unicode-range) -> Latin names keep their script font.
import re, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

# key -> (display name, google css2 family param)
CANDS = [
 ("playfair", "Playfair Display", "Playfair+Display:wght@500"),
 ("prata",    "Prata",            "Prata"),
 ("ptserif",  "PT Serif",         "PT+Serif:wght@400;700"),
 ("garamond", "EB Garamond",      "EB+Garamond:wght@500"),
 ("cormorant","Cormorant SC",     "Cormorant+SC:wght@500;600"),
 ("lora",     "Lora",             "Lora:wght@500"),
]

def cyr_faces(family_param):
    css = urllib.request.urlopen(urllib.request.Request(
        "https://fonts.googleapis.com/css2?family=%s&display=swap" % family_param,
        headers={"User-Agent": UA})).read().decode()
    blocks = re.findall(r'/\*\s*(cyrillic(?:-ext)?)\s*\*/\s*(@font-face\s*\{[^}]*\})', css)
    out = []
    for label, blk in blocks:
        src = re.search(r'src:\s*([^;]+);', blk).group(1)
        rng = re.search(r'unicode-range:\s*([^;]+);', blk).group(1)
        out.append((src, rng))
    return out

base = open('kg.html', encoding='utf-8').read()
links = []
for key, name, fam in CANDS:
    faces = cyr_faces(fam)
    css = "<style>/* alias newtemplate -> %s for Cyrillic only */\n" % name
    for w in (400, 500, 700):
        for src, rng in faces:
            css += "@font-face{font-family:'newtemplate';font-style:normal;font-weight:%d;src:%s;unicode-range:%s;}\n" % (w, src, rng)
    css += "</style></head>"
    html = base.replace("</head>", css, 1)
    open("kg-%s.html" % key, "w", encoding="utf-8").write(html)
    links.append((key, name))
    print("wrote kg-%s.html (%d cyrillic faces)" % (key, len(faces)))

# landing page linking all variants
items = "\n".join(
 '<a class="opt" href="kg-%s.html"><span class="n">%d</span> %s</a>' % (k, i+1, n)
 for i,(k,n) in enumerate(links))
landing = """<!DOCTYPE html><html lang="ky"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Font versions</title>
<link href="https://fonts.googleapis.com/css2?family=Rufina:wght@400;700&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}body{font-family:'Rufina',serif;background:linear-gradient(180deg,#fffdfb,#e7ecf0);
min-height:100vh;padding:42px 22px;color:#4f5a62;text-align:center}h1{font-weight:400;font-size:24px;color:#7f8a93;margin-bottom:8px}
p{color:#9aa6ad;font-size:15px;margin-bottom:26px}.opt{display:block;max-width:420px;margin:0 auto 14px;background:rgba(255,255,255,.75);
border:1px solid #c8d2da;border-radius:16px;padding:18px 22px;text-decoration:none;color:#4f5a62;font-size:21px;
box-shadow:0 12px 26px -16px rgba(90,90,110,.5);transition:.2s}.opt:hover{background:#8ea7b6;color:#fff;transform:translateY(-2px)}
.n{display:inline-block;width:30px;height:30px;line-height:30px;border-radius:50%;background:#e7ecf0;color:#7f8a93;font-size:15px;margin-right:8px}
.opt:hover .n{background:rgba(255,255,255,.3);color:#fff}</style></head>
<body><h1>Шрифт версиялары / Font versions</h1><p>Open each one, view the full invitation, then tell me the number you like.</p>
__ITEMS__
</body></html>""".replace("__ITEMS__", items)
open("fonts.html", "w", encoding="utf-8").write(landing)
print("wrote fonts.html")
