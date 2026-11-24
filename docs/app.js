/* =================================================================
 * Dziennik Obecności KTS Gliwice — frontend v0.4.0
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
 *
 * r27 („grupa dodaje się dopiero po przelogowaniu"): dajStan tuż po
 * zapisie potrafi wrócić ze stanem sprzed zmiany — Google Sheets nie
 * gwarantuje spójności odczytu między kolejnymi wykonaniami Apps
 * Script. Stąd scalZmiane()/odswiezStan(proby, potwierdz): mutacja
 * jest NATYCHMIAST scalana lokalnie (optymistycznie), a dajStan
 * potwierdza ją z arkuszem (do 3 prób, po czym serwer wygrywa).
 * + layout: topbar Obecności w JEDNYM wierszu (Data, szukaj, sortowanie
 *   razem z tytułem; na telefonie zawija się do dwóch linii).
 *
 * r28 („ciągle muszę się logować — nawet po przeładowaniu strony"):
 * 1) SESJA ZAPAMIĘTANA: token GIS trzymamy w localStorage — F5/ponowne
 *    otwarcie strony wchodzi od razu do dziennika („Wracam do
 *    dziennika…"), bez klikania Google. Wygaśnięcie tokenu (~1 h) =
 *    BLAD_TOKENA → sprzątamy sesję i wracamy do ekranu logowania.
 *    „Wyloguj" (nowy link w stopce) czyści sesję na pewno.
 * 2) DOCIELOWE ODŚWIEŻANIE (zgodnie z ustaleniem): backend v0.2.6+
 *    dokleja do każdej odpowiedzi mutacji pełny „stan" z tego samego
 *    wykonania (spójny z zapisem) → przyjmijStan() bierze go bez
 *    dajStan ani retry. Dopóki serwer jest starszy, działa fallback
 *    z rundy 27 (merge lokalny + potwierdzany retry).
 *
 * r29 („zmienialiśmy layout, ale tylko desktop — teraz mobile"): telefon
 * ma inny priorytet niż desktop. Rządek topbara: „Obecność 3/4" (licznik
 * bez słowa „obecnych" — tytuł już mówi), 📅 23.11 (kompakt; klikiem
 * natywny picker), 🔍 (lupa rozwija pole szukaj w drugim wierszu), i
 * sortowanie (przełącznik A→Z imię/nazwisko). „👥 Członkowie" ZNIKA z
 * topbara — przejmuje je stały pasek na dole ekranu (istniejący od r6),
 * pod listą, zawsze pod kciukiem. Desktop BEZ zmian (r27).
 *
 * r30 („po kliknięciu przycisku uczestnika długo czekam na „Obecny""):
 * DWIE zmiany, ustalone z właścicielem:
 * 1) KOLEJKA FIFO obecności (całość ustaleń B z rundy 30): mutacje
 *    obecności lecą PO JEDNEJ (jedna w locie), w kolejności tapnięć.
 *    Koniec z równoległymi żądaniami, które serwer i tak serializuje
 *    LockService'm (10 s waitLock potrafił wybuchnąć przy serii
 *    szybkich tapnięć), a odpowiedzi mogły wrócić w złej kolejności
 *    i nadpisać stan starszą odpowiedzią. Koalescing per zawodnik:
 *    tapnięcie w trakcie oczekiwania nadpisuje intencję (zapis→usun
 *    = jedno żądanie „usun" zamiast dwóch). Błąd pojedynczej operacji
 *    = revert TYLKO tego kafla + dymek „Ponów"; kolejka leci dalej.
 *    Rozliczenie per-zawodnik z w.stan odpowiedzi (obecności dnia),
 *    nie całym stanem — odpowiedź wcześniejszego tapnięcia nie cofa
 *    optymistycznych znaczeń pozostałych kafli.
 * 2) Backend v0.2.7 (ustalenia A1+A4 z rundy 30): cache tokena GIS
 *    (5 min, SHA-256 klucz, tylko sukcesy) pomija UrlFetchApp do
 *    Google przy każdym żądaniu; skan idempotentności zapisu czyta
 *    ostatnie 300 wpisów zamiast 5000. Razem ~0,3–0,7 s szybsze
 *    potwierdzenie „✓" (reszta to infrastruktura Google — nie do
 *    ruszenia bez opuszczenia Apps Scriptu, świadomie odkładamy).
 *
 * r31 („frontend czasem sam się wylogowuje w trakcie wprowadzania
 * zmian — i zmiany nie docierają"): token GIS żyje ~1 h i wygasa
 * w POŁOWIE drainowania kolejki. Do v0.2.9 odpowiedź BLAD_TOKENA
 * czysciła kolejkę i wylogowywała (S.kolejka=[] + ekran logowania)
 * — nieodesłane kliknięcia przepadały bez śladu. Naprawa:
 * 1) BLAD_TOKENA z kolejki NIE wylogowuje: wpis „w locie" wraca na
 *    czoło kolejki (backend waliduje token PRZED wykonaniem akcji,
 *    więc operacja na pewno się NIE wykonała — a zapisy są
 *    idempotentne, ponowienie jest zawsze bezpieczne), wysyłka
 *    dostaje pauzę, a nad listą (kafelki z kropkami zostają widoczne
 *    pod spodem) pojawia się nakładka „Sesja wygasła" z przyciskiem
 *    Google. Ponowne zalogowanie (One Tap = często jeden klik)
 *    zdejmuje pauzę i kolejka sama się drenuje.
 * 2) KOLEJKA PAMIĘTANA: intencje {id, akcja, data} trzymamy w
 *    localStorage (jak sesję) — F5 czy zamknięcie karty w trakcie
 *    wysyłki NIE gubi kliknięć; po powrocie i zalogowaniu kolejka
 *    wraca (optymizm naniesiony na świeży stan) i leci do arkusza.
 *    Świadome „Wyloguj" czyści kolejkę (inna osoba na urządzeniu
 *    nie drenuje cudzych intencji).
 * 3) DATA W WPIŚIE: każdy wpis kolejki pamięta datę tapnięcia —
 *    zmiana daty w trakcie drainowania nie wysyła już obecności
 *    pod złą datą (dotąd brano S.data z chwili wysyłki).
 * 4) ARKUSZ_BRAK z kolejki: pauza zamiast czyszczenia (akcja też
 *    nie zdążyła się wykonać); gdy arkusz wróci, dajStan sukcesem
 *    drenuje kolejkę. BRAK_DOSTEPU (zdjęcie z białej listy) nadal
 *    czyści — konto bez dostępu nie może mutować arkusza.
 *
 * r32 („przycisk obecności ma mieć STANY — nie da się kliknąć w trakcie
 * wysyłania"): model PESYMISTYCZNY per kafel, ustalony teoretycznie
 * z właścicielem w rundzie 32. Zasada: JEDNO TAPNIĘCIE = JEDNA pełna,
 * nieprzerywalna transakcja; kafel pokazuje wyłącznie PRAWDĘ Z ARKUSZA
 * (✓ dopiero po potwierdzeniu serwera). Do v0.3.0 kafel był
 * optymistyczny (zielony od razu po tapnięciu), a tapnięcie „w locie"
 * koalesowało — szybkie stuk-stuk-stuk potrafiło zmienić intencję
 * zapisu na usunięcie. Teraz:
 *  - NIEOBECNY (domyślny) → 1 tap → W LOCIE (blokada: przycisk
 *    nieczuły, „…", pulsowanie) → potwierdzenie arkusza → OBECNY (✓).
 *  - OBECNY → tapy 1/3 i 2/3 (licznik LOKALNY, bez rundy do serwera —
 *    serwer nie ma czego zapisywać dla licznika) → tap 3/3 → W LOCIE
 *    (blokada) → potwierdzenie → NIEOBECNY (pełny cykl wraca do stanu
 *    początkowego — ustalenie z r32).
 *  - Tap w kafel W LOCIE = IGNOROWANY (blokada logiczna w obsłudze
 *    zdarzenia, nie tylko atrybut disabled — zdarzenia przychodzą też
 *    z klawiatury czy podwójnego triggera touch+click). Kafel INNEJ
 *    osoby działa normalnie (blokada per-osoba: tapnięcie Kowalskiego
 *    nie modyfikuje danych Nowakowej).
 *  - Kolejka FIFO (r30/r31) zostaje: pauza sesji, localStorage,
 *    dedup backendu — ale jej wizualizacja to NIE zmiana koloru kafla,
 *    tylko kropka „w kolejce" (⏳). Koniec z przywrocOptymizmKolejki()
 *    i nakładaniem intencji na świeży stan (uproszczenie merge'u:
 *    obecności dnia z odpowiedzi mutacji podstawiamy wprost).
 *  - Kafel czekający w kolejce (offline) pozostaje KLIKALNY:
 *    koalescing działa dalej dla wpisów NIEWYSŁANYCH (zmiana zdania
 *    zanim wystartowała transmisja — jedno żądanie zamiast dwóch),
 *    a licznik 3-tapów resetuje się po 2 s (jak w v0.3.0).
 *  - BŁĄD (sieć/biznesowy): kafel wraca do stanu sprzed intencji,
 *    czerwony błysk „!", dymek „Ponów" na liście — kolejka leci dalej.
 *  - TIMEOUT ~12 s żądania: najdłuższe realne wykonanie Apps Script
 *    to kilka sekund; wiszące połączenie (TCP bez odpowiedzi) nie może
 *    blokować kafla na zawsze — żądanie domyślnie trafia do kolejki
 *    (dedup backendu sprawia, że późniejsze ponowienie jest bezpieczne).
 *    F5 podczas blokady: wpis w Locie NIE jest w kolejce → po powrocie
 *    kafel ma stan z arkusza (serwer wygrywa, duplikat niemożliwy).
 *
 * r33 („tapuję drugi przycisk — zero reakcji, dopóki pierwszy się nie
 * wyśle; nie wiem, czy tap w ogóle zarejestrowany"): logika kolejki FIFO
 * (r30) była poprawna, ale jej WIZUALIZACJA zawodziła na dwóch poziomach:
 *  1) mapa S.wisiace (kafle czekające w kolejce) aktualizowała się tylko
 *     w pętli wysyłki — a ta przy wpisie W LOCIE wychodzi wcześnie
 *     (if (S.wLocie) return), więc tapnięcie KOLEJNEJ osoby lądowało
 *     w kolejce BEZ kropki aż do rozliczenia poprzedniej operacji.
 *     Fix: zakolejkuj() syncuje mapę natychmiast → renderuj() w
 *     tapZawodnika rysuje kropkę w tym samym ticku co zdarzenie.
 *  2) kropka „…" kafla czekającego była NIEWIDOCZNA — .status dziedziczy
 *     color:transparent (bazowy krąg placeholder), a reguła
 *     .synchronizacja zmieniała tylko styl ramki. Fix (CSS): przerywana
 *     ramka i „…" w kolorze akcentu + jasne tło.
 * Transmisja nadal PO JEDNEJ (LockService na serwerze), ale każdy tap
 * ma natychmiastową reakcję: kropka = „przyjęte, czeka w kolejce",
 * pulsujący kafel = „leci właśnie", ✓ = „arkusz potwierdził".
 *
 * r34 („przy logowaniu frontend musi otwierać się w najnowszej wersji,
 * nie z cache — to aplikacja, nie strona"): przeglądarka trzyma app.js
 * nawet 10 min (Cache-Control GitHub Pages) — user mógł zalogować się
 * do STAREJ wersji. Teraz: (1) publish generuje wersja.json + dopina
 * ?v= do script tagów (zmiana URL = świeży plik, cache jest kluczowany
 * adresem), (2) apka przy starcie I każdym powrocie do niej (odlokowanie
 * telefonu, karta na wierzch) pobiera wersja.json z cache:'no-store';
 * gdy live jest nowsza — auto-przeładowanie (?aktualizacja= omija cache
 * HTML), a gdy wisi kolejka/wysyłka — baner „Zaktualizuj teraz"
 * (nie przerywamy pracy; kolejka w localStorage przetrwa). Strażnik
 * anty-pętli: max 1 auto-reload / 30 s. Błąd sieci = cisza — kontrola
 * wersji nie blokuje apki.
 * BONUS (pytanie nr 2, multi-urządzenie): ten sam powrót do apki robi
 * CICHY dajStan — obecności zaznaczone na innym urządzeniu pojawiają
 * się same (duplikatom i tak zapobiega idempotentny backend: ten sam
 * zawodnik+dzień → istnialo:true, zero nowego wiersza).
 * ================================================================= */

