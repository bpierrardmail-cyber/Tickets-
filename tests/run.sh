#!/bin/sh
# Lance tous les tests (ou ceux donnés : sh tests/run.sh t94 t95) et résume les échecs.
# Le relais local est démarré s'il ne répond pas déjà sur localhost:8787 (tests du foyer : t93).
cd "$(dirname "$0")"
LISTE="$*"; [ -z "$LISTE" ] && LISTE=$(ls t[0-9]*.py | sed 's/\.py$//' | sort -V)
PID=""
if ! curl -s -m 2 http://localhost:8787/ >/dev/null 2>&1; then
  node relais-local/server.mjs ../relais > relais-local/srv.log 2>&1 & PID=$!
  sleep 2
fi
TOTAL=0
for t in $LISTE; do
  r=$(timeout 400 python3 "$t.py" 2>&1)
  n=$(printf '%s\n' "$r" | grep -c '^FAIL'); tb=$(printf '%s\n' "$r" | grep -c Traceback)
  if [ "$n" = 0 ] && [ "$tb" = 0 ]; then echo "$t  ok"; else
    echo "$t  $n échec(s)$( [ "$tb" != 0 ] && echo ', erreur Python')"; printf '%s\n' "$r" | grep -E '^FAIL|Error' | head -5 | sed 's/^/    /'; TOTAL=$((TOTAL+1)); fi
done
[ -n "$PID" ] && kill $PID 2>/dev/null
echo "Fin : $TOTAL test(s) en échec"
