/* =================================================================
 * Dziennik Obecności KTS Gliwice — frontend v0.2.1
 * Stara, sprawdzona logika ze Strona.html (v0.1.6a): google.script.run
 * → backend Apps Script → arkusz Google. Runda 16: strona żyje jako
 * pliki na GitHub Pages, a Apps Script (doGet) podaje ją jako Web App
 * pod /exec — tam Google sam pokazuje okienko logowania kontem.
 * Naprawione przy okazji wydzielania (błędy martwych ścieżek w v0.1.6a):
 *   - modalDodajEdytuj: brak createElment(tlo) → ReferenceError,
 *   - dodajCzlonka/edytujCzlonka: argumenty rozdzielone (nie tablica),
 *   - importujUczestnikow: zwykły argument (nie tablica).
 * ================================================================= */

'use strict';

var WERSJA_UI = 'v0.2.1';
var GAS = (typeof google !== 'undefined' && google.script && google.script.run);

/* ------------------------------------------------ stan aplikacji */
var S = {
  stan: null,            // odpowiedź dajStan()
  data: '',              // RRRR-MM-DD wybranej daty
  grupa: '*',            // '*' = wszystkie
  sortowanie: 'imie',    // 'imie' | 'nazwisko'
  szukane: '',
  trybCzlonkowie: false, // czy otwarty widok członków
  tapy: {},              // { idZawodnika: {n: liczba tapów, t: timestamp} }
  timery: {},            // timery resetu tapów per zawodnik
  wisiace: {}            // { idZawodnika: 'zapis'|'usun'|'blad' }
};

/* ------------------------------------------------ warstwa serwera */
/** Wywołuje funkcję backendu; argumenty zawsze w TABLICY (backend ma
 * funkcje 1-, 2- i 5-argumentowe — apply z tablicą obsługuje wszystkie). */
function wywolaj(fn, argumenty, cb) {
  if (!GAS) {
    // Ten plik otwarty BEZPOŚREDNIO na GitHub Pages to nie jest aplikacja
    // (brak sesji Google i bramki google.script.run). Aplikacja żyje pod
    // adresem wdrożenia /exec — tam Google sam pokazuje okienko logowania
    // kontem i działa cała apka. URL wdrożenia ma właściciel (Apps Script:
    // Wdróż → Zarządzaj wdrożeniami 🌐); nie zgadujemy go w kodzie.
    document.getElementById('app').innerHTML =
      '<div class="ekran-pelny">' +
      '<h1>To nie jest aplikacja</h1>' +
      '<p>Ten adres to tylko hosting plików strony (GitHub).</p>' +
      '<p><b>Aplikację otwiera się pod adresem wdrożenia</b> — tym od Google,' +
      ' który kończy się na <b>/exec</b>. Tam pojawia się okienko logowania' +
      ' kontem Google i działa cała apka.</p>' +
      '<p>Jeśli trafiłeś tu ze starego linku, poproś właściciela o aktualny' +
      ' adres (ma go w Apps Script: Wdróż → Zarządzaj wdrożeniami 🌐).</p>' +
      '<p style="font-size:.8rem">' + WERSJA_UI + '</p>' +
      '</div>';
    return;
  }
  google.script.run
    .withSuccessHandler(function (w) { cb(null, w); })
    .withFailureHandler(function (e) { cb(e); })
    [fn].apply(null, argumenty || []);
}

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
    // wyróżniamy przyczynę: brak dostępu do PLIKU arkusza vs brak na białej liście
    if (S.stan.arkuszBrak) {
      app.innerHTML =
        '<div class="ekran-pelny">' +
        '<h1>Połącz z arkuszem</h1>' +
        '<p>Jesteś zalogowany jako <b>' + esc(S.stan.email || '(nieznane konto)') + '</b>.</p>' +
        '<p>Ten dziennik zapisuje dane w arkuszu Google klubu. Twoje konto nie ma jeszcze dostępu do tego arkusza.</p>' +
        '<p><b>Co zrobić:</b> poproś właściciela arkusza o udostępnienie Ci pliku arkusza z prawem <b>Edytora</b>, a potem wróć i odśwież tę stronę.</p>' +
        '<button class="btn-glowny" style="padding:12px 20px;border:none;border-radius:10px" onclick="location.reload()">Spróbuj ponownie</button>' +
        '<p style="font-size:.8rem">' + WERSJA_UI + '</p>' +
        '</div>';
      return;
    }
    app.innerHTML =
      '<div class="ekran-pelny">' +
      '<h1>Brak dostępu</h1>' +
      (S.stan.pustaLista
        ? '<p>Biała lista jest jeszcze pusta. Dodaj swój adres e-mail w zakładce <b>Biala_lista</b> w arkuszu, a potem odśwież tę stronę.</p>'
        : '<p>Konto <b>' + esc(S.stan.email || '(nieznane)') + '</b> nie ma dostępu do dziennika. Skontaktuj się z administratorem klubu.</p>') +
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
      // grupy: obiekty {kod, nazwa} — na chipie pokazujemy nazwę, jeśli jest
      S.stan.grupy.map(function (g) {
        return przyciskGrupy(g.kod, g.nazwa || g.kod);
      }).join('') +
    '</div>' +
    '<div class="lista">' +
      lista.map(kafelHtml).join('') +
      (lista.length === 0 ? '<p class="oplucie" style="text-align:center">Brak zawodników spełniających kryteria.</p>' : '') +
    '</div>' +
    '<div class="stopka">' +
      '<p class="wersja">' + esc(S.stan.email) + ' · ' + WERSJA_UI + '</p>' +
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
  var obecnosciDzien = S.stan.obecnosci[S.data] || [];
  var obecny = obecnosciDzien.indexOf(z.id) !== -1;
  var tap = S.tapy[z.id];
  var klasy = ['kafel'];
  var ikonaStatusu;

  if (S.wisiace[z.id] === 'blad') {
    klasy.push('blad');
    ikonaStatusu = obecny ? '✓' : '·';
  } else if (S.wisiace[z.id]) {
    klasy.push('synchronizacja');
    ikonaStatusu = obecny ? '✓' : '·';
  } else if (obecny && tap && tap.n > 0) {
    klasy.push('potwierdz');
    ikonaStatusu = 'USUŃ? ' + (tap.n) + '/3';
  } else if (obecny) {
    klasy.push('obecny');
    ikonaStatusu = '✓';
  } else {
    ikonaStatusu = '·';
  }

  // „USUŃ? n/3" to tabletka, nie kółko — klasa zamiast stylu inline
  var statusHtml = (ikonaStatusu && ikonaStatusu.indexOf('USUŃ') === 0)
    ? '<span class="status usun">' + ikonaStatusu + '</span>'
    : '<span class="status">' + ikonaStatusu + '</span>';

  // Dwa wiersze nazwy (ekran 9:16): wiersz 1 = imię albo nazwisko (wg
  // sortowania), wiersz 2 = drugi człon + status obok, wiersz 3 = grupa.
  var pierwsza = S.sortowanie === 'nazwisko' ? z.nazwisko : z.imie;
  var druga = S.sortowanie === 'nazwisko' ? z.imie : z.nazwisko;

  var html =
    '<button class="' + klasy.join(' ') + '" data-id="' + esc(z.id) + '">' +
    '<span class="nazwa"><b>' + esc(pierwsza) + '</b></span>' +
    '<span class="wiersz-nazwy">' +
      '<span class="nazwa"><b>' + esc(druga) + '</b></span>' +
      statusHtml +
    '</span>' +
    '<span class="grupa-etykieta">' + esc(z.grupa) + '</span>' +
    '</button>';

  if (S.wisiace[z.id] === 'blad') {
    html += '<div class="ponow">Nie zapisano obecności ' + esc(z.imie) + '. <button data-ponow="' + esc(z.id) + '">Ponów</button></div>';
  }
  return html;
}

