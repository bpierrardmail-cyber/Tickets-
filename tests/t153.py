# Limite par adresse du relais des cours (sécurité point 7, 08/11) : le test est en JavaScript (t153.mjs), lancé ici pour run.sh.
import subprocess, sys, os
r = subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "t153.mjs")], capture_output=True, text=True, timeout=120)
print(r.stdout + r.stderr); sys.exit(r.returncode)
