#!/bin/sh
# Lance tous les tests (ou ceux donnés : sh tests/run.sh t94 t95 ; « unit » = les tests rapides) et résume les échecs.
#   sh tests/run.sh            tests rapides (tests/unit, quelques secondes) puis tous les tests d'écran
#   sh tests/run.sh unit       seulement les tests rapides
#   sh tests/run.sh -j 4 …     4 tests d'écran à la fois (par défaut : le nombre de processeurs) ; ceux du foyer
#                              (relais local) passent l'un après l'autre, à la fin, pour ne pas se gêner.
# Le relais local est démarré s'il ne répond pas déjà sur localhost:8787.
cd "$(dirname "$0")"
python3 ../outils/build.py --check || { echo "Assembler d'abord : python3 outils/build.py"; exit 1; }
J=$(nproc 2>/dev/null || echo 2)
if [ "$1" = "-j" ]; then J="$2"; shift 2; fi
LISTE="$*"; UNIT=0
[ -z "$LISTE" ] && { UNIT=1; LISTE=$(ls t[0-9]*.py | sed 's/\.py$//' | sort -V); }
case " $LISTE " in *" unit "*) UNIT=1; LISTE=$(printf '%s\n' $LISTE | grep -v '^unit$');; esac
TOTAL=0
if [ "$UNIT" = 1 ]; then
  r=$(python3 unit/run.py 2>&1); rc=$?
  if [ "$rc" = 0 ]; then echo "unit  ok ($(printf '%s\n' "$r" | tail -1))"; else echo "unit  échec"; printf '%s\n' "$r" | grep '^FAIL' | head -8 | sed 's/^/    /'; TOTAL=$((TOTAL+1)); fi
fi
[ -z "$LISTE" ] && { echo "Fin : $TOTAL test(s) en échec"; [ "$TOTAL" = 0 ]; exit; }
PID=""
if ! curl -s -m 2 http://localhost:8787/ >/dev/null 2>&1; then
  node relais-local/server.mjs ../relais > relais-local/srv.log 2>&1 & PID=$!
  sleep 2
fi
OUT=$(mktemp -d)
SER=""; PAR=""
for t in $LISTE; do if grep -q "8787\|foyerApi" "$t.py" 2>/dev/null; then SER="$SER $t"; else PAR="$PAR $t"; fi; done
[ -n "$PAR" ] && printf '%s\n' $PAR | xargs -P "$J" -I{} sh ./run1.sh {} "$OUT"
for t in $SER; do sh ./run1.sh "$t" "$OUT"; done
for t in $LISTE; do
  r=$(cat "$OUT/$t.out" 2>/dev/null); rc=$(cat "$OUT/$t.rc" 2>/dev/null || echo 1)
  n=$(printf '%s\n' "$r" | grep -c '^FAIL'); tb=$(printf '%s\n' "$r" | grep -c Traceback)
  if [ "$rc" = 124 ]; then echo "$t  délai dépassé (400 s)"; TOTAL=$((TOTAL+1)); continue; fi   # un test coupé n'est pas un succès
  if [ "$rc" != 0 ] && [ "$n" = 0 ]; then n=1; fi
  if [ "$n" = 0 ] && [ "$tb" = 0 ]; then echo "$t  ok"; else
    echo "$t  $n échec(s)$( [ "$tb" != 0 ] && echo ', erreur Python')"; printf '%s\n' "$r" | grep -E '^FAIL|Error' | head -5 | sed 's/^/    /'; TOTAL=$((TOTAL+1)); fi
done
rm -rf "$OUT"
[ -n "$PID" ] && kill $PID 2>/dev/null
echo "Fin : $TOTAL test(s) en échec"
[ "$TOTAL" = 0 ]