/* tap w kafel: nieobecny → zapis; obecny → licznik do 3 → usunięcie */
function tapZawodnika(z) {
  var dzien = S.stan.obecnosci[S.data] || [];
  var obecny = dzien.indexOf(z.id) !== -1;

  if (!obecny) {
    // 1 tap = obecny (optymistycznie)
    dzien.push(z.id);
    S.stan.obecnosci[S.data] = dzien;
    S.wisiace[z.id] = 'zapis';
    renderuj();
    wywolaj('zapiszObecnosc', [z.id, S.data], function (e) {
      delete S.wisiace[z.id];
      if (e) {
        // utrata dostępu do arkusza w trakcie sesji → ekran „Połącz z arkuszem"
        if (String(e.message) === 'ARKUSZ_BRAK') {
          odswiezStan(function () { renderuj(); });
          return;
        }
        S.wisiace[z.id] = 'blad';
      }
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
    // reset po 2 s bezczynności
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
  wywolaj('usunObecnosc', [z.id, S.data], function (e) {
    delete S.wisiace[z.id];
    if (e) {
      if (String(e.message) === 'ARKUSZ_BRAK') {
        odswiezStan(function () { renderuj(); });
        return;
      }
      S.wisiace[z.id] = 'blad';
    }
    renderuj();
  });
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
    '</div>' +
    '<div class="stopka">' +
      '<p class="wersja">' + esc(S.stan.email) + ' · ' + WERSJA_UI + '</p>' +
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

/** Import hurtowy (v0.1.5): modal z polem na listę „Nazwisko Imię". */
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
    wywolaj('importujUczestnikow', [tekst], function (e, wynik) {
      tlo.remove();
      if (e) { alert('Błąd importu: ' + e.message); return; }
      var raport = 'Dodano: ' + wynik.dodano + ' · pominięto (już są): ' + wynik.pominieto;
      if (wynik.bledy && wynik.bledy.length) {
        raport += '\n\nWiersze z problemami (popraw i wklej ponownie tylko te):\n' + wynik.bledy.join('\n');
      }
      alert(raport);
      odswiezStan(function () { renderuj(); });
    });
  });
}

function modalDodajEdytuj(z) {
  // grupy: obiekty {kod, nazwa} z zakładki Grupy (nowa grupa zapisze się
  // do arkusza sama — backend: ensureGrupa w dodajCzlonka/edytujCzlonka)
  var tlo = document.createElement('div');
  tlo.className = 'tlo-modal';
  var kody = S.stan.grupy.map(function (g) { return g.kod; });
  var grupyOpcje = S.stan.grupy.slice();
  if (z && z.grupa && kody.indexOf(z.grupa) === -1) {
    grupyOpcje.push({ kod: z.grupa, nazwa: '' });
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
    var ur = tlo.querySelector('#f-ur').value; // type=date daje '' albo RRRR-MM-DD
    var grupa = sel.value === '__nowa'
      ? tlo.querySelector('#f-nowa').value.trim().toUpperCase().replace(/\s+/g, '')
      : sel.value;
    if (!imie || !nazwisko) { alert('Imię i nazwisko są wymagane.'); return; }
    if (!grupa) grupa = 'GR1';

    var zakoncz = function (e) {
      tlo.remove();
      if (e) {
        if (String(e.message) === 'ARKUSZ_BRAK') {
          odswiezStan(function () { renderuj(); });
          return;
        }
        alert('Błąd zapisu: ' + e.message);
        return;
      }
      odswiezStan(function () { renderuj(); });
    };
    if (z) wywolaj('edytujCzlonka', [z.id, imie, nazwisko, grupa, ur], zakoncz);
    else wywolaj('dodajCzlonka', [imie, nazwisko, grupa, ur], zakoncz);
  });
}

