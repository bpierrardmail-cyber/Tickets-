#!/usr/bin/env python3
# Assemble l'appli : src/page.html + src/app.css + src/js/*.js (dans l'ordre des numéros) → beta/index.html,
# puis met l'empreinte du script dans la CSP (plus besoin de lancer outils/csp.py à part).
#   python3 outils/build.py            assemble beta/index.html
#   python3 outils/build.py --stamp    met d'abord l'étiquette de version (heure de Paris) dans src/page.html (avant chaque commit)
#   python3 outils/build.py --check    vérifie que beta/index.html est bien l'assemblage de src/ (code de sortie 1 sinon :
#                                      quelqu'un a modifié beta/index.html directement, ou oublié d'assembler)
# On ne modifie JAMAIS beta/index.html à la main : on modifie src/, puis on assemble.
import os, re, sys, glob, hashlib, base64, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, "src"), os.path.join(ROOT, "beta", "index.html")
def rd(p): return open(p, encoding="utf-8").read()
def assemble():
    page = rd(os.path.join(SRC, "page.html"))
    js = "".join(rd(f) for f in sorted(glob.glob(os.path.join(SRC, "js", "*.js"))))
    s = page.replace("/*@CSS*/", rd(os.path.join(SRC, "app.css")), 1).replace("/*@JS*/", js, 1)
    m = re.search(r"<script>([\s\S]*?)</script>", s)
    h = "'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode("utf-8")).digest()).decode() + "'"
    s = re.sub(r"(script-src 'self' )('sha256-[A-Za-z0-9+/=]+'|'unsafe-inline')", lambda x: x.group(1) + h, s, count=1)
    return s
if "--stamp" in sys.argv:
    p = os.path.join(SRC, "page.html"); t = rd(p)
    now = subprocess.check_output(["date", "+%d/%m %H:%M"], env=dict(os.environ, TZ="Europe/Paris")).decode().strip()
    t = re.sub(r'<meta name="build" content="[^"]*" />', '<meta name="build" content="%s" />' % now, t, count=1)
    open(p, "w", encoding="utf-8").write(t); print("étiquette :", now)
s = assemble()
if "--check" in sys.argv:
    ok = os.path.exists(OUT) and rd(OUT) == s
    print("beta/index.html : " + ("à jour" if ok else "PAS à jour (lancer python3 outils/build.py ; ne pas modifier beta/index.html à la main)"))
    sys.exit(0 if ok else 1)
open(OUT, "w", encoding="utf-8").write(s)
print("beta/index.html assemblé (%d lignes)" % (s.count("\n") + 1))
