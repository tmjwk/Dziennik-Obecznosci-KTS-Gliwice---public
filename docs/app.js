/* =================================================================
 * Dziennik Obecności KTS Gliwice — frontend v0.2.5
 * Przepływ (instrukcja właściciela, runda 17):
 *   1) użytkownik wchodzi na https://tmjwk.github.io/Dziennik-Obecznosci-
 *      KTS-Gliwice---public/ (strona hostowana na GitHub Pages),
 *   2) pierwsze co widzi: „Zaloguj się z Google" (Google Identity
 *      Services), 3) po zalogowaniu sekcja zapisu danych do arkusza
 *      (obecności jednym tapnięciem) przez API Apps Script (POST /exec).
 * Strona żyje na GitHub Pages; dane zapisuje w arkuszu Google
 * przez API Apps Script (URL /exec). Logowanie: konto Google
 * (Google Identity Services) — token weryfikuje API (aud + biała
 * lista w arkuszu). Runda 15: „na git jest strona internetowa
 * (frontend do zapisu danych w arkuszu)".
 *
 * r25 („wdrożyłem, a przycisk dalej nie dodaje grupy"): serwer dalej
 * odpowiadał v0.2.3 — nowe wdrożenie nie weszło, a frontend v0.2.4 wołał
 * akcje grup, których stary backend nie zna. Błąd rysował się POD
 * otwartym modalem → użytkownik widział „nic się nie dzieje". Stąd:
 *  - MIN_WERSJA_API + banerWersji(): widoczny od razu po zalogowaniu
 *    komunikat, gdy serwer jest starszy niż wymaga strona;
 *  - bladModalny(): błędy akcji z modali (grupy/członek/import) jako
 *    alert() — przebija się przez modal, dymek na liście nie;
 *  - stopka pokazuje obie wersje: „strona vX · serwer vY".
 * ================================================================= */

'use strict';

var WERSJA_UI = 'v0.2.5';

/* r25: najstarsza wersja API (Apps Script), z jaką ta strona umie
 * współpracować. v0.2.4 = akcje grup (dodajGrupe/edytujGrupe/usunGrupe);
 * starszy serwer je odrzuci (NIEZNANA_AKCJA). */
var MIN_WERSJA_API = 'v0.2.4';

