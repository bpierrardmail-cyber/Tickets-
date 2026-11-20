# Met le guide (guide/proprietaire.md et guide/membre.md) dans le code de l'appli (src/js/*-aide.js), entre /* GUIDE-DEBUT */ et /* GUIDE-FIN */,
# puis réassemble beta/index.html (outils/build.py). À relancer après chaque modification du guide : python3 guide/maj.py
# Markdown reconnu : « ## Titre » (une partie), paragraphes, **gras**, listes « - » et « 1. ».
import os, re, json, html, glob, subprocess, sys
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
APP=[f for f in sorted(glob.glob(os.path.join(ROOT, "src", "js", "*.js"))) if "/* GUIDE-DEBUT */" in open(f, encoding="utf-8").read()][0]
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
subprocess.check_call([sys.executable, os.path.join(ROOT, "outils", "build.py")])
