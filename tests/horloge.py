# Horloge des tests : les données inventées sont en octobre 2026, donc le navigateur se croit le jour TEST_NOW
# (l'heure avance normalement à partir de là). Chaque test fait « import horloge » ; TICKETS_NOW=… pour en changer.
import os, datetime
from playwright.sync_api._generated import Browser, BrowserContext
# TICKETS_NOW vide : vraie heure (tests du foyer, dont le relais local travaille à l'heure réelle)
TEST_NOW=os.environ.get("TICKETS_NOW", "2026-10-30T10:00:00")
def today(): return datetime.datetime.fromisoformat(TEST_NOW) if TEST_NOW else datetime.datetime.now()
def _fix(page):
    if TEST_NOW: page.clock.install(time=TEST_NOW)
    return page
_bnp, _cnp = Browser.new_page, BrowserContext.new_page
def _b(self, *a, **k): return _fix(_bnp(self, *a, **k))
def _c(self, *a, **k): return _fix(_cnp(self, *a, **k))
Browser.new_page=_b; BrowserContext.new_page=_c