'use strict';

var WERSJA_UI = 'v0.4.2';

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

/* ------------------------------------------------ r34: zawsze najnowsza wersja */
/* Strona to APLIKACJA, nie stronyka: przy każdym uruchomieniu i każdym
 * powrocie do apki (odlokowanie telefonu, przełączenie karty) pytamy
 * o wersja.json z cache:'no-store' (plik generowany przy publikacji,
 * obok index.html). Gdy live jest NOWSZY niż ten egzemplarz:
 *  - nic nie wisi (pusta kolejka, nic w locie) → AUTO-PRZEŁADOWANIE
 *    (?aktualizacja=… omija cache HTML; ?v= przy skryptach wymusza
 *    świeże app.js/config.js) — użytkownik zawsze na najnowszej;
 *  - kolejka/wysyłka w toku → baner z przyciskiem „Zaktualizuj teraz"
 *    (kolejka jest w localStorage i drenuje się po powrocie — nic nie
 *    ginie, ale bez zgody użytkownika nie przerywamy mu pracy).
 * Strażnik anty-pętli: max jedno auto-przeładowanie na 30 s (gdyby
 * CDN trzymał starą wersję dłużej). Błędy sieci = cisza — kontrola
 * wersji NIE MA prawa zablokować działania apki. */
var OSTATNIE_SPRAWDZENIE_WERSJI = 0;
var KLUCZ_RELOADU = 'dziennik_auto_reload';

/* Czy jest coś, czego nie wolno nam stracić przeładowaniem? Wpis
 * W LOCIE, wpis w kolejce, pauza — ALBO wpis zapisany w localStorage,
 * którego jeszcze nie wczytaliśmy (start apki: wersja.json odpowiada
 * szybciej niż dajStan zdąży odtworzyć kolejkę — bez tego auto-reload
 * po kliknięciu „Zaktualizuj teraz" odpalałby się DRUGI raz, zanim
 * kolejka wróciła by do pamięci). */
function wisiZapisanaKolejka() {
  if (S.wLocie || S.kolejka.length || S.pauza) return true;
  if (KOLEJKA_WCZYTANA) return false; // już wczytana (i pusta) — bezpiecznie
  try {
    var d = JSON.parse(localStorage.getItem(KLUCZ_KOLEJKI) || 'null');
    if (d && Array.isArray(d.wpisy) && d.wpisy.length) return true;
  } catch (ign) {}
  return false;
}

function sprawdzWersjeStrony() {
  var teraz = Date.now();
  if (teraz - OSTATNIE_SPRAWDZENIE_WERSJI < 60000) return; // throttle 60 s
  OSTATNIE_SPRAWDZENIE_WERSJI = teraz;
  fetch('wersja.json?t=' + teraz, { cache: 'no-store' })
    .then(function (odp) { return odp.ok ? odp.json() : null; })
    .then(function (d) {
      if (!d || !d.wersja) return;
      if (porownajWersje(String(d.wersja), WERSJA_UI) <= 0) {
        // mamy najnowszą — sprzątnij ewentualny baner, o ile był
        if (S.dostepnaWersja) { S.dostepnaWersja = null; if (S.stan) renderuj(); }
        return;
      }
      if (wisiZapisanaKolejka()) {
        // w trakcie pracy / kolejka jeszcze nie wróciła z localStorage —
        // nie przerywamy, tylko informujemy (ekran logowania: S.stan null
        // → cicho; banner nie ma gdzie wisieć, decyzja wróci przy
        // kolejnym sprawdzeniu po wczytaniu stanu)
        if (S.stan) { S.dostepnaWersja = String(d.wersja); renderuj(); }
        return;
      }
      przeladujStrone();
    })
    .catch(function () { /* offline / plik niedostępny — działamy dalej */ });
}

/* Przeładowanie z obejściem cache: ?aktualizacja= to unikalny URL →
 * przeglądarka pobiera ŚWIEŻY HTML, a ?v= przy skryptach (doklejane
 * przy publikacji) wyciąga nowe app.js/config.js. uzytkownik=true
 * (klik „Zaktualizuj teraz" w banerze) przeładowuje ZAWSZE — polecenie
 * człowieka jest niepodważalne; przeładowanie AUTOMATYCZNE ma strażnika
 * 30 s (krawędź CDN potrafi chwilę serwować starą wersję — bez
 * strażnika mielibyśmy pętlę przeładowań). */
function przeladujStrone(uzytkownik) {
  if (!uzytkownik) {
    var ostatni = 0;
    try { ostatni = parseInt(sessionStorage.getItem(KLUCZ_RELOADU) || '0', 10) || 0; } catch (ign) {}
    if (Date.now() - ostatni < 30000) return; // właśnie próbowaliśmy — nie zapętlamy
    try { sessionStorage.setItem(KLUCZ_RELOADU, String(Date.now())); } catch (ign) {}
  }
  location.href = location.pathname + '?aktualizacja=' + Date.now();
}

/* r34: baner „dostępna nowa wersja" (gdy auto-reload niemożliwy, bo
 * kolejka wisi) — renderowany obok banerWersji/banerPauzy */
function banerAktualizacji() {
  if (!S.dostepnaWersja) return '';
  return '<div class="baner-aktualizacji">' +
    '<span><b>Dostępna nowa wersja aplikacji</b> (masz ' + WERSJA_UI +
    ', jest ' + esc(S.dostepnaWersja) + '). Kolejka obecności jest zapisana i po aktualizacji sama się wyśle.</span>' +
    '<button onclick="przeladujStrone(true)">Zaktualizuj teraz</button>' +
    '</div>';
}

/* r31: baner pauzy wysyłki — widoczny, gdy kolejka czeka na ponowne
 * logowanie (BLAD_TOKENA) albo powrót arkusza (ARKUSZ_BRAK), a nakładka
 * została ukryta („Później — pokaż listę"). Kliknięciom podczas pauzy
 * NIE ginie: dokładają się do kolejki (drenują po powrocie sesji). */
