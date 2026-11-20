#!/bin/sh
# Lance un seul test pour run.sh (en parallèle) : sortie dans $2/<test>.out, code dans $2/<test>.rc
t="$1"; d="$2"
timeout 400 python3 "$t.py" > "$d/$t.out" 2>&1; echo $? > "$d/$t.rc"