/** Porównanie wersji „vX.Y.Z" → -1 | 0 | 1 (liczbowo, nie leksykalnie). */
function porownajWersje(a, b) {
  var ka = String(a || '').replace(/^v/, '').split('.');
  var kb = String(b || '').replace(/^v/, '').split('.');
  for (var i = 0; i < 3; i++) {
    var x = parseInt(ka[i], 10) || 0;
    var y = parseInt(kb[i], 10) || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** Czy serwer (arkusz) jest starszy, niż wymaga ta strona? */
function serwerZaStary() {
  return !!(S.stan && S.stan.wersja && porownajWersje(S.stan.wersja, MIN_WERSJA_API) < 0);
}

/** r25: baner o rozjeździe wersji (serwer starszy niż strona) — pokazywany
 * nad listą w obu widokach; znika sam, gdy właściciel wdroży nowy kod. */
function banerWersji() {
  if (!serwerZaStary()) return '';
  return '<div class="baner-wersji">' +
    '<b>Strona jest nowsza niż silnik po stronie Google</b> ' +
    '(serwer: ' + esc(S.stan.wersja) + ', strona: ' + WERSJA_UI + '). ' +
    'Dodawanie i edycja grup nie zadziała, dopóki właściciel nie wgra nowego kodu: ' +
    'script.google.com → projekt Dziennika → zaznacz cały kod (Ctrl+A) → wklej nowy → zapisz (Ctrl+S) → ' +
    'Wdróż → Zarządzaj wdrożeniami → ✎ → Nowa wersja → Wdróż. Po ok. minucie odśwież stronę.' +
    '</div>';
}

/* r19→r25: komunikat gdy /exec nie odpowiada stronie. Dwie przyczyny:
 * dostęp „tylko ja" (401 bez CORS) albo MARTWY adres (usunięte wdrożenie —
 * r25: właśnie to się stało: aktualizacja przez usunięcie starego
 * wdrożenia zabija stary adres; nowe wdrożenie dostaje nowy URL). */
var PRZYCISK_DOSTEP =
  'Arkusz (API) nie odpowiada stronie. Najczęstsze przyczyny:\n' +
  '1) We wdrożeniu „Kto ma dostęp” nie stoi „Każdy” — Właścicielu: Apps Script → Wdróż → ' +
  'Zarządzaj wdrożeniami → ✎ → „Kto ma dostęp”: Każdy → Wdróż.\n' +
  '2) Adres wdrożenia przestał działać — np. przy aktualizacji usunięto stare wdrożenie ' +
  '(usunięty adres nie wraca, każde nowe wdrożenie dostaje NOWY adres). Właścicielu: ' +
  'Wdróż → Zarządzaj wdrożeniami → skopiuj adres istniejącego wdrożenia (ikonka 🌐, ' +
  'kończy się na /exec) i prześlij go Zetowi — wpisze go w konfiguracji strony.';

/* ------------------------------------------------ konfiguracja (config.js + localStorage + #hash) */
var K = (function () {
  var dane = { API: '', KLUCZ: '' };
  // plik config.js = wgłębiona konfiguracja strony (r19: to co Zet wgrywa
  // na stałe do GitHuba jest źródłem prawdy dla wszystkich odwiedzających)
  if (typeof KONFIG === 'object' && KONFIG) {
    if (KONFIG.API) dane.API = String(KONFIG.API);
    if (KONFIG.KLUCZ) dane.KLUCZ = String(KONFIG.KLUCZ);
  }
  // localStorage (karta ustawień / link z hashem) wygrywa TYLKO gdy
  // sensowny format — śmieć (np. backtick z r17) nie może blokować
  // wgłębionego configu po stronie właściciela
  try {
    var zapisane = JSON.parse(localStorage.getItem('konfig') || '{}');
    if (/^https:\/\/.+\/exec$/.test(String(zapisane.API || ''))) dane.API = String(zapisane.API);
    if (/^[\w.-]+\.apps\.googleusercontent\.com$/.test(String(zapisane.KLUCZ || ''))) dane.KLUCZ = String(zapisane.KLUCZ);
  } catch (ign) { }
  // link dla trenerów: …/#api=…&klucz=… (zapisujemy raz, potem z hashu można
  // korzystać wielokrotnie — hash nie zostaje w historii przeglądarki)
  var czesci = (location.hash || '').replace(/^#/, '').split('&');
  var zLinku = false;
  czesci.forEach(function (c) {
    var m = /^(api|klucz)=(.+)$/.exec(decodeURIComponent(c));
    if (!m) return;
    if (m[1] === 'api' && m[2]) { dane.API = m[2]; zLinku = true; }
    if (m[1] === 'klucz' && m[2]) { dane.KLUCZ = m[2]; zLinku = true; }
  });
  if (zLinku) {
    try { localStorage.setItem('konfig', JSON.stringify(dane)); } catch (ign) { }
    history.replaceState(null, '', location.pathname); // czyścimy hash
  }
  return dane;
})();

function zapiszKonfiguracje(api, klucz) {
  K.API = String(api || '').trim();
  K.KLUCZ = String(klucz || '').trim();
  try { localStorage.setItem('konfig', JSON.stringify(K)); } catch (ign) { }
}

/* ------------------------------------------------ warstwa API (fetch → /exec) */
function wywolaj(akcja, dane, cb) {
  if (!K.API) {
    // strona jeszcze niepodłączona do arkusza — nie strzelamy fetchem
    // w samą siebie (r17: stąd brał się „JSON.parse: unexpected character")
    cb({ message: 'Strona nie ma jeszcze połączenia z arkuszem — właściciel kończy podłączenie (brakuje adresu API).' });
    return;
  }
  var body = Object.assign({ akcja: akcja }, dane || {});
  fetch(K.API, {
    method: 'POST',
    // text/plain = proste żądanie CORS (bez preflight OPTIONS,
    // którego Apps Script nie obsługuje)
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  }).then(function (odp) {
    // Apps Script odpowiada JSON-em; zły adres potrafi zwrócić stronę
    // HTML (np. 404) — wtedy czytelny komunikat, nie „JSON.parse:…"
    return odp.text();
  }).then(function (tekst) {
    var wynik;
    try { wynik = JSON.parse(tekst); }
    catch (nieJson) {
      // r19: Apps Script z dostępem „tylko ja" odsyła stronę HTML (401)
      // — poznamy po sygnaturze Google, gdy treść jest czytelna
      if (/^\s*<!DOCTYPE/i.test(tekst) &&
          /ppConfig|accounts\.google\.com|googleusercontent|ServiceLogin/i.test(tekst)) {
        cb(null, { ok: false, blad: 'DOSTEP_ZABRONIONY' });
        return;
      }
      cb({ message: 'Pod tym adresem nie ma naszego API — sprawdź, czy adres kończy się na /exec (Wdróż → Zarządzaj wdrożeniami → 🌐).' });
      return;
    }
    cb(null, wynik);
  }).catch(function (bladSieci) {
    // r19: Google przy 401 NIE wysyła nagłówków CORS → przeglądarka
    // widzi zwykły błąd sieci. Adres w script.google.com + ten błąd
    // = niemal na pewno wdrożenie z dostępem „tylko ja”.
    if (/script\.google\.com/.test(K.API)) {
      cb(null, { ok: false, blad: 'DOSTEP_ZABRONIONY' });
      return;
    }
    cb({ message: 'Brak połączenia z arkuszem (serwer nie odpowiada). Sprawdź internet i odśwież stronę; jeśli trwa to dłużej — zgłoś właścicielowi.' });
  });
}

/* token Google (GIS) — doklejany do KAŻDEGO żądania wymagającego logowania */
var TOKEN = '';

/* ------------------------------------------------ stan aplikacji */
var S = {
  stan: null,            // odpowiedź dajStan
  data: '',              // RRRR-MM-DD wybranej daty
  grupa: '*',            // '*' = wszystkie
  sortowanie: 'imie',    // 'imie' | 'nazwisko'
  szukane: '',
  trybCzlonkowie: false, // czy otwarty widok członków
  tapy: {},              // { idZawodnika: {n: liczba tapów, t: timestamp} }
  timery: {},            // timery resetu tapów per zawodnik
  wisiace: {}            // { idZawodnika: 'zapis'|'usun'|'blad' }
};

/* ------------------------------------------------ pomocnicze */
function lokalnaData(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function polskieDni(dzien) {
  return ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'][dzien];
}
function dlugaData(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return polskieDni(d.getDay()) + ', ' + Number(m[3]) + ' ' +
    ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca',
     'sierpnia', 'września', 'października', 'listopada', 'grudnia'][d.getMonth()] +
    ' ' + m[1];
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ------------------------------------------------ render główny */
function renderuj() {
  var app = document.getElementById('app');

  if (!S.stan) {
    app.innerHTML = '<div class="ekran-pelny"><div class="spinner"></div><p>Ładowanie…</p></div>';
    return;
  }
  if (S.stan.brakDostepu) {
    if (S.stan.arkuszBrak) {
      app.innerHTML =
        '<div class="ekran-pelny">' +
        '<h1>Problem z arkuszem</h1>' +
        '<p>Aplikacja nie może teraz dosięgnąć arkusza Google klubu (błąd po stronie API).</p>' +
        '<p><b>Co zrobić:</b> odśwież stronę za chwilę; jeśli problem trwa, zgłoś to właścicielowi (menu 📗 w arkuszu → „Pokaż wersję i stan").</p>' +
        '<button class="btn-glowny" style="padding:12px 20px;border:none;border-radius:10px" onclick="location.reload()">Spróbuj ponownie</button>' +
        '<p style="font-size:.8rem">' + WERSJA_UI + '</p>' +
        '</div>';
      return;
    }
    app.innerHTML =
      '<div class="ekran-pelny">' +
      '<h1>Brak dostępu</h1>' +
      (S.stan.pustaLista
        ? '<p>Biała lista jest jeszcze pusta. Właściciel musi dodać adresy e-mail w zakładce <b>Biala_lista</b> w arkuszu.</p>'
        : '<p>Konto <b>' + esc(S.stan.email || '(nieznane)') + '</b> nie ma dostępu do dziennika.</p>' +
          '<p>Poproś właściciela klubu o dodanie Twojego adresu do białej listy (zakładka <b>Biala_lista</b> w arkuszu) — potem odśwież tę stronę.</p>') +
      '<button class="link-tryb" onclick="wyloguj()">Zaloguj się jako ktoś inny</button>' +
      '<p style="font-size:.8rem">' + WERSJA_UI + '</p>' +
      '</div>';
    return;
  }

  if (S.trybCzlonkowie) { renderujCzlonkow(app); return; }

  var lista = widoczni();
  var obecnosciDzien = (S.stan.obecnosci[S.data] || []);
  var ileObecnych = lista.filter(function (z) { return obecnosciDzien.indexOf(z.id) !== -1; }).length;

  var html =
    '<div class="topbar">' +
      '<div class="rzad1">' +
        '<span class="tytul">Obecność</span>' +
        '<span class="licznik">' + ileObecnych + '/' + lista.length + ' obecnych</span>' +
        '<button class="btn-ikona" id="btn-czlonkowie" title="Członkowie">👥 Członkowie</button>' +
      '</div>' +
      '<div class="rzad2">' +
        '<span class="btn-data">📅 <input type="date" class="data-input" id="data" value="' + S.data + '" max="' + lokalnaData(new Date()) + '"></span>' +
        '<input class="szukaj" id="szukaj" type="search" placeholder="Szukaj…" value="' + esc(S.szukane) + '">' +
        '<div class="przelacznik">' +
          '<button id="sort-imie" class="' + (S.sortowanie === 'imie' ? 'on' : '') + '">A→Z imię</button>' +
          '<button id="sort-nazwisko" class="' + (S.sortowanie === 'nazwisko' ? 'on' : '') + '">A→Z nazwisko</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="grupy">' +
      przyciskGrupy('*', 'Wszystkie') +
      S.stan.grupy.map(function (g) {
        return przyciskGrupy(g.kod, g.nazwa || g.kod);
      }).join('') +
      // r24: zarządzanie grupami z apki („zmiany tylko przez apkę");
      // puste grupy w arkuszu = ten jedyny przycisk zamiast pustego paska
      (S.stan.grupy.length === 0
        ? '<button data-grupa="__nowa" class="grupa-nowa" title="Dodaj pierwszą grupę">＋ Dodaj grupę</button>'
        : '<button data-grupa="__nowa" class="grupa-nowa" title="Dodaj grupę">＋</button>') +
    '</div>' +
    banerWersji() +
    '<div class="lista">' +
      lista.map(kafelHtml).join('') +
      (lista.length === 0 ? '<p class="oplucie" style="text-align:center">Brak zawodników spełniających kryteria.</p>' : '') +
    '</div>' +
    '<div class="stopka">' +
      '<p class="wersja">' + esc(S.stan.email) + ' · strona ' + WERSJA_UI + ' · serwer ' + esc(S.stan.wersja || '?') + '</p>' +
      '<div class="wiersz">' +
        '<button class="on" id="stopka-obecnosc">📋 Obecność</button>' +
        '<button id="stopka-czlonkowie">👥 Członkowie</button>' +
      '</div>' +
    '</div>';

  app.innerHTML = html;
  podpinz();
}

function przyciskGrupy(kod, etykieta) {
  return '<button data-grupa="' + esc(kod) + '" class="' + (S.grupa === kod ? 'on' : '') + '">' + esc(etykieta) + '</button>';
}

/* r24: modal dodania/edycji grupy. Nowa grupa → dodajGrupe; istniejąca
 * → edytujGrupe (kod nietykalny — odnoszą się do niego uczestnicy).
 * Usuwanie: tylko istniejącej, z potwierdzeniem i liczbą zawodników. */
function modalGrupy(g) {
  var nowa = !g;
  var tlo = document.createElement('div');
  tlo.className = 'tlo-modal';
  tlo.innerHTML =
    '<div class="modal">' +
      '<h2>' + (nowa ? '＋ Dodaj grupę' : 'Grupa ' + esc(g.kod)) + '</h2>' +
      (nowa ? '<label>Kod grupy (np. GR1)</label>' +
        '<input id="f-gkod" placeholder="GR1" autocomplete="off" spellcheck="false">' : '') +
      '<label>Nazwa (opcjonalnie)</label>' +
      '<input id="f-gnazwa" placeholder="np. Środa początkujący" value="' + esc(nowa ? '' : (g.nazwa || '')) + '" autocomplete="off">' +
      '<label>Dni treningów (opcjonalnie)</label>' +
      '<input id="f-gdni" placeholder="np. pn, śr, czw" value="' + esc(nowa ? '' : (g.dni || '')) + '" autocomplete="off">' +
      '<div class="przyciski">' +
        (nowa ? '' : '<button class="btn-drugi" id="f-gusun" style="color:var(--blad)">Usuń grupę</button>') +
        '<button class="btn-drugi" id="f-ganuluj">Anuluj</button>' +
        '<button class="btn-glowny" id="f-gzapisz">' + (nowa ? 'Dodaj' : 'Zapisz') + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(tlo);
  tlo.querySelector('#f-ganuluj').addEventListener('click', function () { tlo.remove(); });

  if (!nowa) {
    tlo.querySelector('#f-gusun').addEventListener('click', function () {
      var ile = S.stan.zawodnicy.filter(function (z) { return z.grupa === g.kod && z.aktywny; }).length;
      if (!confirm('Usunąć grupę ' + g.kod + (g.nazwa ? ' (' + g.nazwa + ')' : '') + '?\n' +
          'Zawodników w tej grupie: ' + ile + '.\n' +
          'Zawodnicy zostają w arkuszu — przydzielisz ich do innej grupy przy edycji.')) return;
      wywolaj('usunGrupe', { token: TOKEN, kod: g.kod }, function (e, w) {
        tlo.remove();
        if (e) { alert('Błąd: ' + e.message); return; }
        if (!w.ok) { bladModalny(w); return; }
        if (S.grupa === g.kod) S.grupa = '*';
        odswiezStan();
      });
    });
  }

  tlo.querySelector('#f-gzapisz').addEventListener('click', function () {
    var kod = nowa
      ? (tlo.querySelector('#f-gkod').value || '').trim().toUpperCase().replace(/\s+/g, '')
      : g.kod;
    var nazwa = (tlo.querySelector('#f-gnazwa').value || '').trim();
    var dni = (tlo.querySelector('#f-gdni').value || '').trim();
    if (!kod) { alert('Podaj kod grupy (np. GR1).'); return; }
    var zakoncz = function (e, w) {
      if (e) { alert('Błąd zapisu: ' + e.message); return; }
      if (!w.ok) { bladModalny(w); return; }
      tlo.remove();
      odswiezStan();
    };
    if (nowa) wywolaj('dodajGrupe', { token: TOKEN, kod: kod, nazwa: nazwa, dni: dni }, zakoncz);
    else wywolaj('edytujGrupe', { token: TOKEN, kod: kod, nazwa: nazwa, dni: dni }, zakoncz);
  });
}

function widoczni() {
  var sortImie = S.sortowanie === 'imie';
  var lista = S.stan.zawodnicy.filter(function (z) {
    if (!z.aktywny) return false;
    if (S.grupa !== '*' && z.grupa !== S.grupa) return false;
    if (S.szukane) {
      var sz = S.szukane.toLowerCase();
      if ((z.imie + ' ' + z.nazwisko).toLowerCase().indexOf(sz) === -1) return false;
    }
    return true;
  });
  lista.sort(function (a, b) {
    return sortImie
      ? a.imie.localeCompare(b.imie, 'pl') || a.nazwisko.localeCompare(b.nazwisko, 'pl')
      : a.nazwisko.localeCompare(b.nazwisko, 'pl') || a.imie.localeCompare(b.imie, 'pl');
  });
  return lista;
}

/* kafel zawodnika — stan wizualny zależny od tapów i synchronizacji */
function kafelHtml(z) {
  var dzien = S.stan.obecnosci[S.data] || [];
  var obecny = dzien.indexOf(z.id) !== -1;
  var tap = S.tapy[z.id];
  var wisi = S.wisiace[z.id];
  var klasy = 'kafel';
  if (wisi === 'blad') klasy += ' blad';
  else if (tap && tap.n >= 2) klasy += ' potwierdz';
  else if (wisi) klasy += ' synchronizacja';
  else if (obecny) klasy += ' obecny';

  var status = '<span class="status">✓</span>';
  if (wisi === 'zapis') status = '<span class="status">…</span>';
  else if (wisi === 'usun') status = '<span class="status usun">…</span>';
  else if (wisi === 'blad') status = '<span class="status">!</span>';
  else if (tap && tap.n >= 2) status = '<span class="status usun">×' + tap.n + '</span>';
  else if (obecny) status = '<span class="status">✓</span>';

  return '<button class="' + klasy + '" data-id="' + esc(z.id) + '">' +
    '<span class="wiersz-nazwy"><span class="nazwa"><b>' +
    (S.sortowanie === 'nazwisko'
      ? esc(z.nazwisko + ' ' + z.imie)
      : esc(z.imie + ' ' + z.nazwisko)) +
    '</b></span>' + status + '</span>' +
    '<span class="grupa-etykieta">' + esc(z.grupa) + '</span>' +
    '</button>';
}

/* tap w kafel: nieobecny → zapis; obecny → licznik do 3 → usunięcie */
function tapZawodnika(z) {
  var dzien = S.stan.obecnosci[S.data] || [];

  if (dzien.indexOf(z.id) === -1) {
    // nieobecny → zapis
    dzien.push(z.id);
    S.stan.obecnosci[S.data] = dzien;
    S.wisiace[z.id] = 'zapis';
    renderuj();
    wywolaj('zapiszObecnosc', { token: TOKEN, id: z.id, data: S.data }, function (e, w) {
      delete S.wisiace[z.id];
      if (e || !w.ok) { obsluzBlad(e, w); return; }
      renderuj();
    });
    return;
  }

  // obecny → licznik tapów do 3
  var tap = S.tapy[z.id] || { n: 0, t: 0 };
  tap.n += 1;
  tap.t = Date.now();
  S.tapy[z.id] = tap;
  if (S.timery[z.id]) clearTimeout(S.timery[z.id]);
  if (tap.n < 3) {
    S.timery[z.id] = setTimeout(function () {
      delete S.tapy[z.id];
      delete S.timery[z.id];
      renderuj();
    }, 2000);
    renderuj();
    return;
  }

  // 3 tapy → usuń
  delete S.tapy[z.id];
  clearTimeout(S.timery[z.id]);
  delete S.timery[z.id];
  var idx = dzien.indexOf(z.id);
  if (idx !== -1) dzien.splice(idx, 1);
  S.stan.obecnosci[S.data] = dzien;
  S.wisiace[z.id] = 'usun';
  renderuj();
  wywolaj('usunObecnosc', { token: TOKEN, id: z.id, data: S.data }, function (e, w) {
    delete S.wisiace[z.id];
    if (e || !w.ok) { obsluzBlad(e, w); return; }
    renderuj();
  });
}

/* wspólna obsługa błędów API (protokół z doPost v0.2.0) */
function obsluzBlad(e, w) {
  var blad = e ? e.message : (w && w.blad);
  if (blad === 'ARKUSZ_BRAK') {
    S.wisiace = {};
    odswiezStan();
    return;
  }
  if (blad === 'BRAK_DOSTEPU' || blad === 'BLAD_TOKENA') {
    // sesja wygasła / token odrzucony / zdjęto z białej listy → logowanie
    TOKEN = '';
    S.stan = null;
    start();
    return;
  }
  // błąd akcji: oznacz kafel „Ponów" (jeden wspólny dymek na dole listy)
  S.bladAkcji = (w && w.opis) || blad || 'Nieznany błąd';
  renderuj();
}

/* r25: błąd akcji wywołanej Z MODALA — alert() przebija się przez
 * otwarte okno modalne (dymek „Ponów" rysuje się na liście POD modalem
 * i jest niewidoczny — stąd u właściciela „nic się nie dzieje").
 * Błędy sesji (BLAD_TOKENA / BRAK_DOSTEPU / ARKUSZ_BRAK) to zmiana
 * ekranu, nie komunikat — te kierujemy przez obsluzBlad jak dotąd. */
function bladModalny(w) {
  var blad = w && w.blad;
  if (blad === 'BLAD_TOKENA' || blad === 'BRAK_DOSTEPU' || blad === 'ARKUSZ_BRAK') {
    obsluzBlad(null, w);
    return;
  }
  if (blad === 'NIEZNANA_AKCJA') {
    alert('To działanie jest jeszcze nieznane dla silnika po stronie Google.' +
      (S.stan && S.stan.wersja ? '\nSerwer arkusza: ' + S.stan.wersja : '') +
      '\nStrona: ' + WERSJA_UI + '.' +
      '\n\nNajczęstsza przyczyna: strona jest już nowa, ale właściciel nie wgrał jeszcze nowego kodu do Apps Script.' +
      '\nInstrukcja: script.google.com → projekt Dziennika → zaznacz cały kod (Ctrl+A) → wklej nowy plik → zapisz (Ctrl+S) → Wdróż → Zarządzaj wdrożeniami → ✎ → Nowa wersja → Wdróż.' +
      '\nPotem odśwież stronę i spróbuj ponownie.');
    return;
  }
  alert('Operacja nie powiodła się: ' + ((w && w.opis) || blad || 'nieznany błąd') + '. Spróbuj ponownie.');
}

/* ------------------------------------------------ widok: członkowie */
function renderujCzlonkow(app) {
  var sortImie = S.sortowanie !== 'nazwisko';
  var wszyscy = S.stan.zawodnicy.slice().sort(function (a, b) {
    return sortImie
      ? a.imie.localeCompare(b.imie, 'pl') || a.nazwisko.localeCompare(b.nazwisko, 'pl')
      : a.nazwisko.localeCompare(b.nazwisko, 'pl') || a.imie.localeCompare(b.imie, 'pl');
  });
  var aktywni = wszyscy.filter(function (z) { return z.aktywny; });
  var nieaktywni = wszyscy.filter(function (z) { return !z.aktywny; });

  app.innerHTML =
    '<div class="topbar">' +
      '<div class="rzad1">' +
        '<span class="tytul">Członkowie (' + aktywni.length + ')</span>' +
        '<button class="btn-ikona" id="btn-import" title="Wklej listę zawodników (Nazwisko Imię)">⬇ Import</button>' +
        '<button class="btn-ikona" id="btn-dodaj">＋ Dodaj</button>' +
      '</div>' +
      '<div class="rzad2"><input class="szukaj" id="szukaj-czlonkowie" type="search" placeholder="Szukaj…" value="' + esc(S.szukane) + '"></div>' +
    '</div>' +
    '<div class="lista" style="display:block;max-width:720px">' +
      banerWersji() +
      wszyscy.filter(function (z) {
        if (!S.szukane) return true;
        var sz = S.szukane.toLowerCase();
        return (z.imie + ' ' + z.nazwisko).toLowerCase().indexOf(sz) !== -1;
      }).map(function (z) {
        return '<div class="wiersz-czlonka' + (z.aktywny ? '' : ' nieaktywny') + '" data-id="' + esc(z.id) + '">' +
          '<div class="dane"><b>' + (S.sortowanie === 'nazwisko'
            ? esc(z.nazwisko + ' ' + z.imie)
            : esc(z.imie + ' ' + z.nazwisko)) + '</b>' +
          '<small>' + esc(z.grupa) + ' · dołączył: ' + esc(z.dolaczyl || '—') +
            (z.ur ? ' · ur. ' + esc(z.ur) + ' (' + wiek(z.ur) + ' l.)' : '') +
            (z.aktywny ? '' : ' · NIEAKTYWNY') + '</small></div>' +
          '<div class="akcje">' +
            '<button data-akcja="edytuj" data-id="' + esc(z.id) + '">✏️ Edytuj</button>' +
            '<button data-akcja="przelacz" data-id="' + esc(z.id) + '">' + (z.aktywny ? '🚫 Deaktywuj' : '✔ Aktywuj') + '</button>' +
          '</div></div>';
      }).join('') +
      (nieaktywni.length ? '<p class="oplucie">Osoby nieaktywne nie pojawiają się na liście obecności; ich historia zostaje.</p>' : '') +
      (S.bladAkcji ? '<p class="oplucie" style="color:var(--blad)">Ostatnia operacja się nie powiodła: ' + esc(S.bladAkcji) + ' — spróbuj ponownie.</p>' : '') +
    '</div>' +
    '<div class="stopka">' +
      '<p class="wersja">' + esc(S.stan.email) + ' · strona ' + WERSJA_UI + ' · serwer ' + esc(S.stan.wersja || '?') + '</p>' +
      '<div class="wiersz">' +
        '<button id="stopka-obecnosc">📋 Obecność</button>' +
        '<button class="on" id="stopka-czlonkowie">👥 Członkowie</button>' +
      '</div>' +
    '</div>';

  podpinzCzlonkow();
}

/** Wiek z daty urodzenia RRRR-MM-DD (pełne lata; „?" gdy data bezsensowna). */
function wiek(ur) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ur || ''));
  if (!m) return '?';
  var d = new Date();
  var w = d.getFullYear() - Number(m[1]);
  var mies = d.getMonth() + 1 - Number(m[2]);
  if (mies < 0 || (mies === 0 && d.getDate() < Number(m[3]))) w--;
  return (w >= 0 && w < 130) ? String(w) : '?';
}

/** Import hurtowy: modal z polem na listę „Nazwisko Imię". */
function modalImportu() {
  var tlo = document.createElement('div');
  tlo.className = 'tlo-modal';
  tlo.innerHTML =
    '<div class="modal">' +
      '<h2>⬇ Import zawodników</h2>' +
      '<p style="font-size:.85rem;color:var(--szary);margin:0 0 6px">Wklej listę — jedna osoba na wiersz:' +
      ' <b>Nazwisko Imię</b>, opcjonalnie po przecinku grupa i data urodzenia (RRRR-MM-DD).' +
      ' Osoby już będące w arkuszu są pomijane (bez dublowania).</p>' +
      '<textarea id="f-import" rows="9" style="width:100%;border:1px solid var(--linia);border-radius:8px;padding:8px;font:inherit;font-size:.9rem" placeholder="Bochenek Bartosz&#10;Cygan Jakub, GR2&#10;Kotajny Karolina, GR1, 2008-04-12"></textarea>' +
      '<div class="przyciski">' +
        '<button class="btn-drugi" id="f-anuluj">Anuluj</button>' +
        '<button class="btn-glowny" id="f-importuj">Importuj</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(tlo);
  tlo.querySelector('#f-anuluj').addEventListener('click', function () { tlo.remove(); });
  tlo.querySelector('#f-importuj').addEventListener('click', function () {
    var tekst = tlo.querySelector('#f-import').value;
    if (!tekst.trim()) { alert('Wklej najpierw listę zawodników.'); return; }
    var btn = tlo.querySelector('#f-importuj');
    btn.disabled = true; btn.textContent = 'Importuję…';
    wywolaj('importujUczestnikow', { token: TOKEN, tekst: tekst }, function (e, w) {
      tlo.remove();
      if (e) { alert('Błąd importu: ' + e.message); return; }
      if (!w.ok) { bladModalny(w); return; }
      var raport = 'Dodano: ' + w.dodano + ' · pominięto (już są): ' + w.pominieto;
      if (w.bledy && w.bledy.length) {
        raport += '\n\nWiersze z problemami (popraw i wklej ponownie tylko te):\n' + w.bledy.join('\n');
      }
      alert(raport);
      odswiezStan();
    });
  });
}

function modalDodajEdytuj(z) {
  var tlo = document.createElement('div');
  tlo.className = 'tlo-modal';
  var kody = S.stan.grupy.map(function (g) { return g.kod; });
  var grupyOpcje = S.stan.grupy.slice();
  if (z && z.grupa && kody.indexOf(z.grupa) === -1) {
    grupyOpcje.push({ kod: z.grupa, nazwa: '' });
  }
  // r24: brak grup w arkuszu → nie da się dodać członka (grupa wymagana);
  // kierujemy na ＋ zamiast cichego domyślnego GR1 (apka = jedyny interfejs)
  if (grupyOpcje.length === 0) {
    alert('Najpierw dodaj grupę (przycisk ＋ na liście obecności), potem dodawaj zawodników.');
    return;
  }
  tlo.innerHTML =
    '<div class="modal">' +
      '<h2>' + (z ? 'Edytuj członka' : 'Dodaj członka') + '</h2>' +
      '<label>Imię</label><input id="f-imie" value="' + esc(z ? z.imie : '') + '" autocomplete="off">' +
      '<label>Nazwisko</label><input id="f-nazwisko" value="' + esc(z ? z.nazwisko : '') + '" autocomplete="off">' +
      '<label>Data urodzenia (opcjonalnie)</label>' +
      '<input id="f-ur" type="date" value="' + esc(z ? (z.ur || '') : '') + '" max="' + lokalnaData(new Date()) + '">' +
      '<label>Grupa</label>' +
      '<select id="f-grupa">' +
        grupyOpcje.map(function (g) {
          return '<option value="' + esc(g.kod) + '">' + esc(g.nazwa ? g.nazwa + ' (' + g.kod + ')' : g.kod) + '</option>';
        }).join('') +
        '<option value="__nowa">+ nowa grupa (wpisz niżej)…</option>' +
      '</select>' +
      '<label id="lbl-nowa" style="display:none">Nazwa nowej grupy (np. GR3)</label>' +
      '<input id="f-nowa" style="display:none" placeholder="GR3" autocomplete="off">' +
      '<div class="przyciski">' +
        '<button class="btn-drugi" id="f-anuluj">Anuluj</button>' +
        '<button class="btn-glowny" id="f-zapisz">' + (z ? 'Zapisz zmiany' : 'Dodaj') + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(tlo);

  var sel = tlo.querySelector('#f-grupa');
  if (z) sel.value = z.grupa;
  sel.addEventListener('change', function () {
    var nowa = sel.value === '__nowa';
    tlo.querySelector('#lbl-nowa').style.display = nowa ? 'block' : 'none';
    tlo.querySelector('#f-nowa').style.display = nowa ? 'block' : 'none';
  });
  tlo.querySelector('#f-anuluj').addEventListener('click', function () { tlo.remove(); });
  tlo.querySelector('#f-zapisz').addEventListener('click', function () {
    var imie = tlo.querySelector('#f-imie').value.trim();
    var nazwisko = tlo.querySelector('#f-nazwisko').value.trim();
    var ur = tlo.querySelector('#f-ur').value;
    var grupa = sel.value === '__nowa'
      ? tlo.querySelector('#f-nowa').value.trim().toUpperCase().replace(/\s+/g, '')
      : sel.value;
    if (!imie || !nazwisko) { alert('Imię i nazwisko są wymagane.'); return; }
    // r24: grupa JAWNIE wymagana — bez cichego domyślnego GR1 (grupy
    // prowadzi wyłącznie arkusz Grupy, apka niczego nie wymyśla)
    if (sel.value === '__nowa' && !grupa) { alert('Podaj kod nowej grupy (np. GR1).'); return; }
    if (!grupa) { alert('Wybierz grupę (albo utwórz nową).'); return; }

    var zakoncz = function (e, w) {
      tlo.remove();
      if (e) { alert('Błąd zapisu: ' + e.message); return; }
      if (!w.ok) { bladModalny(w); return; }
      odswiezStan();
    };
    if (z) wywolaj('edytujCzlonka', { token: TOKEN, id: z.id, imie: imie, nazwisko: nazwisko, grupa: grupa, ur: ur }, zakoncz);
    else wywolaj('dodajCzlonka', { token: TOKEN, imie: imie, nazwisko: nazwisko, grupa: grupa, ur: ur }, zakoncz);
  });
}

/* ------------------------------------------------ odświeżanie */
function odswiezStan(cb) {
  wywolaj('dajStan', { token: TOKEN }, function (e, w) {
    if (e) {
      document.getElementById('app').innerHTML =
        '<div class="ekran-pelny"><h1 class="blad-tekst">Błąd połączenia</h1>' +
        '<p>' + esc(e.message) + '</p>' +
        '<div class="przyciski" style="display:flex;gap:10px;margin-top:8px">' +
        '<button class="btn-glowny" style="border:none;border-radius:10px;padding:12px 20px" onclick="location.reload()">Odśwież</button></div>' +
        '<p style="font-size:.8rem;color:var(--szary)">To zwykle chwilowa niedostępność. Jeśli trwa — zgłoś właścicielowi.</p></div>';
      return;
    }
    if (w && w.blad === 'BLAD_TOKENA') { TOKEN = ''; start(); return; }
    if (w && w.blad === 'ARKUSZ_BRAK') {
      S.stan = { arkuszBrak: true, brakDostepu: true };
      renderuj();
      if (cb) cb();
      return;
    }
    if (w && w.blad === 'BRAK_DOSTEPU') {
      // odmowa z API (e-mail poza białą listą) → ekran odmowy (nie crash
      // na pustym stanie — bug znaleziony testem E2E rundy 17)
      S.stan = { brakDostepu: true, email: w.email, pustaLista: !!w.pustaLista };
      renderuj();
      if (cb) cb();
      return;
    }
    S.stan = w;
    if (!S.data) S.data = w.dzisiaj || lokalnaData(new Date());
    if (!S.sortowanie) S.sortowanie = (w.ustawienia && w.ustawienia.SORTOWANIE_DOMYSLNE) || 'imie';
    var zapisane = null;
    try { zapisane = localStorage.getItem('sortowanie'); } catch (ign) {}
    if (zapisane === 'imie' || zapisane === 'nazwisko') S.sortowanie = zapisane;
    if (cb) cb(); else renderuj();
  });
}

/* ------------------------------------------------ podpinanie zdarzeń */
function podpinz() {
  var el = function (id) { return document.getElementById(id); };

  if (el('data')) el('data').addEventListener('change', function () {
    S.data = this.value || lokalnaData(new Date());
    renderuj();
  });
  if (el('szukaj')) el('szukaj').addEventListener('input', function () {
    S.szukane = this.value;
    var kontener = document.querySelector('.lista');
    var lista = widoczni();
    kontener.innerHTML = lista.map(kafelHtml).join('') +
      (S.bladAkcji ? dymekBledu() : '') ||
      '<p class="oplucie" style="text-align:center">Brak zawodników spełniających kryteria.</p>';
    podpinzKafelki();
    aktualizujLicznik();
  });
  if (el('sort-imie')) el('sort-imie').addEventListener('click', function () {
    ustawSortowanie('imie');
  });
  if (el('sort-nazwisko')) el('sort-nazwisko').addEventListener('click', function () {
    ustawSortowanie('nazwisko');
  });
  if (el('btn-czlonkowie')) el('btn-czlonkowie').addEventListener('click', function () {
    S.trybCzlonkowie = true; S.szukane = ''; renderuj();
  });
  if (el('stopka-obecnosc')) el('stopka-obecnosc').addEventListener('click', function () {
    S.trybCzlonkowie = false; S.szukane = ''; renderuj();
  });
  if (el('stopka-czlonkowie')) el('stopka-czlonkowie').addEventListener('click', function () {
    S.trybCzlonkowie = true; S.szukane = ''; renderuj();
  });

  document.querySelectorAll('.grupy button').forEach(function (b) {
    b.addEventListener('click', function () {
      var kod = this.getAttribute('data-grupa');
      if (kod === '__nowa') { modalGrupy(null); return; } // r24: ➕ w pasku grup
      // r24: tap w JUŻ wybrany przycisk = edycja grupy (filtr jest aktywny,
      // to nie pomyli się z przełączaniem; "*" nie edytujemy)
      if (kod !== '*' && S.grupa === kod) {
        var g = null;
        S.stan.grupy.forEach(function (x) { if (x.kod === kod) g = x; });
        if (g) { modalGrupy(g); return; }
      }
      S.grupa = kod;
      renderuj();
    });
  });

  podpinzKafelki();
}

function dymekBledu() {
  return '<div class="ponow"><span>Ostatnia operacja nie powiodła się: ' + esc(S.bladAkcji) +
    '</span><button onclick="sprobujPonownie()">Ponów</button></div>';
}

function sprobujPonownie() {
  S.bladAkcji = null;
  renderuj();
  odswiezStan();
}

function podpinzKafelki() {
  document.querySelectorAll('.kafel').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = this.getAttribute('data-id');
      var z = null;
      S.stan.zawodnicy.forEach(function (x) { if (x.id === id) z = x; });
      if (z) tapZawodnika(z);
    });
  });
}

