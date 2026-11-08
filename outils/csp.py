#!/usr/bin/env python3
# Sécurité (08/11, revue E1) : la page n'autorise que SON script, par son empreinte SHA-256 (plus de 'unsafe-inline' pour les scripts).
# À lancer après toute modification du script de beta/index.html (avant chaque commit, avec la commande de l'étiquette de version) :
#   python3 outils/csp.py          met l'empreinte à jour
#   python3 outils/csp.py --check  vérifie seulement (code de sortie 1 si l'empreinte n'est plus la bonne)
import re, sys, hashlib, base64, os
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "beta", "index.html")
s = open(P, encoding="utf-8").read()
m = re.search(r"<script>([\s\S]*?)</script>", s)
h = "'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode("utf-8")).digest()).decode() + "'"
cur = re.search(r"script-src 'self' ('sha256-[A-Za-z0-9+/=]+'|'unsafe-inline')", s)
if not cur: sys.exit("CSP introuvable dans beta/index.html")
if "--check" in sys.argv:
    ok = cur.group(1) == h
    print("empreinte du script : " + ("à jour" if ok else "PAS à jour (lancer python3 outils/csp.py)"))
    sys.exit(0 if ok else 1)
if cur.group(1) != h:
    s = s[:cur.start(1)] + h + s[cur.end(1):]
    open(P, "w", encoding="utf-8").write(s)
    print("empreinte mise à jour :", h)
else:
    print("empreinte déjà à jour")