function banerPauzy() {
  if (!S.pauza || !S.kolejka.length) return '';
  return '<div class="baner-wersji" id="baner-pauzy" style="border-color:#e6c96a;background:#fff7e0;color:#6b5b1e">' +
    (S.pauza === 'sesja'
      ? '<b>Sesja wygasła</b> — ' + S.kolejka.length + ' zmian czeka w kolejce. ' +
        'Zaloguj się ponownie, a lista dokończy wysyłkę do arkusza. '
      : '<b>Arkusz chwilowo niedostępny</b> — ' + S.kolejka.length + ' zmian czeka w kolejce. ') +
    '<button class="btn-glowny" id="baner-pauzy-zaloguj" style="padding:8px 14px;border:none;border-radius:8px;font-size:.85rem">Zaloguj ponownie</button>' +
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
  var zPliku = { API: '', KLUCZ: '' };
  if (typeof KONFIG === 'object' && KONFIG) {
    if (KONFIG.API) zPliku.API = String(KONFIG.API);
    if (KONFIG.KLUCZ) zPliku.KLUCZ = String(KONFIG.KLUCZ);
  }
  // r26: PRIORYTET PLIKU nad localStorage. Dotąd zapisane w przeglądarce
  // ustawienia nadpisywały config z GitHuba — gdy adres wdrożenia się
  // zmieniał (r25: usunięte wdrożenie = martwy URL), każdy, kto był kiedyś
  // na stronie, celował w 404 mimo poprawnego pliku. Teraz: plik wygrywa,
  // localStorage tylko DOPEŁNIA brakujące pole (karta ustawień ma sens
  // tylko zanim Zet wgrybie config). Śmieć w localStorage nie przechodzi
  // (walidacja formatu zostaje).
  try {
    var zapisane = JSON.parse(localStorage.getItem('konfig') || '{}');
    if (!zPliku.API && /^https:\/\/.+\/exec$/.test(String(zapisane.API || ''))) zPliku.API = String(zapisane.API);
    if (!zPliku.KLUCZ && /^[\w.-]+\.apps\.googleusercontent\.com$/.test(String(zapisane.KLUCZ || ''))) zPliku.KLUCZ = String(zapisane.KLUCZ);
  } catch (ign) { }
  dane.API = zPliku.API;
  dane.KLUCZ = zPliku.KLUCZ;
  // link dla trenerów: …/#api=…&klucz=… — nadal najsilniejszy (jednorazowe
  // podmienienie adresu, np. awaryjne przed publikacją configu)
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

/* r28: czy user właśnie świadomie się wylogował — tłumi One Tap na
 * najbliższym ekranie logowania (nie wsuwamy konta zaraz po Wyloguj);
 * resetowane przy wejściu na stronę (F5 = świadome odwiedzenie) */
var WYLOGOWANY_WLASNIE = false;

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
  wisiace: {}            // { idZawodnika: 'zapis'|'usun' } — wyliczane
  /* r32: { idZawodnika: timestamp } — kafel, którego OSTATNIA operacja
   * padła (sieć/biznesowy). KafelHtml pokazuje „!" przez BLYK_BLEDU_MS
   * od tego momentu, potem znika (render po timerze). Kafel pozostaje
   * w stanie z arkusza — błysk to tylko sygnał „coś nie wyszło, patrz
   * dymek Ponów". */
  , bledyKafli: {}
  /* r30: kolejka FIFO obecności (ustalenie B z rundy 30). Intencje lecą
   * do serwera PO JEDNEJ (jedna w locie), w kolejności tapnięć — koniec
   * z równoległymi żądaniami, które serwer i tak serializuje LockService'm
   * (waitLock(10 s) potrafił wybuchnąć przy serii szybkich tapnięć),
   * a odpowiedzi wracały w złej kolejności i nadpisywały stan starszą
   * odpowiedzią. Koalescing per zawodnik: tapnięcie tej samej osoby
   * nadpisuje jej NIEWYSŁANY wpis (ostatnia intencja wygrywa), tap w
   * kafel „w locie" kolejkuje wpis NASTĘPNY po nim. Błąd pojedynczej
   * operacji = revert tylko tego kafla + dymek „Ponów", kolejka leci
   * dalej. „wisiace" jest odtąd WYLICZANE z kolejki+wLocie (pomocnicze
   * pole zsynchronizowane przy każdej zmianie — patrz zsynchronizujWisiace).
   * r31: wpis {id, akcja, data} — data tapnięcia jawnie w wpisie
   * (zmiana daty mid-drain nie wysyła pod złą datę); kolejka żyje
   * w localStorage (przetrwa F5/zamknięcie karty), a pauza=true
   * wstrzymuje wysyłkę do ponownego zalogowania (BLAD_TOKENA) albo
   * powrotu arkusza (ARKUSZ_BRAK). */
  , kolejka: []          // NIEWYSŁANE intencje: {id, akcja, data}
  , wLocie: null         // wpis wysłany właśnie do serwera (lub null)
  , pauza: null          // 'sesja' | 'arkusz' | null — wstrzymana wysyłka
  , dostepnaWersja: null // r34: nowa wersja na serwerze, gdy kolejka blokuje auto-reload (baner)
};

/* ------------------------------------------------ sesja (r28)
 * Przeładowanie strony (F5) dotąd wyrzucało do logowania: token GIS
 * żył tylko w pamięci strony. Teraz zapisujemy go w localStorage —
 * odświeżenie strony = od razu apka, bez klikania Google. Wygasły token
 * (Google ID ma ~1 h) → BLAD_TOKENA → czyszczony i One Tap przywraca
 * logowanie jednym klikiem. „Wyloguj" czyści token na pewno.
 * localStorage jest OK: to krótkożyjący token wystawiony dla TEJ strony
 * (aud), nie hasło; ktoś z dostępem do przeglądarki ma i tak dostęp
 * do zalogowanej sesji Google. */
var KLUCZ_SESJI = 'dziennik_token';

function zapiszSesje(token) {
  try { localStorage.setItem(KLUCZ_SESJI, token); } catch (ign) {}
}
function wyczyscSesje() {
  try { localStorage.removeItem(KLUCZ_SESJI); } catch (ign) {}
}
function odczytajSesje() {
  try { return localStorage.getItem(KLUCZ_SESJI) || ''; } catch (ign) { return ''; }
}

/* r31: kolejka obecności w localStorage — F5/zamknięcie karty w trakcie
 * wysyłki NIE gubi nieodesłanych kliknięć. Zapisujemy tylko wewnętrzne
 * intencje (id zawodnika, akcja, data) + e-mail właściciela kolejki —
 * po powrocie DRENUJEMY TYLKO WŁASNE intencje (na wspólnym urządzeniu
 * ktoś inny zalogowany NIE wysyła cudzych obecności). „Wyloguj" czyści
 * (osoba przejmująca urządzenie nie dziedziczy intencji). Format:
 * {email, wpisy:[{id, akcja, data}]}. */
var KLUCZ_KOLEJKI = 'dziennik_kolejka';

/* r31: czy kolejka została już wczytana z localStorage przy tym stanie
 * strony (wczytujemy RAZ, przy pierwszym udanym dajStan — potem S.kolejka
 * jest żywa i sami ją utrzymujemy w zapisie). */
var KOLEJKA_WCZYTANA = false;

function zapiszKolejke() {
  try {
    localStorage.setItem(KLUCZ_KOLEJKI, JSON.stringify({
      email: (S.stan && S.stan.email) || '',
      wpisy: S.kolejka
    }));
  } catch (ign) { /* brak localStorage = kolejka tylko w pamięci */ }
}

/** Odtwarza kolejkę z localStorage RAZ, po pierwszym udanym dajStan
 * (wcześniej nie ma stanu, na którym można pracować). Tylko WŁASNE
 * wpisy (e-mail z zapisu musi pasować do zalogowanego) — na wspólnym
 * urządzeniu cudze intencje są porzucane, nie drenowane. Skandaliczne
 * wpisy (dziwny JSON, brak pól) są pomijane. */
function odczytajKolejke() {
  var dane = null;
  try { dane = JSON.parse(localStorage.getItem(KLUCZ_KOLEJKI) || 'null'); } catch (ign) { return; }
  if (!dane || !Array.isArray(dane.wpisy)) return;
  var moja = !dane.email || !S.stan || !S.stan.email || dane.email === S.stan.email;
  var czysta = [];
  if (moja) {
    dane.wpisy.forEach(function (w) {
      if (!w || typeof w.id !== 'string' || !w.id) return;
      if (w.akcja !== 'zapiszObecnosc' && w.akcja !== 'usunObecnosc') return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(w.data || ''))) return;
      czysta.push({ id: w.id, akcja: w.akcja, data: String(w.data) });
    });
  }
  if (czysta.length) S.kolejka = czysta;
  else {
    // cudza kolejka albo zmurszały zapis — czyścimy, żeby nie wisiał
    try { localStorage.removeItem(KLUCZ_KOLEJKI); } catch (ign) {}
  }
}