function ustawSortowanie(w) {
  S.sortowanie = w;
  try { localStorage.setItem('sortowanie', w); } catch (ign) {}
  renderuj();
}

function aktualizujLicznik() {
  var el = document.querySelector('.licznik');
  if (!el) return;
  var lista = widoczni();
  var dzien = S.stan.obecnosci[S.data] || [];
  var ile = lista.filter(function (z) { return dzien.indexOf(z.id) !== -1; }).length;
  el.textContent = ile + '/' + lista.length + ' obecnych';
}

function podpinzCzlonkow() {
  var sz = document.getElementById('szukaj-czlonkowie');
  if (sz) sz.addEventListener('input', function () {
    S.szukane = this.value;
    var sortImie = S.sortowanie !== 'nazwisko';
    var wszyscy = S.stan.zawodnicy.slice().sort(function (a, b) {
      return sortImie
        ? a.imie.localeCompare(b.imie, 'pl') || a.nazwisko.localeCompare(b.nazwisko, 'pl')
        : a.nazwisko.localeCompare(b.nazwisko, 'pl') || a.imie.localeCompare(b.imie, 'pl');
    });
    var html = wszyscy.filter(function (z) {
      if (!S.szukane) return true;
      var s = S.szukane.toLowerCase();
      return (z.imie + ' ' + z.nazwisko).toLowerCase().indexOf(s) !== -1;
    }).map(function (z) {
      return '<div class="wiersz-czlonka' + (z.aktywny ? '' : ' nieaktywny') + '" data-id="' + esc(z.id) + '">' +
        '<div class="dane"><b>' + (S.sortowanie === 'nazwisko'
          ? esc(z.nazwisko + ' ' + z.imie)
          : esc(z.imie + ' ' + z.nazwisko)) + '</b>' +
        '<small>' + esc(z.grupa) + ' · dołączył: ' + esc(z.dolaczyl || '—') + (z.aktywny ? '' : ' · NIEAKTYWNY') + '</small></div>' +
        '<div class="akcje">' +
          '<button data-akcja="edytuj" data-id="' + esc(z.id) + '">✏️ Edytuj</button>' +
          '<button data-akcja="przelacz" data-id="' + esc(z.id) + '">' + (z.aktywny ? '🚫 Deaktywuj' : '✔ Aktywuj') + '</button>' +
        '</div></div>';
    }).join('');
    var kontener = document.querySelector('.lista');
    kontener.innerHTML = html + (wszyscy.some(function (z) { return !z.aktywny; })
      ? '<p class="oplucie">Osoby nieaktywne nie pojawiają się na liście obecności; ich historia zostaje.</p>' : '');
    podpinzAkcjeCzlonkow();
  });

  document.getElementById('btn-import').addEventListener('click', function () { modalImportu(); });
  document.getElementById('btn-dodaj').addEventListener('click', function () { modalDodajEdytuj(null); });
  document.getElementById('stopka-obecnosc').addEventListener('click', function () {
    S.trybCzlonkowie = false; S.szukane = ''; renderuj();
  });
  podpinzAkcjeCzlonkow();
}

