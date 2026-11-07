# Relais (07/11) : copies différentielles, limite de création de foyer par adresse IP, effacement des foyers abandonnés.
# Seulement le relais local (le vrai code du Worker) ; rien de réel. Lancé par run.sh (relais sur 8787) ou seul : PORT du relais en argument.
import sys, json, hashlib, base64, os, urllib.request, urllib.error
PORT=sys.argv[1] if len(sys.argv)>1 else "8787"; API="http://localhost:%s/foyer"%PORT; T="http://localhost:%s/__test"%PORT
fails=[]
def check(c, m):
    print(("OK   " if c else "FAIL ")+m)
    if not c: fails.append(m)
def call(method, path, body=None, auth=None, ip=None):
    req=urllib.request.Request(API+path, method=method, data=None if body is None else json.dumps(body).encode())
    req.add_header("Content-Type","application/json")
    if auth: req.add_header("Authorization","Bearer "+auth)
    if ip: req.add_header("CF-Connecting-IP", ip)
    try:
        with urllib.request.urlopen(req) as r: t=r.read().decode(); return r.status, (json.loads(t) if t else {})
    except urllib.error.HTTPError as e:
        t=e.read().decode()
        try: return e.code, json.loads(t)
        except Exception: return e.code, {}
def raw(u):
    with urllib.request.urlopen(u) as r: return r.read().decode()
def b64(n): return base64.urlsafe_b64encode(os.urandom(n)).decode().rstrip("=")
def h(s): return base64.urlsafe_b64encode(hashlib.sha256(s.encode()).digest()).decode().rstrip("=")
import random
R1,R2=random.randint(1,250), random.randint(1,250); RUNIP="10.%d.%d.1"%(R1,R2)   # une adresse neuve à chaque passage (le relais local garde les compteurs du jour)
def foyer(ip=None):
    ip=ip or RUNIP
    fid=b64(16)[:22]; tok=b64(24); st,_=call("POST","/create",{"fid":fid,"otok":h(tok)}, ip=ip); return fid, tok, st
def member(fid, tok, mid="membre01"):
    inv=b64(24); call("PUT","/member/"+mid,{"role":"edit","inv":h(inv),"exp":9e15}, auth=fid+".o."+tok)
    mt=b64(24); st,_=call("POST","/join",{"fid":fid,"mid":mid,"inv":inv,"tok":h(mt)}); return fid+"."+mid+"."+mt, st
# 1. différences
fid, tok, st=foyer(); O=fid+".o."+tok; check(st==200, "foyer créé")
M, st=member(fid, tok); check(st==200, "membre a rejoint")
st,j=call("PUT","/snap/membre01",{"v":"FULL1"}, auth=O); F=j.get("t")
st,j=call("GET","/members", auth=O); check(j["members"][0]["dv"]==0, "membre pas encore « dv » (ancienne appli)")
st,j=call("PUT","/snap/membre01",{"v":"D1","base":F-5}, auth=O); check(st==409 and j.get("last")==F, "différence sur une mauvaise base : refusée (409)")
st,j=call("PUT","/snap/membre01",{"v":"D1","base":F}, auth=O); D1=j.get("t"); check(st==200 and D1>F, "différence 1 acceptée")
st,j=call("PUT","/snap/membre01",{"v":"D2","base":D1}, auth=O); D2=j.get("t"); check(st==200 and D2>D1, "différence 2 acceptée")
st,j=call("GET","/snap?since=0", auth=M); check(j.get("v")=="FULL1" and "deltas" not in j, "ancienne appli : la copie complète seule")
st,j=call("GET","/snap?since=0&d=1", auth=M); check(j.get("v")=="FULL1" and [d["v"] for d in j["deltas"]]==["D1","D2"] and j["last"]==D2, "nouvelle appli : copie complète + 2 différences")
st,j=call("GET","/snap?since=%d&d=1"%D1, auth=M); check(st==200 and "v" not in j and [d["v"] for d in j["deltas"]]==["D2"] and j["t"]==D2, "depuis la différence 1 : seulement la 2")
st,j=call("GET","/snap?since=%d&d=1"%D2, auth=M); check(st==204, "à jour : 204")
st,j=call("GET","/members", auth=O); check(j["members"][0]["dv"]==1 and j["members"][0]["snapT"]==D2, "le propriétaire voit « dv » et la dernière date")
st,j=call("PUT","/snap/membre01",{"v":"FULL2"}, auth=O); F2=j["t"]
st,j=call("GET","/snap?since=%d&d=1"%D2, auth=M); check(j.get("v")=="FULL2" and j["deltas"]==[], "nouvelle copie complète : les différences sont effacées, le membre la reçoit")
# 2. limite de création par adresse IP
ok=[foyer("10.%d.%d.7"%(R1,R2))[2] for _ in range(6)]
check(ok[:5]==[200]*5 and ok[5]==429, "6e foyer le même jour depuis la même adresse : refusé (%s)"%ok)
check(foyer("10.%d.%d.8"%(R1,R2))[2]==200, "une autre adresse peut encore créer")
v6=[foyer("2001:db8:%x:%x:%x::1"%(R1,R2,i))[2] for i in range(6)]
check(v6[5]==429, "IPv6 : le même bloc /64 compte comme une seule box")
# 3. foyers abandonnés
fa, ta, _=foyer("10.%d.%d.11"%(R1,R2))
fb, tb, _=foyer("10.%d.%d.12"%(R1,R2)); Mb,_=member(fb, tb)
check(raw(T+"/alarm?days=10&fid="+fa)=="garde", "foyer vide, 10 jours sans rien : gardé")
check(raw(T+"/alarm?days=25&fid="+fa)=="efface", "foyer que personne n'a rejoint, 35 jours sans rien : effacé")
st,_=call("GET","/me", auth=fa+".o."+ta); check(st==410, "son propriétaire reçoit « n'existe plus » (410)")
call("GET","/me", auth=Mb)
check(raw(T+"/alarm?days=200&fid="+fb)=="garde", "foyer rejoint, 200 jours sans rien : gardé")
call("GET","/me", auth=fb+".o."+tb)   # le propriétaire revient
check(raw(T+"/alarm?days=300&fid="+fb)=="garde", "il est revenu : 300 jours plus tard, encore gardé")
check(raw(T+"/alarm?days=100&fid="+fb)=="efface", "plus d'un an sans rien : effacé")
urllib.request.urlopen(T+"/reset?clock=1").read()   # horloge du relais local remise à l'heure pour les tests suivants
print("\n%d échec(s)"%len(fails)); sys.exit(1 if fails else 0)
