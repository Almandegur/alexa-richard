#!/usr/bin/env python3
# Per-font FULL experience: language chooser -> KG/KZ invitation, all in that font.
# Robust: one font forced on all text (no fallback) + Google Fonts link (all subsets).
kg = open('kg.html', encoding='utf-8').read()
kz = open('kz.html', encoding='utf-8').read()
picker = open('index.html', encoding='utf-8').read()

CANDS = [
 ("playfair", "Playfair Display", "Playfair+Display:wght@400;500;600;700"),
 ("prata",    "Prata",            "Prata"),
 ("ptserif",  "PT Serif",         "PT+Serif:wght@400;700"),
 ("garamond", "EB Garamond",      "EB+Garamond:wght@400;500;600;700"),
 ("cormorant","Cormorant SC",     "Cormorant+SC:wght@400;500;600;700"),
 ("lora",     "Lora",             "Lora:wght@400;500;600;700"),
]
NAMES_SEL = '#rec2047601243 [data-elem-id="1776948176126"] .tn-atom'

def inv_override(name, fam):
    return ('<link href="https://fonts.googleapis.com/css2?family=%s&display=swap" rel="stylesheet"><style>'
     '[id^="rec"] .tn-atom, [id^="rec"] .tn-atom *{font-family:%r,serif!important;}'
     '%s{font-family:"newtemplate",cursive!important;}'
     '@media screen and (max-width:640px){'
     '.t396__artboard .tn-atom{white-space:normal!important;overflow-wrap:break-word!important;line-height:1.25!important;}'
     '#rec2191269323 [data-elem-id="1705235414679"] .tn-atom{font-size:20px!important;}'
     '#rec2191269323 [data-elem-id="1705235414678"] .tn-atom{font-size:12px!important;}'
     '}</style></head>') % (fam, name, NAMES_SEL)

def picker_for(key, name, fam):
    p = picker.replace('href="kg.html"', 'href="kg-%s.html"' % key).replace('href="kz.html"', 'href="kz-%s.html"' % key)
    inj = ('<link href="https://fonts.googleapis.com/css2?family=%s&display=swap" rel="stylesheet">'
           '<style>.lang,.lead{font-family:%r,serif!important;}</style></head>') % (fam, name)
    return p.replace('</head>', inj, 1)

links = []
for key, name, fam in CANDS:
    ov = inv_override(name, fam)
    open("kg-%s.html" % key, "w", encoding="utf-8").write(kg.replace("</head>", ov, 1))
    open("kz-%s.html" % key, "w", encoding="utf-8").write(kz.replace("</head>", ov, 1))
    open("index-%s.html" % key, "w", encoding="utf-8").write(picker_for(key, name, fam))
    links.append((key, name))
    print("wrote index/kg/kz -%s.html" % key)

items = "\n".join('<a class="opt" href="index-%s.html"><span class="n">%d</span> %s</a>' % (k, i+1, n)
                  for i, (k, n) in enumerate(links))
landing = ("""<!DOCTYPE html><html lang="ky"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Font versions</title>
<link href="https://fonts.googleapis.com/css2?family=Rufina:wght@400;700&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}body{font-family:'Rufina',serif;background:linear-gradient(180deg,#fffdfb,#e7ecf0);min-height:100vh;padding:42px 22px;color:#4f5a62;text-align:center}
h1{font-weight:400;font-size:23px;color:#7f8a93;margin-bottom:8px}p{color:#9aa6ad;font-size:15px;max-width:460px;margin:0 auto 24px}
.opt{display:block;max-width:460px;margin:0 auto 13px;background:rgba(255,255,255,.8);border:1px solid #c8d2da;border-radius:16px;padding:17px 22px;text-decoration:none;color:#4f5a62;font-size:21px;box-shadow:0 12px 26px -16px rgba(90,90,110,.5);transition:.2s}
.opt:hover{background:#8ea7b6;color:#fff;transform:translateY(-2px)}.n{display:inline-block;width:30px;height:30px;line-height:30px;border-radius:50%;background:#e7ecf0;color:#7f8a93;font-size:15px;margin-right:8px}.opt:hover .n{background:rgba(255,255,255,.3);color:#fff}</style></head>
<body><h1>Font versions — full experience</h1><p>Each opens the LANGUAGE CHOOSER in that font → pick Kyrgyz or Kazakh → see the whole invitation in that font. Then tell me the number.</p>
__ITEMS__
</body></html>""").replace("__ITEMS__", items)
open("fonts.html", "w", encoding="utf-8").write(landing)
print("wrote fonts.html (links to per-font language choosers)")