function podpinzAkcjeCzlonkow() {
  document.querySelectorAll('button[data-akcja]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = this.getAttribute('data-id');
      var akcja = this.getAttribute('data-akcja');
      var z = null;
      S.stan.zawodnicy.forEach(function (x) { if (x.id === id) z = x; });
      if (!z) return;

      if (akcja === 'edytuj') { modalDodajEdytuj(z); return; }

      var nowyStan = !z.aktywny;
      if (nowyStan === false &&
          !confirm('Deaktywować ' + z.imie + ' ' + z.nazwisko + '?\nZniknie z listy obecności, historia zostanie zachowana.')) {
        return;
      }
      wywolaj('przelaczAktywnosc', { token: TOKEN, id: z.id, aktywny: nowyStan }, function (e, w) {
        if (e) { alert('Błąd: ' + e.message); return; }
        if (!w.ok) { obsluzBlad(null, w); return; }
        z.aktywny = nowyStan;
        renderuj();
      });
    });
  });
}

/* ------------------------------------------------ logowanie (Google Identity Services) */
/** Zmiana konta: zrywamy token, wyłączamy auto-wybór konta GIS, przeładowanie.
 * UWAGA: konfiguracja (API/klucz) zostaje — to ustawienia strony, nie sesji. */
function wyloguj() {
  TOKEN = '';
  try {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
  } catch (ign) { }
  location.reload();
}

