# Foyer : onglet À venir. Marie : Commun en modification, À venir masqué → seulement « Frais fixes ». Léa : À venir en lecture, Commun masqué.
import sys, os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SP=(sys.argv[1] if len(sys.argv)>1 else HERE)
src=open(os.path.join(HERE,'foyer_base.py'),encoding='utf-8').read()
exec(src.split("with sync_playwright() as p:")[0])
data={"askName":False,"devise":"EUR","personnes":[{"nom":"Marie"},{"nom":"Léa"}],
  "comptes":[{"key":"Benoit","nom":"Compte courant","payer":"Benoit","main":True},{"key":"marie","nom":"Compte Marie","payer":"Marie"}],
  "fraisCommuns":[{"id":1,"label":"Loyer","montant":650,"personne":"Commun","recurrent":True,"startMonth":"2026-01","jour":5}],
  "provisions":[{"id":11,"nom":"Taxe foncière","mensuel":82,"soldeInitial":410,"startMonth":"2026-10","prelevements":[],"echeance":10,"prevu":980}],
  "entries":[]}
def invite(O, name, q, off):
    open_foyer(O); O.locator("#fyAdd").click(); O.wait_for_timeout(300); O.locator('[data-n="%s"]' % name).click(); O.wait_for_timeout(150)
    O.locator('[data-q="%s"]' % q).click(); O.wait_for_timeout(150)
    for t in off: O.locator('.sheet-overlay [data-tm="%s"][data-v="off"]' % t).last.click(); O.wait_for_timeout(150)
    O.locator("#fyOk").click(); O.wait_for_timeout(1500); inv=read_qr(O, "t93_qr.png"); O.locator(".ui-no").last.click(); O.wait_for_timeout(300); return inv
def join(b, errs, tag, inv):
    pg=new_page(b, errs, tag); pg.evaluate("()=>{localStorage.clear(); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API)
    pg.reload(); pg.wait_for_timeout(1200); btn(pg, "Rejoindre un foyer (QR code)")
    pg.locator("#fyPaste").fill(inv); pg.locator("#fyGo").click(); pg.wait_for_timeout(1500); setup_lock(pg); pg.wait_for_timeout(1500)
    if pg.locator(".ui-no").count(): pg.locator(".ui-no").last.click(); pg.wait_for_timeout(300)
    return pg
def tabs(pg): return pg.evaluate("()=>[].map.call(document.querySelectorAll('#nav .navi'), b=>b.style.display==='none'?null:b.textContent).filter(Boolean)")
def avtabs(pg): return pg.evaluate("()=>[].map.call(document.querySelectorAll('.avtabs button'), b=>b.textContent.trim())")
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    O=new_page(b, errs, "O")
    O.evaluate("d=>{localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); localStorage.setItem('foyerApi', JSON.stringify('%s'));}" % API, data)
    O.reload(); O.wait_for_timeout(1200)
    open_foyer(O); O.locator("#fyNew").click(); O.wait_for_timeout(300); O.locator(".ui-yes").click(); setup_lock(O); btn(O, "Je l'ai noté")
    rows=O.evaluate("()=>[].map.call(document.querySelectorAll('[data-tm]'), b=>b.dataset.tm)")
    invM=invite(O, "Marie", "w", ["factures"]); invL=invite(O, "Léa", "r", ["communes"])
    mem={m["name"]:m for m in ls(O,"fyCfg")["members"].values()}; print("  droits :", {k:(v.get("role"), v.get("tabs"), v.get("ed")) for k,v in mem.items()})
    M=join(b, errs, "M", invM); L=join(b, errs, "L", invL)
    reload(M, 3000); reload(L, 3000)
    # Marie
    print("  Marie :", tabs(M))
    check("À venir" in tabs(M), "Marie (Commun sans À venir) : l'onglet À venir est là")
    M.locator('#nav .navi[data-view="factures"]').click(); M.wait_for_timeout(500)
    t=M.locator("#app").inner_text()
    check(avtabs(M)==[] and "Loyer" in t and M.locator("#addfrais").count()==1, "Marie : seulement ses Frais fixes, modifiables (droits de Commun) %s"%avtabs(M))
    check(M.locator(".pcard").count()==0 and "Total provisions" not in t and "Provision · Taxe foncière" in t, "Marie : pas la page des provisions, seulement leur mise de côté (un frais commun)")
    # Léa
    print("  Léa :", tabs(L))
    check("À venir" in tabs(L) and "Commun" not in tabs(L), "Léa : À venir sans Commun")
    L.locator('#nav .navi[data-view="factures"]').click(); L.wait_for_timeout(500)
    check(avtabs(L)==["12 mois","Provisions","Factures"], "Léa : 12 mois, Provisions, Factures (pas les frais fixes) %s"%avtabs(L))
    check(L.locator("#fctImp").count()==0 and L.locator("#avAddFrais").count()==0, "Léa (lecture) : ni import ni ajout de frais")
    L.locator('.avtabs button[data-av="prov"]').click(); L.wait_for_timeout(400)
    check("Taxe foncière" in L.locator("#app").inner_text(), "Léa : les provisions en lecture")
    print("errors:", [e for e in errs if "ERR_FAILED" not in e])
    b.close()
print(len(fails), "échec(s)")