/* r32: KONIEC optymizmu kolejki. Do v0.3.0 funkcja
 * przywrocOptymizmKolejki() nanosiła czekające intencje na świeży stan
 * (kafel „już zielony" przed potwierdzeniem). W modelu pesymistycznym
 * r32 kafel pokazuje WYŁĄCZNIE prawdę z arkusza: S.stan.obecnosci
 * podstawiamy wprost (dajStan / stan z odpowiedzi mutacji), a intencje
 * czekające w kolejce wizualizuje osobno kropka „w kolejce" (kafelHtml
 * czyta S.wisiace). Merge upraszcza się z „nakładania intencji na
 * odpowiedź" do prostego podstawienia dnia — mniej miejsc, gdzie stan
 * lokalny mógł rozjechać się z arkuszem. */

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
      /* r27/r29: desktop — JEDEN wiersz („Obecność", licznik, Data, szukaj,
       * sortowanie, Członkowie). Mobile (≤640px, CSS): z topbara znika
       * „Członkowie" (przejmuje je stały pasek na dole ekranu), szukaj
       * chowa się za lupą (drugi wiersz po rozwinięciu), licznik i data
       * robią się kompaktowe — wszystko po to, by reszta zmieściła się
       * w jednym wierszu na telefonie. */
      '<div class="rzad1">' +
        '<span class="tytul">Obecność</span>' +
        /* r29: licznik w dwóch wariantach — desktop „3/4 obecnych",
         * mobile „3/4" (CSS wybiera; tekst musi być w JS, CSS go nie skróci) */
        '<span class="licznik"><span class="pelny">' + ileObecnych + '/' + lista.length + ' obecnych</span><span class="krotki">' + ileObecnych + '/' + lista.length + '</span></span>' +
        '<span class="btn-data"><span class="ikona-data">📅</span><input type="date" class="data-input" id="data" value="' + S.data + '" max="' + lokalnaData(new Date()) + '"></span>' +
        '<input class="szukaj" id="szukaj" type="search" placeholder="Szukaj…" value="' + esc(S.szukane) + '">' +
        '<div class="przelacznik">' +
          '<button id="sort-imie" class="' + (S.sortowanie === 'imie' ? 'on' : '') + '">A→Z imię</button>' +
          '<button id="sort-nazwisko" class="' + (S.sortowanie === 'nazwisko' ? 'on' : '') + '">A→Z nazwisko</button>' +
        '</div>' +
        '<button class="btn-ikona" id="btn-czlonkowie" title="Członkowie">👥 Członkowie</button>' +
        /* r29 mobile: lupa (rozwija szukaj w drugim wierszu) + sort jako
         * JEDEN przełącznik (tap: imię ⇄ nazwisko). Widoczne TYLKO ≤640px
         * (CSS); data zostaje natywnym inputem — na telefonie to on
         * otwiera systemowy picker (niezawodnie, showPicker bywa kapryśny) */
        '<button class="btn-ikona btn-sort-mobilny" id="btn-sort-k" title="Sortowanie">⇅ ' +
          (S.sortowanie === 'nazwisko' ? 'Nazwisko' : 'Imię') + '</button>' +
        '<button class="btn-ikona btn-szukaj-mobilny" id="btn-szukaj" title="Szukaj">🔍</button>' +
      '</div>' +
      /* r29 mobile: pole szukaj po rozwinięciu lupą (drugi wiersz topbara);
       * na desktopie nigdy nie pokazane (media query + klasa .otwarty) */
      '<div class="rzad2 rzad2-mobilny' + (S.szukane ? ' otwarty' : '') + '" id="rzad2-mobilny"' + (S.szukane ? ' data-otwarty="1"' : '') + '>' +
        '<input class="szukaj" id="szukaj-mobilny" type="search" placeholder="Szukaj…" value="' + esc(S.szukane) + '">' +
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
    banerPauzy() +
    banerAktualizacji() +
    '<div class="lista">' +
      lista.map(kafelHtml).join('') +
      (S.bladAkcji ? dymekBledu() : '') +
      (lista.length === 0 ? '<p class="oplucie" style="text-align:center">Brak zawodników spełniających kryteria.</p>' : '') +
    '</div>' +
    '<div class="stopka">' +
      '<p class="wersja">' + esc(S.stan.email) + ' · strona ' + WERSJA_UI + ' · serwer ' + esc(S.stan.wersja || '?') +
        ' · <button class="link-wyloguj" id="stopka-wyloguj" title="Zakończ sesję na tym urządzeniu">Wyloguj</button></p>' +
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
        // r26: optymistyczne usunięcie lokalne + odświeżenie z potwierdzeniem
        przyjmijStan(w, function (stan) {
          stan.grupy = stan.grupy.filter(function (x) { return x.kod !== g.kod; });
        });
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
      // r26: grupa widoczna OD RAZU (optymistycznie), a odświeżenie
      // potwierdza ją z arkusza (retry, gdy odczyt jeszcze nie widzi)
      if (nowa) {
        przyjmijStan(w, function (stan) {
          if (!stan.grupy.some(function (x) { return x.kod === kod; })) {
            stan.grupy.push({ kod: kod, nazwa: nazwa, dni: dni });
            stan.grupy.sort(function (a, b) { return a.kod.localeCompare(b.kod, 'pl'); });
          }
        }, function (serwer) {
          return serwer.grupy.some(function (x) { return x.kod === kod; });
        });
      } else {
        przyjmijStan(w, function (stan) {
          var x = null;
          stan.grupy.forEach(function (g2) { if (g2.kod === kod) x = g2; });
          if (x) { x.nazwa = nazwa; x.dni = dni; }
        }, function (serwer) {
          var x = null;
          serwer.grupy.forEach(function (g2) { if (g2.kod === kod) x = g2; });
          return x ? (x.nazwa === nazwa && x.dni === dni) : false;
        });
      }
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

/* kafel zawodnika — r32: maszyna stanów per kafel (model pesymistyczny).
 * KLASA BAZOWA = prawda arkusza („obecny" — zielony ✓ z potwierdzenia),
 * NAKŁADKI transportowe idą OBOK bazy, nie zamiast niej:
 *  - W LOCIE (S.wLocie tej osoby) = BLOKADA: disabled, „…"/„⟲", puls,
 *    wygaszenie — nieczuły na tapnięcia. Zielony kafel w locie ZOSTAJE
 *    zielony (jest obecny w arkuszu!) — pulsem sygnalizujemy pracę;
 *  - W KOLEJCE (intencja czeka: pauza sesji/arkusza) = kropka „…",
 *    kafel KLIKALNY (zmiana zdania = koalescing czekającego wpisu);
 *  - BŁĄD świeży (S.bledyKafli) = czerwony błysk „!" (wygasa po 3 s);
 *  - licznik 2/3 = pomarańczowy „2/3" (tap 1 licznika jest niemy —
 *    jak w v0.3.0, żeby nie migać przy każdym niepotwierdzonym tapnięciu). */
var BLYK_BLEDU_MS = 3000;

function kafelHtml(z) {
  var dzien = S.stan.obecnosci[S.data] || [];
  var obecny = dzien.indexOf(z.id) !== -1;
  var tap = S.tapy[z.id];
  var wisi = S.wisiace[z.id];
  var tenWLocie = !!(S.wLocie && S.wLocie.id === z.id);
  var bladNiedawno = !!(S.bledyKafli[z.id] && Date.now() - S.bledyKafli[z.id] < BLYK_BLEDU_MS);
  var klasy = 'kafel';
  if (obecny) klasy += ' obecny'; // baza: prawda arkusza
  if (tenWLocie) klasy += ' wlocie' + (S.wLocie.akcja === 'usunObecnosc' ? ' wlocie-usun' : '');
  else if (bladNiedawno) klasy += ' blad';
  else if (tap && tap.n >= 2) klasy += ' potwierdz';
  else if (wisi) klasy += ' synchronizacja';

  var status = '<span class="status"></span>';
  if (tenWLocie) status = '<span class="status">' + (S.wLocie.akcja === 'usunObecnosc' ? '⟲' : '…') + '</span>';
  else if (bladNiedawno) status = '<span class="status">!</span>';
  else if (tap && tap.n >= 2) status = '<span class="status usun">' + tap.n + '/3</span>';
  else if (wisi) status = '<span class="status">…</span>';
  else if (obecny) status = '<span class="status">✓</span>';

  return '<button class="' + klasy + '" data-id="' + esc(z.id) + '"' +
    (tenWLocie ? ' disabled' : '') + '>' +
    '<span class="wiersz-nazwy"><span class="nazwa"><b>' +
    (S.sortowanie === 'nazwisko'
      ? esc(z.nazwisko + ' ' + z.imie)
      : esc(z.imie + ' ' + z.nazwisko)) +
    '</b></span>' + status + '</span>' +
    '<span class="grupa-etykieta">' + esc(z.grupa) + '</span>' +
    '</button>';
}

/* tap w kafel — r32: model pesymistyczny („stany przycisku", ustalenie
 * z rundy 32). JEDNO TAPNIĘCIE = JEDNA pełna transakcja z potwierdzeniem
 * arkusza; kolejna transakcja tej samej osoby startuje dopiero po
 * rozliczeniu poprzedniej. NIEOBECNY: 1 tap → zapis → (blokada w locie)
 * → ✓ po potwierdzeniu. OBECNY: tapy 1/3 i 2/3 to licznik LOKALNY (serwer
 * nie ma czego zapisywać dla licznika — zero zbędnych rund), tap 3/3 →
 * usunięcie → (blokada) → powrót do NIEOBECNY (stan początkowy, pełny
 * cykl). Szybkie stuk-stuk-stuk na nieobecnym da JEDEN zapis (dwa
 * pozostałe tapy zignorowane w blokadzie) — dokładnie zamierzone.
 * Kafel czekający w KOLEJCE (pauza sesji/arkusza, wpisy niewysłane)
 * pozostaje klikalny: zmiana zdania offline = koalescing czekającego
 * wpisu (jedno żądanie zamiast dwóch). */
