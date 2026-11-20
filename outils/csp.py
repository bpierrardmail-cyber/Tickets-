#!/usr/bin/env python3
# Ancien outil, gardé pour les habitudes : l'empreinte du script dans la CSP est maintenant mise par outils/build.py.
#   python3 outils/csp.py          = python3 outils/build.py (assemble src/ et met l'empreinte)
#   python3 outils/csp.py --check  = python3 outils/build.py --check
import os, sys, subprocess
B = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build.py")
sys.exit(subprocess.call([sys.executable, B] + (["--check"] if "--check" in sys.argv else [])))