function pokazLogowanie(komunikat) {
  var app = document.getElementById('app');
  // co brakuje do pełnego działania (r17: ekran logowania ma być PIERWSZY
  // i ALWAYS — informacja o brakach to żółta kartka, nie karta ustawień)
  var braki = [];
  if (!K.API) braki.push('adres API (wdrożenie Apps Script)');
  if (!K.KLUCZ) braki.push('Client ID (logowanie Google)');
  app.innerHTML =
    '<div class="ekran-pelny logowanie">' +
      '<div class="logo">🏓</div>' +
      '<h1>Dziennik Obecności</h1>' +
      '<p>KTS Gliwice — zapis obecności na treningach.<br>Zaloguj się kontem Google, na które właściciel klubu dał Ci dostęp.</p>' +
      (komunikat ? '<p style="color:var(--blad);font-size:.9rem">' + esc(komunikat) + '</p>' : '') +
      (braki.length
        ? '<div style="background:#fff7e0;border:1px solid #e6c96a;border-radius:10px;padding:10px 14px;margin:6px 0 2px;max-width:420px;font-size:.85rem;color:#6b5b1e;text-align:left">' +
            '⏳ Strona czeka na dokończenie podłączenia do arkusza przez właściciela (brakuje: ' + esc(braki.join(' i ')) + ').' +
            ' Gdy je uzupełni, przycisk poniżej od razu zadziała.</div>'
        : '') +
      '<div class="przycisk-w-srodku" id="przycisk-google"></div>' +
      '<p id="google-info" style="font-size:.85rem;color:var(--szary);max-width:420px;margin:4px 0"></p>' +
      '<p style="font-size:.75rem;color:var(--szary)">' + WERSJA_UI + '</p>' +
      '<button class="link-tryb" onclick="pokazKonfiguracje()" style="font-size:.72rem">Ustawienia strony (dla właściciela)</button>' +
    '</div>';
  zainicjujGoogle();
}