function tapZawodnika(z) {
  var dzien = S.stan.obecnosci[S.data] || [];

  // r32: BLOKADA LOGICZNA — wpis tej osoby jest W LOCIE → tap ignorowany.
  // To zabezpieczenie w samej obsłudze zdarzenia (disabled w HTML to
  // tylko prezentacja: zdarzenia potrafią przyjść z klawiatury czy z
  // podwójnego triggera touch+click). Inne kafle nie są blokowane.
  if (S.wLocie && S.wLocie.id === z.id) return;

  // r32: KOLOR kafla = prawda arkusza, ale SEMANTYKA tapnięcia liczy
  // się z czekającą intencją (projekcja stanu po drenażu kolejki):
  // „obecny + czekający usun" ma się tapnąć jak NIEOBECNY (tap = zapis
  // = odwołanie usunięcia), bo gdyby kolejka padła z sieci, intencją
  // użytkownika było jego usunięcie i zmiana zdania musi to odwrócić.
  // Bez tego nie dałoby się anulować czekającego usun (3 tapy znów
  // zakolejkowałyby usun zamiast przywrócić zapis).
  var wKolejce = null;
  S.kolejka.forEach(function (w) { if (w.id === z.id) wKolejce = w; });
  var efektywnieObecny = dzien.indexOf(z.id) !== -1;
  if (wKolejce) efektywnieObecny = (wKolejce.akcja === 'zapiszObecnosc');

  if (!efektywnieObecny) {
    // nieobecny (po drenażu) → zapis; r32: BEZ zmiany lokalnego
    // obecnosci — kolor ✓ przyjdzie z potwierdzeniem serwera
    zakolejkuj(z.id, 'zapiszObecnosc');
    renderuj();
    wysylaKolejke();
    return;
  }

  // obecny (potwierdzony albo z czekającym zapisem) → licznik do 3
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

  // 3 tapy → usuń; r32: bez optymistycznego splice — kafel jest obecny
  // do potwierdzenia usunięcia z arkusza
  delete S.tapy[z.id];
  clearTimeout(S.timery[z.id]);
  delete S.timery[z.id];
  zakolejkuj(z.id, 'usunObecnosc');
  renderuj();
  wysylaKolejke();
}

/* ------------------------------------------------ r30: kolejka FIFO obecności */

/* Koalescing per zawodnik: nowa intencja tej samej osoby ZASTĘPUJE jej
 * niewysłany wpis (ostatnia intencja wygrywa — po co wysyłać zapis, który
 * zaraz trzeba cofać usunięciem). Jeśli wpis tej osoby jest już W LOCIE,
 * nowy wpis trafia na koniec kolejki jako osobna operacja (tego, co leci
 * do serwera, nie da się wycofać — zostanie rozliczone per-zawodnik
 * wg odpowiedzi). r31: wpis wie, pod jaką datą tapnięto (S.data z chwili
 * tapnięcia), a zmiana jest od razu w localStorage. */
function zakolejkuj(id, akcja) {
  var podmieniony = false;
  for (var i = 0; i < S.kolejka.length; i++) {
    if (S.kolejka[i].id === id) {
      S.kolejka[i].akcja = akcja;
      S.kolejka[i].data = S.data;
      podmieniony = true;
      break;
    }
  }
  if (!podmieniony) S.kolejka.push({ id: id, akcja: akcja, data: S.data });
  zapiszKolejke();
  /* r33: mapa kafli czekających od RAZU — kropka „w kolejce" rysuje się
   * w tym samym ticku co tapnięcie (renderuj zaraz po zakolejkuj w
   * tapZawodnika), nawet gdy inny wpis jest W LOCIE (pętla wysyłki
   * wtedy wychodzi wcześnie i do v0.4.0 nie syncowała mapy — kafel
   * drugiej osoby był „niemy" aż do rozliczenia pierwszej). */
  zsynchronizujWisiace();
}

/* Utrzymuje S.wisiace zgodne z kolejką+wLocie (kafelHtml czyta to pole).
 * Kafel „w locie" ma własny status (kropki), wpisy czekające — też.
 * r33: syncuje ją też zakolejkuj() — kropka nowego wpisu pojawia się
 * w TYM SAMYM ticku co tapnięcie, nawet gdy inny wpis jest w locie
 * (do v0.4.0 robiła to tylko pętla wysyłki, która przy wpisie w locie
 * wychodziła wcześnie → kafel drugiej osoby był „niemy" aż do
 * rozliczenia pierwszej — objaw zgłoszony przez właściciela w r33). */
function zsynchronizujWisiace() {
  S.wisiace = {};
  if (S.wLocie) S.wisiace[S.wLocie.id] = S.wLocie.akcja === 'usunObecnosc' ? 'usun' : 'zapis';
  S.kolejka.forEach(function (wpis) {
    if (!S.wisiace[wpis.id]) {
      S.wisiace[wpis.id] = wpis.akcja === 'usunObecnosc' ? 'usun' : 'zapis';
    }
  });
  // r31: wisi nakładka „Sesja wygasła"? odświeżamy licznik oczekujących
  // (user może doklikiwać kolejne osoby podczas pauzy — niech widzi, że rośnie)
  var nakladka = document.getElementById('nakladka-wygasla');
  if (nakladka) odswiezLicznikNakladki(nakladka);
}

/* r32: timeout jednej operacji obecności. Realne wykonanie Apps Script
 * (lock + weryfikacja tokena z cache + skan 300 + zapis) to 1–3 s;
 * wiszące połączenie (TCP bez odpowiedzi, aplikacja uśpiona) nie może
 * blokować kafla na zawsze. Po upływie traktujemy operację jak błąd
 * POŁĄCZENIA (nie wiemy, czy serwer zapisał): wpis wraca do kolejki,
 * kafel wraca do prawdy arkusza, pętla ponawia (zapisy idempotentne —
 * dedup backendu pochłonie duplikat, gdyby pierwsze jednak doszło).
 * Timer jest czyszczony przy KAŻDYM rozliczeniu odpowiedzi. */
var TIMEOUT_W_LOCIE = 12000; // ms

/* Pętla wysyłania: jedna operacja w locie, reszta czeka. Wywoływana po
 * każdej zmianie kolejki i po rozliczeniu odpowiedzi. r31: pauza
 * (S.pauza = 'sesja' po BLAD_TOKENA, 'arkusz' po ARKUSZ_BRAK) wstrzymuje
 * PĘTLĘ WYSYŁKI, ale nie obsługę UI — tapnięcia podczas pauzy dokładają
 * się do kolejki (kropki + licznik nakładki żyją przez zsynchronizujWisiace
 * z zakolejkuj/tapZawodnika). r32: dodatkowo timer TIMEOUT_W_LOCIE —
 * brak odpowiedzi w 12 s = rozliczenie jak błąd sieci (wpis wraca do
 * kolejki; F5 wtedy zostawia wpis w Locie poza kolejką = stan z arkusza). */
