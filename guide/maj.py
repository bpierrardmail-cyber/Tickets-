# Met le guide (guide/proprietaire.md et guide/membre.md) dans beta/index.html, entre /* GUIDE-DEBUT */ et /* GUIDE-FIN */.
# À relancer après chaque modification du guide : python3 guide/maj.py
# Markdown reconnu : « ## Titre » (une partie), paragraphes, **gras**, listes « - » et « 1. ».
import os, re, json, html
HERE=os.path.dirname(os.path.abspath(__file__)); APP=os.path.join(os.path.dirname(HERE), "beta", "index.html")
def inline(t): return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", html.escape(t, quote=False))
def parts(md):
    out=[]; cur=None
    for bloc in re.split(r"\n\s*\n", md.strip()):
        lines=[l.rstrip() for l in bloc.split("\n") if l.strip()]
        if not lines or lines[0].startswith("# "): continue
        if lines[0].startswith("## "):
            cur={"t":lines[0][3:].strip(), "h":""}; out.append(cur); lines=lines[1:]
            if not lines: continue
        if cur is None: continue
        if all(re.match(r"^(- |\d+\. )", l) for l in lines):
            tag="ol" if re.match(r"^\d+\. ", lines[0]) else "ul"
            cur["h"]+="<%s>%s</%s>" % (tag, "".join("<li>%s</li>" % inline(re.sub(r"^(- |\d+\. )", "", l)) for l in lines), tag)
        else: cur["h"]+="<p>%s</p>" % inline(" ".join(lines))
    return out
G={ "proprietaire":parts(open(os.path.join(HERE,"proprietaire.md"),encoding="utf-8").read()),
    "membre":parts(open(os.path.join(HERE,"membre.md"),encoding="utf-8").read()) }
s=open(APP,encoding="utf-8").read()
a=s.index("/* GUIDE-DEBUT */"); b=s.index("/* GUIDE-FIN */")
s=s[:a]+"/* GUIDE-DEBUT */ var GUIDE="+json.dumps(G, ensure_ascii=False)+"; "+s[b:]
open(APP,"w",encoding="utf-8").write(s)
print("guide mis à jour :", {k:len(v) for k,v in G.items()}, "parties")
