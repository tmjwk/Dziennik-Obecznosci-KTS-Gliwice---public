/* sw.js — Dziennik Obecności KTS Gliwice (r36)
 *
 * Service Worker „apka zawsze najnowsza". Dlaczego: GitHub Pages wysyła
 * Cache-Control: max-age=600 na WSZYSTKIE pliki, a CDN (Fastly) IGNORUJE
 * query-stringi w kluczu cache (pomiar r36: wersja.json?t=<unikalny>
 * zwracał HIT z wiekiem ~490 s — czyli ?t=/?aktualizacja= z r34 omijały
 * co najwyżej cache przeglądarki, nigdy CDN). Skutki zgłoszone przez
 * właściciela: desktop po F5 wciąż na v0.4.2, telefon na v0.4.0 —
 * a to APLIKACJA, każdy trener musi mieć aktualny kod.
 *
 * Co robi ten SW:
 *  - NAVIGACJE (index.html): fetch z {cache:'no-store'} — omija cache
 *    przeglądarki; CDN po publikacji dostaje purge z GitHub Pages,
 *    więc sieć zwraca świeży HTML. Sukces zapisujemy do cache —
 *    wyłącznie jako fallback OFFLINE (online zawsze sieć).
 *  - wersja.json: zawsze sieć, nigdy cache (apka porównuje wersje
 *    przy starcie, powrocie karty, co 60 s i po pageshow/bfcache).
 *  - app.js/config.js (z ?v=): network-first — nowy URL i tak to MISS,
 *    {cache:'no-store'} dodatkowo omija cache przeglądarki; offline
 *    ratuje kopia z cache SW.
 *  - POST-y do API (Apps Script) i żądania do innych originów (GIS):
 *    nietknięte — SW nie uczestniczy.
 *
 * Instalacja natychmiastowa: skipWaiting + clients.claim — SW przejmuje
 * kontrolę także nad JUŻ OTWARTYMI kartami (bez przeładowania).
 * Strona (app.js r36) rejestruje 'sw.js' przy starcie; na file:// i
 * przeglądarkach bez SW rejestracja cicho się nie udaje — apka działa
 * dalej wg starego modelu (progressive enhancement, nic nie psuje).
 */
'use strict';

var CACHE = 'dziennik-shell';

self.addEventListener('install', function () {
  self.skipWaiting(); // nowa wersja SW przejmuje od razu, bez czekania
});

self.addEventListener('activate', function (e) {
  // przejęcie istniejących kart + sprzątanie ewentualnych starych cache
  e.waitUntil((function () {
    return Promise.all([
      self.clients.claim(),
      caches.keys().then(function (klucze) {
        return Promise.all(klucze
          .filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
    ]);
  })());
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; // mutacje do API — poza SW

  var url;
  try { url = new URL(req.url); } catch (ign) { return; }
  if (url.origin !== self.location.origin) return; // GIS/Google — poza SW

  // nawigacje (index.html): ZAWSZE sieć (omijamy cache przeglądarki);
  // kopia do cache tylko jako fallback offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(function (odp) {
          try {
            var kopia = odp.clone();
            caches.open(CACHE).then(function (c) { c.put(req, kopia); }).catch(function () {});
          } catch (ign) {}
          return odp;
        })
        .catch(function () {
          // offline: ostatnia znana nawigacja (albo index z scope)
          return caches.match(req).then(function (z) {
            if (z) return z;
            return caches.match(self.registration.scope).then(function (z2) {
              return z2 || new Response('Offline — sprawdź połączenie.', {
                status: 503,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
              });
            });
          });
        })
    );
    return;
  }

  // wersja.json — zawsze sieć; błąd = pusty JSON (apka czyta .wersja i
  // traktuje brak jako „nie wiem" — cisza, bez blokowania)
  if (url.pathname.indexOf('wersja.json') !== -1) {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .catch(function () {
          return new Response('{"wersja":""}', {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // pliki statyczne (app.js?v=…, config.js?v=…): network-first,
  // {cache:'no-store'} omija cache przeglądarki (nowy URL i tak MISS);
  // sukces → kopia do cache (fallback offline), porażka sieci → kopia
  e.respondWith(
    fetch(req, { cache: 'no-store' })
      .then(function (odp) {
        if (odp && odp.ok) {
          try {
            var kopia = odp.clone();
            caches.open(CACHE).then(function (c) { c.put(req, kopia); }).catch(function () {});
          } catch (ign) {}
        }
        return odp;
      })
      .catch(function () { return caches.match(req); })
  );
});