/* ------------------------------------------------ odświeżanie */
function odswiezStan(cb) {
  wywolaj('dajStan', [], function (e, stan) {
    if (e) {
      var app = document.getElementById('app');
      // ARKUSZ_BRAK z wywołania (np. po utracie dostępu w trakcie sesji)
      // → ten sam ekran „Połącz z arkuszem", co przy starcie
      if (String(e && e.message) === 'ARKUSZ_BRAK') {
        S.stan = { wersja: WERSJA_UI, email: '', arkuszBrak: true, brakDostepu: true };
        renderuj();
        if (cb) cb();
        return;
      }
      app.innerHTML = '<div class="ekran-pelny"><h1 class="blad-tekst">Błąd połączenia</h1>' +
        '<p>' + esc(e.message || e) + '</p>' +
        '<button class="btn-glowny" style="padding:12px 20px;border:none;border-radius:10px" onclick="location.reload()">Odśwież</button></div>';
      return;
    }
    S.stan = stan;
    if (!S.data) S.data = stan.dzisiaj || lokalnaData(new Date());
    if (!S.sortowanie) S.sortowanie = (stan.ustawienia && stan.ustawienia.SORTOWANIE_DOMYSLNE) || 'imie';
    var zapisane = null;
    try { zapisane = localStorage.getItem('sortowanie'); } catch (ign) {}
    if (zapisane === 'imie' || zapisane === 'nazwisko') S.sortowanie = zapisane;
    if (cb) cb();
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
    // odświeżamy tylko listę (bez przebudowy inputu, żeby nie tracić fokusa)
    var kontener = document.querySelector('.lista');
    var lista = widoczni();
    kontener.innerHTML = lista.map(kafelHtml).join('') ||
      '<p class="oplucie" style="text-align:center">Brak zawodników spełniających kryteria.</p>';
    podpinzKafelki();
    podpinzPonow();
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
      S.grupa = this.getAttribute('data-grupa');
      renderuj();
    });
  });

  podpinzKafelki();
  podpinzPonow();
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

function podpinzPonow() {
  document.querySelectorAll('button[data-ponow]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = this.getAttribute('data-ponow');
      delete S.wisiace[id];
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
    // przebudowa listy bez ruszania inputu; kolejność zgoda z S.sortowanie
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

      // przelącz aktywność (deaktywacja = „anulowanie członka", historia zostaje)
      var nowyStan = !z.aktywny;
      if (nowyStan === false &&
          !confirm('Deaktywować ' + z.imie + ' ' + z.nazwisko + '?\nZniknie z listy obecności, historia zostanie zachowana.')) {
        return;
      }
      wywolaj('przelaczAktywnosc', [z.id, nowyStan], function (e) {
        if (e) {
          if (String(e.message) === 'ARKUSZ_BRAK') {
            odswiezStan(function () { renderuj(); });
            return;
          }
          alert('Błąd: ' + e.message);
          return;
        }
        z.aktywny = nowyStan;
        renderuj();
      });
    });
  });
}

/* ------------------------------------------------ start */
(function start() {
  odswiezStan(function () { renderuj(); });
})();
