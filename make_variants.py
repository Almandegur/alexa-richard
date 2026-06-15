#!/usr/bin/env python3
# Full-page KG font variants. ROBUST approach: force ONE font on ALL text (no fallback
# possible) via a high-specificity !important rule + a Google Fonts <link> (all subsets,
# so full Kyrgyz+Kazakh). The couple's Latin names keep the template's script font.
base = open('kg.html', encoding='utf-8').read()

# key -> (display name, google css2 family param with weights)
CANDS = [
 ("playfair", "Playfair Display", "Playfair+Display:wght@400;500;600;700"),
 ("prata",    "Prata",            "Prata"),
 ("ptserif",  "PT Serif",         "PT+Serif:wght@400;700"),
 ("garamond", "EB Garamond",      "EB+Garamond:wght@400;500;600;700"),
 ("cormorant","Cormorant SC",     "Cormorant+SC:wght@400;500;600;700"),
 ("lora",     "Lora",             "Lora:wght@400;500;600;700"),
]
NAMES_SEL = '#rec2047601243 [data-elem-id="1776948176126"] .tn-atom'  # keep script

def override(name, fam):
    return (
     '<link href="https://fonts.googleapis.com/css2?family=%s&display=swap" rel="stylesheet">' % fam +
     '<style>'
     # force the chosen font on every text atom (kills all Latin-only fallbacks)
     '[id^="rec"] .tn-atom, [id^="rec"] .tn-atom *{font-family:%r,serif!important;}' % name +
     # ...but the couple's Latin names stay in the template's script font
     '%s{font-family:"newtemplate",cursive!important;}' % NAMES_SEL +
     # mobile: wrap everything; shrink the long welcome paragraph so it fits the envelope
     '@media screen and (max-width:640px){'
     '.t396__artboard .tn-atom{white-space:normal!important;overflow-wrap:break-word!important;line-height:1.25!important;}'
     '#rec2191269323 [data-elem-id="1705235414679"] .tn-atom{font-size:20px!important;}'
     '#rec2191269323 [data-elem-id="1705235414678"] .tn-atom{font-size:12px!important;}'
     '}</style></head>'
    )

links=[]
for key,name,fam in CANDS:
    html = base.replace("</head>", override(name,fam), 1)
    open("kg-%s.html"%key,"w",encoding="utf-8").write(html); links.append((key,name))
    print("wrote kg-%s.html"%key)

items="\n".join('<a class="opt" href="kg-%s.html"><span class="n">%d</span> %s</a>'%(k,i+1,n) for i,(k,n) in enumerate(links))
landing=("""<!DOCTYPE html><html lang="ky"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Font versions</title>
<link href="https://fonts.googleapis.com/css2?family=Rufina:wght@400;700&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}body{font-family:'Rufina',serif;background:linear-gradient(180deg,#fffdfb,#e7ecf0);min-height:100vh;padding:42px 22px;color:#4f5a62;text-align:center}
h1{font-weight:400;font-size:24px;color:#7f8a93;margin-bottom:8px}p{color:#9aa6ad;font-size:15px;margin-bottom:24px;max-width:440px;margin-left:auto;margin-right:auto}
.opt{display:block;max-width:440px;margin:0 auto 13px;background:rgba(255,255,255,.78);border:1px solid #c8d2da;border-radius:16px;padding:17px 22px;text-decoration:none;color:#4f5a62;font-size:21px;box-shadow:0 12px 26px -16px rgba(90,90,110,.5);transition:.2s}
.opt:hover{background:#8ea7b6;color:#fff;transform:translateY(-2px)}.n{display:inline-block;width:30px;height:30px;line-height:30px;border-radius:50%;background:#e7ecf0;color:#7f8a93;font-size:15px;margin-right:8px}.opt:hover .n{background:rgba(255,255,255,.3);color:#fff}
.real{display:inline-block;margin-top:18px;color:#8a7d63;font-size:15px;border-bottom:1px solid #b9a98a;text-decoration:none;padding-bottom:2px}</style></head>
<body><h1>Font versions (Kyrgyz preview)</h1><p>Open each, scroll the whole invitation, then tell me the number. Every text now uses one font; the names keep their script.</p>
__ITEMS__
<a class="real" href="index.html">↩ Open the real site (with language chooser)</a>
</body></html>""").replace("__ITEMS__",items)
open("fonts.html","w",encoding="utf-8").write(landing)
print("wrote fonts.html")