function zainicjujGoogle() {
  if (!K.KLUCZ) {
    // bez Client ID Google nie obsłuży logowania (wymóg Google, nie nasz) —
    // pokazujemy przycisk w stanie „jeszcze nieaktywny" i uczciwie mówimy,
    // co się stanie po kliknięciu; NIE ukrywamy całego ekranu logowania
    var pojemnik = document.getElementById('przycisk-google');
    if (!pojemnik) return;
    pojemnik.innerHTML =
      '<button id="btn-google-off" style="display:inline-flex;align-items:center;gap:10px;' +
        'background:#fff;border:1px solid #dadce0;border-radius:8px;min-height:44px;padding:0 18px;' +
        'font-size:.95rem;color:#3c4043;cursor:pointer;box-shadow:0 1px 2px rgba(60,64,67,.2)">' +
        '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.1 0 19.9 0 24s.9 7.9 2.6 11.3l7.8-6.6z"/><path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.5-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.7-3.8-13.6-9.1l-7.8 6.6C6.5 42.6 14.6 48 24 48z"/></svg>' +
        'Zaloguj się z Google' +
      '</button>';
    pojemnik.querySelector('#btn-google-off').addEventListener('click', function () {
      var info = document.getElementById('google-info');
      if (info) info.textContent =
        'Logowanie Google zacznie działać, gdy właściciel uzupełni brakujące ustawienia strony.' +
        ' Jeśli to Ty — wejdź w „Ustawienia strony” na dole.';
    });
    return;
  }
  // GIS ładuje się asynchronicznie — czekamy aż google.accounts stanie się dostępne
  var proby = 0;
  (function czekaj() {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: K.KLUCZ,
        callback: function (odp) { poZalogowaniu(odp.credential); }
      });
      google.accounts.id.renderButton(
        document.getElementById('przycisk-google'),
        { theme: 'outline', size: 'large', text: 'signin_with', locale: 'pl' }
      );
      return;
    }
    if (++proby < 40) setTimeout(czekaj, 250); // 10 s na załadowanie GIS
  })();
}