function wysylaKolejke() {
  if (S.pauza) {
    // pauza: tapnięcie doszło do kolejki — pokaż kropkę „w kolejce"
    // (renderuj w tapZawodnika zdarzył się PRZED zsynchronizujWisiace,
    // więc tu domykamy rysunek) i czekaj na logowanie / powrót arkusza
    zsynchronizujWisiace();
    if (S.stan && S.stan.obecnosci) renderuj();
    return;
  }
  if (S.wLocie || !S.kolejka.length) return;
  var wpis = S.kolejka.shift();
  S.wLocie = wpis;
  zsynchronizujWisiace();
  renderuj(); // r32: kafel tej osoby przechodzi w stan blokady („…" + puls)
  var dataWyslania = wpis.data || S.data; // r31: data z CHWILI TAPNIĘCIA
  var rozliczone = false;
  var timer = setTimeout(function () {
    if (rozliczone) return;
    rozliczone = true;
    // TIMEOUT: nie wiemy, czy serwer zapisał — jak błąd sieci, ale
    // CICHE: wpis wraca na czoło kolejki (dedup chroni przed duplikatem),
    // kafel wraca do kropki „w kolejce", pętla sama ponawia po chwili.
    // Dymek „Ponów" pojawi się dopiero, gdy ponowienie PADNIE z błędem
    // sieci (wtedy to już prawdziwy błąd do pokazania).
    S.wLocie = null;
    S.kolejka.unshift(wpis);
    zapiszKolejke();
    zsynchronizujWisiace();
    renderuj();
    setTimeout(wysylaKolejke, 800); // krótka pauza przed ponowieniem
  }, TIMEOUT_W_LOCIE);
  wywolaj(wpis.akcja, { token: TOKEN, id: wpis.id, data: dataWyslania }, function (e, w) {
    if (rozliczone) return; // timeout nas ubiegł — ta odpowiedź jest martwa
    rozliczone = true;
    clearTimeout(timer);
    S.wLocie = null;

    // r31: sesja wygasła W TRAKCIE kolejki → NIE wylogowujemy i NIE
    // czyścimy. Backend waliduje token PRZED wykonaniem akcji, więc ta
    // operacja na pewno się nie wykonała; wraca na czoło kolejki
    // (kolejność tapnięć), wysyłka dostaje pauzę, nad listą pojawia się
    // nakładka „Sesja wygasła" z przyciskiem Google. Po ponownym
    // zalogowaniu kolejka sama się drenuje (zapisy idempotentne —
    // nawet gdyby wpis „w locie" dotarł, duplikatu nie będzie).
    var blad = e ? '_polaczenie' : (w && w.blad);
    if (blad === 'BLAD_TOKENA') {
      S.kolejka.unshift(wpis);
      zapiszKolejke();
      zsynchronizujWisiace();
      wyczyscSesje();
      S.pauza = 'sesja';
      renderuj(); // kropki „czeka w kolejce" na liście POD nakładką
      pokazNakladkeWygaslaSesje();
      return;
    }
    if (blad === 'ARKUSZ_BRAK') {
      // r31: arkusz chwilowo niedostępny → pauza (akcja się nie wykonała);
      // gdy arkusz wróci, dajStan sukcesem zdejmie pauzę i drenuje kolejkę.
      S.kolejka.unshift(wpis);
      zapiszKolejke();
      zsynchronizujWisiace();
      S.pauza = 'arkusz';
      obsluzBlad(e, w);
      return;
    }
    if (blad === 'BRAK_DOSTEPU') {
      // zdjęto z białej listy — konto nie może mutować arkusza; intencje
      // nie mają prawa lecieć dalej (każde żądanie = odmowa w kółko)
      S.kolejka = [];
      zapiszKolejke();
      zsynchronizujWisiace();
      obsluzBlad(e, w);
      return;
    }

    // błąd POŁĄCZENIA (sieć padła): nie wiemy, czy serwer zapisał.
    // r32: kafel wraca do prawdy arkusza (nie było optymizmu do cofania),
    // dymek „Ponów", kolejka leci dalej. r31: wpis jest rozliczony
    // (widoczne dla usera) → LS musi się zgodzić z pamięcią; jedyny
    // świadomy „zaleg" w LS to wpis W LOCIE (patrz shift wyżej — bez
    // zapisu po zdjęciu z kolejki: F5 w locie = ponowienie).
    if (e) {
      domknijKafelPoBledzie(wpis.id);
      zapiszKolejke();
      S.bladAkcji = e.message;
      zsynchronizujWisiace();
      renderuj();
      wysylaKolejke();
      return;
    }

    if (!w.ok) {
      // błąd biznesowy tej operacji: kafel do prawdy arkusza + dymek;
      // reszta leci.
      domknijKafelPoBledzie(wpis.id);
      zapiszKolejke(); // r31: jw. — rozliczony wpis znika i z LS
      S.bladAkcji = (w && w.opis) || w.blad || 'Nieznany błąd';
      zsynchronizujWisiace();
      renderuj();
      wysylaKolejke();
      return;
    }

    // SUKCES: r32 — uproszczony merge. Serwer v0.2.6+ dokleja stan SPÓJNY
    // z tą operacją; obecności dnia podstawiamy WPROST z odpowiedzi
    // (prawda arkusza). Koniec z nakładaniem czekających intencji na
    // odpowiedź — kafel i tak nie opiera się na optymistycznych
    // znaczeniach, a intencje czekające w kolejce drenują się po kolei
    // i po ich własnych odpowiedziach pojawi się ich kolor. Ktoś inny
    // mógł zapisać się w międzyczasie — jego wpis z odpowiedzi zostaje.
    var padlStarySerwer = false;
    if (w && w.stan && w.stan.obecnosci && w.stan.obecnosci[dataWyslania] && !w.stan.brakDostepu) {
      S.stan.obecnosci[dataWyslania] = w.stan.obecnosci[dataWyslania];
    } else {
      // serwer starszy niż v0.2.6 (bez stanu w odpowiedzi): kafel NIE
      // robi się zielony lokalnie (model pesymistyczny) — ✓ dowiezie
      // dajStan po zakończeniu drenażu (patrz niżej; per-operacyjny
      // dajStan w środku pętli mieszałby się z wysyłką)
      padlStarySerwer = true;
    }
    zapiszKolejke(); // r31: kolejka się skróciła — trzymamy localStorage w zgodzie
    zsynchronizujWisiace();
    renderuj();
    if (!S.kolejka.length && padlStarySerwer) {
      // drenaż zakończony, a ostatnia odpowiedź nie niosła stanu →
      // jeden dajStan domyka kolory kafli (rare: serwer < v0.2.6)
      odswiezStan();
    } else {
      wysylaKolejke(); // następna operacja z kolejki
    }
  });
}

/* r32: po błędzie operacji czyścimy licznik tapów i znacznik błędu
 * kafla — kafel wraca do PRAWDY ARKUSZA (S.stan.obecnosci), którą
 * ustawia wyłącznie odpowiedź serwera. W optymistycznym v0.3.0 trzeba
 * było tu odwracać lokalne znaczenie (cofnijOptymizm) — teraz stan
 * lokalny nigdy nie odjeżdża od arkusza, więc wystarcza domknięcie
 * UI: oznacz „!" (błysk wygasa sam po BLYK_BLEDU_MS), zdejmij licznik,
 * pokaż dymek (ustawia wywołujący). */
function domknijKafelPoBledzie(id) {
  delete S.tapy[id]; // licznik 3-tapów nie ma już sensu
  delete S.wisiace[id];
  if (S.timery[id]) { clearTimeout(S.timery[id]); delete S.timery[id]; }
  S.bledyKafli[id] = Date.now();
  setTimeout(function () {
    // wygaszenie błysku „!" — render tylko gdy wpis jeszcze tam jest
    // (user mógł w międzyczasie zmienić zdanie i mieć nową intencję)
    if (S.bledyKafli[id] && Date.now() - S.bledyKafli[id] >= BLYK_BLEDU_MS - 50) {
      delete S.bledyKafli[id];
      if (S.stan && S.stan.obecnosci) renderuj();
    }
  }, BLYK_BLEDU_MS + 60);
}

/* r31: nakładka „Sesja wygasła" — NIE przełączamy ekranu (lista z kropkami
 * „w trakcie" zostaje pod spodem, user widzi co jeszcze nie doleciało),
 * tylko dokładamy warstwę z przyciskiem Google i liczbą oczekujących.
 * renderuj() przerysowuje #app — dlatego nakładka żyje w body i jest
 * przerysowywana przez zsynchronizujWisiace→renderuj NIE ruszana; tu
 * tylko odświeżamy licznik wpisów w istniejącej nakładce. */
function pokazNakladkeWygaslaSesje() {
  var stara = document.getElementById('nakladka-wygasla');
  if (stara) { odswiezLicznikNakladki(stara); return; }
  var tlo = document.createElement('div');
  tlo.className = 'tlo-modal';
  tlo.id = 'nakladka-wygasla';
  tlo.innerHTML =
    '<div class="modal" style="text-align:center">' +
      '<h2>Sesja wygasła</h2>' +
      '<p style="font-size:.9rem;color:var(--szary)">Sesja Google kończy się po około godzinie — to nie błąd, tylko zabezpieczenie.</p>' +
      '<p style="font-size:.9rem">Twoje kliknięcia (<b id="nakladka-ile">0</b>) czekają w kolejce i nic nie przepadło — zaloguj się ponownie, a lista dokończy wysyłkę do arkusza.</p>' +
      '<div class="przycisk-w-srodku" id="nakladka-google"></div>' +
      '<p style="font-size:.78rem;color:var(--szary)">Chcesz zostawić to na później? Nic nie zginie — kolejka przetrwa zamknięcie strony i dokończy się po powrocie.</p>' +
      '<button class="link-tryb" id="nakladka-pokaz-liste" style="font-size:.8rem;margin-top:2px">Później — chcę jeszcze poprawiać listę</button>' +
      '<button class="link-tryb" id="nakladka-porzuc" style="font-size:.78rem;margin-top:6px">Wyloguj się i porzuć oczekujące zmiany</button>' +
    '</div>';
  document.body.appendChild(tlo);
  odswiezLicznikNakladki(tlo);
  tlo.querySelector('#nakladka-pokaz-liste').addEventListener('click', function () {
    tlo.remove(); // baner pauzy (renderuj) przejmuje wskazanie drogi powrotu
    renderuj();   // rysuje listę + baner pauzy (pauza ustawiona, kolejka wisi)
  });
  tlo.querySelector('#nakladka-porzuc').addEventListener('click', function () {
    if (!confirm('Porzucić ' + S.kolejka.length + ' oczekujących zmian i wylogować się?\n' +
        'Kliknięcia, które nie dotarły jeszcze do arkusza, przepadną.')) return;
    wyloguj(); // czyści token, kolejkę i przeładowuje stronę
  });
  zainicjujGoogleWNakladce(tlo);
}

function odswiezLicznikNakladki(tlo) {
  var el = tlo.querySelector('#nakladka-ile');
  if (el) el.textContent = String(S.kolejka.length);
}

/* GIS w nakładce: initialize BYŁ już zrobiony (zainicjujGoogle przy
 * starcie ekranu logowania) — ponowne initialize z tym samym client_id
 * jest dozwolone i podmienia callback. Renderujemy przycisk w nakładce
 * i wsuwamy One Tap (klient z zapamiętanym kontem = jeden klik). */
function zainicjujGoogleWNakladce(tlo) {
  var pojemnik = tlo.querySelector('#nakladka-google');
  if (!pojemnik) return;
  if (!K.KLUCZ) {
    pojemnik.innerHTML = '<p style="font-size:.85rem;color:var(--blad)">Brak Client ID — odśwież stronę i zaloguj się zwykłym przyciskiem.</p>';
    return;
  }
  var proby = 0;
  (function czekaj() {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: K.KLUCZ,
        callback: function (odp) { poPonownymZalogowaniu(odp.credential); }
      });
      google.accounts.id.renderButton(
        pojemnik,
        { theme: 'outline', size: 'large', text: 'signin_with', locale: 'pl' }
      );
      try { google.accounts.id.prompt(function (n) {}); } catch (ign) { }
      return;
    }
    if (++proby < 40) setTimeout(czekaj, 250); // 10 s na GIS
  })();
}

/* r31: koniec pauzy po ponownym zalogowaniu — nowy token, nakładka
 * znika, ale pauzę 'sesja' zdejmie dopiero udany dajStan (gdyby nowy
 * token też był odrzucony, odswiezStan na BLAD_TOKENA przywróci
 * nakładkę — intencje wciąż na miejscu). Przy sukcesie odswiezStan
 * sam zdejmie pauzę i ruszy pętlę — kolejka się drenuje. */
function poPonownymZalogowaniu(token) {
  TOKEN = token;
  zapiszSesje(token);
  var nakladka = document.getElementById('nakladka-wygasla');
  if (nakladka) nakladka.remove();
  odswiezStan();
}

/* wspólna obsługa błędów API (protokół z doPost v0.2.0) */
function obsluzBlad(e, w) {
  var blad = e ? e.message : (w && w.blad);
  if (blad === 'ARKUSZ_BRAK') {
    // r31: NIE czyścimy kolejki — akcja się nie wykonała, intencje
    // czekają (pauza 'arkusz' z kolejki albo najbliższe dajStan);
    // odswiezStan pokaże ekran problemu, a gdy arkusz wróci (S.próbuj
    // ponownie / F5), sukces zdejmie pauzę i drenuje
    zsynchronizujWisiace();
    odswiezStan();
    return;
  }
  if (blad === 'BRAK_DOSTEPU' || blad === 'BLAD_TOKENA') {
    // r31: gdy wisi kolejka (pauza 'sesja' albo intencje w pamięci),
    // BLAD_TOKENA NIE wylogowuje — nakładka „Sesja wygasła" z przyciskiem
    // Google; po ponownym zalogowaniu dajStan potwierdza token i kolejka
    // sama się drenuje. Dotyczy też akcji z modali (grupy/członkowie)
    // padłych na wygasłym tokenie. Bez kolejki — po staremu: sprzątamy
    // zapamiętaną sesję (żeby F5 nie kręciło w kółko „Wracam do
    // dziennika…") i wracamy do logowania.
    if (blad === 'BLAD_TOKENA' && (S.pauza === 'sesja' || S.kolejka.length || S.wLocie)) {
      wyczyscSesje();
      S.pauza = 'sesja';
      zsynchronizujWisiace();
      renderuj();
      pokazNakladkeWygaslaSesje();
      return;
    }
    if (blad === 'BLAD_TOKENA') wyczyscSesje();
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
      banerPauzy() +
      banerAktualizacji() +
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
      '<p class="wersja">' + esc(S.stan.email) + ' · strona ' + WERSJA_UI + ' · serwer ' + esc(S.stan.wersja || '?') +
        ' · <button class="link-wyloguj" id="stopka-wyloguj" title="Zakończ sesję na tym urządzeniu">Wyloguj</button></p>' +
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
      // r26: lista od razu pełna (optymistyczne odświeżenie z potwierdzeniem);
      // szczegółów nie scalamy (import zwraca tylko liczby) — dajStan
      // dowiezie stan, retry aż go zobaczy (liczba zawodników rośnie)
      var przed = S.stan.zawodnicy.length;
      przyjmijStan(w, function () { /* licznik nietykalny do potwierdzenia */ },
        function (serwer) { return serwer.zawodnicy.length >= przed + (w.dodano || 0); });
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
      // r26: nowy członek widoczny od razu (id zwraca backend), edycja
      // scalana lokalnie; dajStan potwierdza z arkusza (z retry)
      if (z) {
        przyjmijStan(w, function (stan) {
          stan.zawodnicy.forEach(function (c) {
            if (c.id === z.id) { c.imie = imie; c.nazwisko = nazwisko; c.grupa = grupa; c.ur = ur; }
          });
        }, function (serwer) {
          var c = null;
          serwer.zawodnicy.forEach(function (x) { if (x.id === z.id) c = x; });
          return c ? (c.imie === imie && c.nazwisko === nazwisko && c.grupa === grupa) : false;
        });
      } else {
        var nowyId = w.id || '';
        przyjmijStan(w, function (stan) {
          if (nowyId && !stan.zawodnicy.some(function (c) { return c.id === nowyId; })) {
            stan.zawodnicy.push({ id: nowyId, imie: imie, nazwisko: nazwisko, grupa: grupa, aktywny: true, dolaczyl: lokalnaData(new Date()), ur: ur || '', uwagi: '' });
          }
        }, function (serwer) {
          return !nowyId || serwer.zawodnicy.some(function (c) { return c.id === nowyId; });
        });
      }
    };
    if (z) wywolaj('edytujCzlonka', { token: TOKEN, id: z.id, imie: imie, nazwisko: nazwisko, grupa: grupa, ur: ur }, zakoncz);
    else wywolaj('dodajCzlonka', { token: TOKEN, imie: imie, nazwisko: nazwisko, grupa: grupa, ur: ur }, zakoncz);
  });
}

/* ------------------------------------------------ odświeżanie: patrz scalZmiane/odswiezStan wyżej (r26) */

/* r26 („grupa dodaje się dopiero po przelogowaniu"): Google Sheets
 * NIE gwarantuje, że odczyt w KOLEJNYM wykonaniu Apps Script zobaczy
 * zapis z wykonania poprzedniego (dajStan tuż po dodajGrupe potrafi
 * wrócić ze stanem sprzed zmiany). Dlatego po każdej mutacji:
 *  1) OPTYMISTYCZNIE scalamy zmianę do S.stan (użytkownik widzi ją
 *     natychmiast), 2) odświeżamy z potwierdzeniem: dopóki dajStan
 *     nie pokaże zmiany, ponawiamy (max 3 próby) — po czym stan
 *     serwera wygrywa (arkusz = prawda).
 * r28 (docelowe rozwiązanie): backend v0.2.6+ dokleja do KAŻDEJ
 * odpowiedzi mutacji pełny „stan" z tego samego wykonania (spójny
 * z zapisem). Gdy jest — bierzemy go bez żadnego dajStan ani retry;
 * scalanie/retry zostaje jako fallback dla starszego serwera. */
function przyjmijStan(w, modyfikator, potwierdz) {
  // fast-path: serwer v0.2.6+ sam przysłał stan mutacji
  if (w && w.stan && !w.stan.brakDostepu) {
    S.stan = w.stan;
    // r32: stan wprost z odpowiedzi — obecności = prawda arkusza
    // (optymizm kolejki już nie istnieje; czekające intencje i tak
    // wizualizuje kropka z S.wisiace). Uwaga: stan z mutacji GRUP nie
    // zna intencji obecności — ale to bez znaczenia, bo kafel nie
    // opiera się już na „naniesionych" intencjach.
    if (!S.data) S.data = w.stan.dzisiaj || lokalnaData(new Date());
    renderuj();
    return;
  }
  // fallback (serwer v0.2.5): optymistyczny merge + potwierdzany retry
  scalZmiane(modyfikator, potwierdz);
}

function scalZmiane(modyfikator, potwierdz) {
  if (!S.stan) return;
  modyfikator(S.stan);
  renderuj();
  odswiezStan(null, 3, potwierdz);
}

/* r26: odświeżenie z „potwierdzeniem zmiany". potwierdz(stanSerwera) →
 * true = odczyt już widzi naszą zmianę (koniec), false = jeszcze nie →
 * kolejna próba po 1,2s (max `proby`). Bez potwierdzenia działa jak
 * zwykłe odswiezStan (jedno dajStan + render). */