function poZalogowaniu(token) {
  TOKEN = token;
  document.getElementById('app').innerHTML =
    '<div class="ekran-pelny"><div class="spinner"></div><p>Sprawdzam dostęp…</p></div>';
  odswiezStan();
}

/* ------------------------------------- ustawienia strony (tylko gdy brak configu) */
function pokazKonfiguracje() {
  var tlo = document.createElement('div');
  tlo.className = 'tlo-modal';
  tlo.innerHTML =
    '<div class="modal">' +
      '<h2>Połącz stronę z arkuszem</h2>' +
      '<p style="font-size:.85rem;color:var(--szary);margin:0 0 4px">Strona (GitHub Pages) rozmawia z arkuszem Google przez API Apps Script.' +
      ' Wypełnia właściciel klubu — trenerzy dostają gotowy link i nic tu nie zmieniają.</p>' +
      '<label>Adres API (URL wdrożenia — kończy się na /exec)</label>' +
      '<input id="f-api" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(K.API) + '" autocomplete="off" spellcheck="false">' +
      '<label>Client ID OAuth (Google Cloud Console)</label>' +
      '<input id="f-klucz" placeholder="1234567890-abc…apps.googleusercontent.com" value="' + esc(K.KLUCZ) + '" autocomplete="off" spellcheck="false">' +
      '<div class="przyciski">' +
        '<button class="btn-drugi" id="f-anuluj">Anuluj</button>' +
        '<button class="btn-glowny" id="f-zapisz">Zapisz i sprawdź</button>' +
      '</div>' +
      '<p id="f-status" style="font-size:.85rem;color:var(--szary);margin:10px 0 0"></p>' +
      '<p style="font-size:.78rem;color:var(--szary);margin:12px 0 0">Link dla trenerów (skopiuj i wyślij):<br>' +
      '<span id="f-link" style="word-break:break-all"></span></p>' +
    '</div>';
  document.body.appendChild(tlo);
  var odswiezLink = function () {
    var baza = location.origin + location.pathname;
    tlo.querySelector('#f-link').textContent =
      baza + '#api=' + encodeURIComponent(tlo.querySelector('#f-api').value.trim()) +
      '&klucz=' + encodeURIComponent(tlo.querySelector('#f-klucz').value.trim());
  };
  odswiezLink();
  tlo.querySelector('#f-api').addEventListener('input', odswiezLink);
  tlo.querySelector('#f-klucz').addEventListener('input', odswiezLink);
  tlo.querySelector('#f-anuluj').addEventListener('click', function () { tlo.remove(); });
  tlo.querySelector('#f-zapisz').addEventListener('click', function () {
    var status = tlo.querySelector('#f-status');
    var api = tlo.querySelector('#f-api').value.trim();
    var klucz = tlo.querySelector('#f-klucz').value.trim();
    status.style.color = 'var(--blad)';
    // walidacja PRZED zapisem (r17: wklejony „`” kończył się JSON.parse…)
    if (!/^https:\/\/.+\/exec$/.test(api)) {
      status.textContent = '✗ Adres API powinien zaczynać się od https:// i kończyć na /exec. ' +
        'Skopiuj CAŁY adres z Apps Script: Wdróż → Zarządzaj wdrożeniami → ikona 🌐.';
      return;
    }
    if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(klucz)) {
      status.textContent = '✗ Client ID to ciąg kończący się na .apps.googleusercontent.com — ' +
        'skopiuj go z Google Cloud Console (APIs & Services → Credentials).';
      return;
    }
    status.style.color = 'var(--szary)';
    status.textContent = 'Sprawdzam połączenie z API…';
    zapiszKonfiguracje(api, klucz);
    // health-check: ping nie wymaga logowania
    wywolaj('ping', {}, function (e, w) {
      if (e) {
        status.style.color = 'var(--blad)';
        status.textContent = '✗ ' + e.message;
        return;
      }
      if (w && w.blad === 'DOSTEP_ZABRONIONY') {
        // r19: przeglądarka nie odróżnia 401 (dostęp „tylko ja”) od
        // nieistniejącego wdrożenia (Google w obu przypadkach blokuje
        // CORS) — mówimy o obu możliwościach, po ludzku
        status.style.color = 'var(--blad)';
        status.textContent = '✗ Nie mogę się połączyć. Dwie najczęstsze przyczyny: ' +
          '1) literówka w adresie (musi zaczynać się od https://script.google.com… i kończyć na /exec), ' +
          '2) we wdrożeniu „Kto ma dostęp” stoi coś innego niż „Każdy” — zmień: Apps Script → Wdróż → ' +
          'Zarządzaj wdrożeniami → ✎ → „Kto ma dostęp”: Każdy → Wdróż (adres się nie zmieni).';
        return;
      }
      if (!w || !w.ok) {
        status.style.color = 'var(--blad)';
        status.textContent = '✗ Pod tym adresem nie odpowiada nasze API. Sprawdź, czy wkleiłeś adres ' +
          'wdrożenia (kończy się na /exec) i czy wdrożenie jest opublikowane.';
        return;
      }
      status.style.color = 'var(--akcent)';
      status.textContent = '✓ Połączenie działa (API ' + w.api + '). Odświeżam stronę…';
      setTimeout(function () { location.reload(); }, 1000);
    });
  });
}

/* ------------------------------------------------ start */
function start() {
  // r17 (ekran logowania ma być PIERWSZY, zawsze): konfiguracja strony
  // nie blokuje wejścia — braki pokazuje żółta kartka na ekranie
  // logowania, kartę ustawień otwiera właściciel linkiem na dole.
  if (TOKEN) { odswiezStan(); return; }
  // jest API? → zdrowy ping (r19: wdrożenie z dostępem „tylko ja"
  // odpowiada 401 — wykrywamy i mówimy właścicielowi, co poprawić,
  // żeby trener nie widział tylko wiecznego kręcenia)
  if (K.API) {
    wywolaj('ping', {}, function (e, w) {
      if (!e && w && w.ok) { pokazLogowanie(); return; }
      pokazLogowanie(
        (!e && w && w.blad === 'DOSTEP_ZABRONIONY') ? PRZYCISK_DOSTEP :
        'Chwilowy problem z połączeniem z arkuszem — odśwież stronę za chwilę.');
    });
    return;
  }
  pokazLogowanie();
}

(function startAuto() { start(); })();