function odswiezStan(cb, proby, potwierdz, cicho) {
  wywolaj('dajStan', { token: TOKEN }, function (e, w) {
    if (e) {
      /* r34: cicho=true (powrót do apki) — błąd sieci przy odświeżaniu
       * w tle NIE ma prawa zamiatać ekranu dziennika; user zostaje
       * na tym, co widział (dane i tak nie starsze niż jego ostatnia
       * akcja; przy następnej akcji dostanie normalny komunikat) */
      if (cicho) return;
      document.getElementById('app').innerHTML =
        '<div class="ekran-pelny"><h1 class="blad-tekst">Błąd połączenia</h1>' +
        '<p>' + esc(e.message) + '</p>' +
        '<div class="przyciski" style="display:flex;gap:10px;margin-top:8px">' +
        '<button class="btn-glowny" style="border:none;border-radius:10px;padding:12px 20px" onclick="location.reload()">Odśwież</button></div>' +
        '<p style="font-size:.8rem;color:var(--szary)">To zwykle chwilowa niedostępność. Jeśli trwa — zgłoś właścicielowi.</p></div>';
      return;
    }
    if (w && w.blad === 'BLAD_TOKENA') {
      // r31: gdy wisi kolejka (pauza 'sesja'), ZOSTAJEMY przy nakładce —
      // intencje czekają na ponowne zalogowanie, nie przerysowujemy
      // ekranu logowaniem. Odświeżamy tylko nakładkę (licznik). Bez
      // kolejki — po staremu: sprzątamy zapamiętany token (żeby F5 nie
      // kręciło w kółko „Wracam do dziennika…") → logowanie.
      if (S.pauza === 'sesja') {
        pokazNakladkeWygaslaSesje();
        return;
      }
      wyczyscSesje();
      TOKEN = '';
      start();
      return;
    }
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
    // r27: odczyt jeszcze NIE widzi naszej zmiany (spójność arkusza) →
    // NIE nadpisujemy stanu lokalnego (optymistyczna grupa by zniknęła);
    // ponawiamy po 1,2 s; po wyczerpaniu prób arkusz wygrywa (przyjmujemy
    // odczyt — użytkownik zobaczy stan faktyczny)
    if (potwierdz && !potwierdz(w)) {
      if (proby > 1) {
        setTimeout(function () { odswiezStan(cb, proby - 1, potwierdz); }, 1200);
        return;
      }
    }
    S.stan = w;
    // r31: pierwszy udany stan = moment na kolejkę z localStorage (F5
    // w trakcie wysyłki). Udany dajStan dowodzi, że token ŻYJE i arkusz
    // ODPOWIADA — więc obie pauzy ('sesja' i 'arkusz') schodzą.
    // r32: bez optymizmu — kafel pokaże prawdę arkusza, intencje
    // czekające w kolejce drenują się w tle (kropki z S.wisiace).
    if (!KOLEJKA_WCZYTANA) {
      odczytajKolejke();
      KOLEJKA_WCZYTANA = true;
    }
    S.pauza = null;
    if (!S.data) S.data = w.dzisiaj || lokalnaData(new Date());
    if (!S.sortowanie) S.sortowanie = (w.ustawienia && w.ustawienia.SORTOWANIE_DOMYSLNE) || 'imie';
    var zapisane = null;
    try { zapisane = localStorage.getItem('sortowanie'); } catch (ign) {}
    if (zapisane === 'imie' || zapisane === 'nazwisko') S.sortowanie = zapisane;
    if (cb) cb(); else renderuj();
    wysylaKolejke(); // r31: kolejka czeka? pętla rusza (pauza zdjęta/jej nie było)
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
  /* r29 mobile: lupa rozwija/zwija pole szukaj (drugi wiersz topbara);
   * przy otwarciu od razu focus — można pisać bez drugiego kliknięcia.
   * NIE renderujemy od nowa całej strony (fokus by przepadł) — tylko
   * dodajemy klasę i pokazujemy wiersz. */
  if (el('btn-szukaj')) el('btn-szukaj').addEventListener('click', function () {
    var rzad2 = document.getElementById('rzad2-mobilny');
    if (!rzad2) return;
    var otwarty = rzad2.dataset.otwarty === '1';
    if (otwarty && !document.getElementById('szukaj-mobilny').value) {
      rzad2.dataset.otwarty = ''; // zwijanie tylko pustego pola (nie gubimy wpisu)
      rzad2.classList.remove('otwarty');
      this.classList.remove('on');
    } else {
      rzad2.dataset.otwarty = '1';
      rzad2.classList.add('otwarty');
      this.classList.add('on');
      document.getElementById('szukaj-mobilny').focus();
    }
  });
  /* r29 mobile: szukaj w drugim wierszu — to samo zachowanie co desktopowe
   * (filtr w locie, bez pełnego renderu → focus zostaje) */
  if (el('szukaj-mobilny')) el('szukaj-mobilny').addEventListener('input', function () {
    S.szukane = this.value;
    var kontener = document.querySelector('.lista');
    var lista = widoczni();
    kontener.innerHTML = lista.map(kafelHtml).join('') +
      (S.bladAkcji ? dymekBledu() : '') ||
      '<p class="oplucie" style="text-align:center">Brak zawodników spełniających kryteria.</p>';
    podpinzKafelki();
    aktualizujLicznik();
  });
  /* r29 mobile: sortowanie jako JEDEN przełącznik — tap przełącza
   * imię ⇄ nazwisko (labelka przycisku odświeża się w pełnym renderze,
   * jak w desktopowym ustawSortowanie) */
  if (el('btn-sort-k')) el('btn-sort-k').addEventListener('click', function () {
    ustawSortowanie(S.sortowanie === 'nazwisko' ? 'imie' : 'nazwisko');
  });
  if (el('stopka-wyloguj')) el('stopka-wyloguj').addEventListener('click', function () { wyloguj(); });
  // r31: baner pauzy — powrót nakładki „Sesja wygasła" bez utraty kolejki
  if (el('baner-pauzy-zaloguj')) el('baner-pauzy-zaloguj').addEventListener('click', function () {
    pokazNakladkeWygaslaSesje();
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
  /* r29: dwa warianty tekstowe (desktop „N/M obecnych", mobile „N/M");
   * fallback textContent gdyby stary render nie miał spany w środku */
  var pelny = el.querySelector('.pelny');
  var krotki = el.querySelector('.krotki');
  if (pelny && krotki) {
    pelny.textContent = ile + '/' + lista.length + ' obecnych';
    krotki.textContent = ile + '/' + lista.length;
  } else {
    el.textContent = ile + '/' + lista.length + ' obecnych';
  }
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
  var przWyloguj = document.getElementById('stopka-wyloguj');
  if (przWyloguj) przWyloguj.addEventListener('click', function () { wyloguj(); });
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
        // r26: potwierdzenie z arkusza (dajStan może jeszcze nie widzieć
        // zmiany — wtedy by wrócił stary stan i kafel „wskrzesiłby" się)
        odswiezStan(null, 3, function (serwer) {
          var c = null;
          serwer.zawodnicy.forEach(function (x) { if (x.id === z.id) c = x; });
          return c ? c.aktywny === nowyStan : true;
        });
      });
    });
  });
}

/* ------------------------------------------------ logowanie (Google Identity Services) */
/** Zmiana konta / świadome zakończenie sesji: zrywamy token, wyłączamy
 * auto-wybór konta GIS, porzucamy czekającą kolejkę (r31: inna osoba
 * na urządzeniu nie może drenować cudzych intencji), przeładowanie.
 * UWAGA: konfiguracja (API/klucz) zostaje — to ustawienia strony, nie sesji. */
function wyloguj() {
  TOKEN = '';
  wyczyscSesje(); // r28: „zaloguj jako ktoś inny" NIE może wrócić starym tokenem
  try { localStorage.removeItem(KLUCZ_KOLEJKI); } catch (ign) {} // r31: porzucamy intencje
  WYLOGOWANY_WLASNIE = true; // r28: bez One Tap zaraz po świadomym wylogowaniu
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
      // r28: One Tap — na ekranie logowania Google próbuje najpierw
      // jednoklikowego wyboru konta (zapisanego w przeglądarce);
      // wyłączone tylko gdy user świadomie wylogował się przed chwilą
      // (skipped moment) — wtedy pełne okno wyboru konta
      if (!WYLOGOWANY_WLASNIE) {
        try {
          google.accounts.id.prompt(function (n) {
            //„moment" notyfikacji: skippowane (rate limit / wylogowanie)
            // = nic; user może kliknąć zwykły przycisk poniżej
          });
        } catch (ign) { }
      }
      return;
    }
    if (++proby < 40) setTimeout(czekaj, 250); // 10 s na załadowanie GIS
  })();
}

function poZalogowaniu(token) {
  TOKEN = token;
  zapiszSesje(token); // r28: przeładowanie strony nie wyrzuca do logowania
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
  // r34: strona = APLIKACJA — najpierw sprawdzamy, czy na GitHub Pages
  // jest nowsza wersja (wersja.json, no-store); user ma się logować
  // ZAWSZE do najnowszej (ustalenie z właścicielem, „ważne!").
  sprawdzWersjeStrony();
  // r17 (ekran logowania ma być PIERWSZY, zawsze): konfiguracja strony
  // nie blokuje wejścia — braki pokazuje żółta kartka na ekranie
  // logowania, kartę ustawień otwiera właściciel linkiem na dole.
  // r28: zapamiętana sesja (localStorage) — F5 NIE wyrzuca do logowania;
  // token wygasły sprzątamy po stronie BLAD_TOKENA w odswiezStan.
  if (TOKEN) { odswiezStan(); return; }
  var zapamietany = odczytajSesje();
  if (zapamietany) {
    TOKEN = zapamietany;
    document.getElementById('app').innerHTML =
      '<div class="ekran-pelny"><div class="spinner"></div><p>Wracam do dziennika…</p></div>';
    odswiezStan();
    return;
  }
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

/* r34: powrót do apki (odlokowanie telefonu / karta na wierzch) traktujemy
 * jak otwarcie aplikacji: (1) sprawdzamy wersję — auto-aktualizacja,
 * (2) CICHY dajStan — obecności zaznaczone na INNYM urządzeniu (drugi
 * trener, ten sam trening) pojawiają się same, bez działania usera.
 * Multi-urządzenie: duplikatom i tak zapobiega idempotentny backend
 * (ten sam zawodnik+dzień → istnialo:true, zero nowego wiersza), tu
 * chodzi o to, by drugi trener WIDZIAŁ stan pierwszego przed tapnięciem.
 * Cisza przy błędzie sieci (patrz odswiezStan); nie odświeżamy w trakcie
 * wysyłki/kolejki (własne zmiany i tak nadejdą z odpowiedzi mutacji). */
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState !== 'visible') return;
  sprawdzWersjeStrony();
  if (TOKEN && S.stan && !S.wLocie && !S.kolejka.length && !S.pauza) {
    odswiezStan(null, null, null, true);
  }
});
