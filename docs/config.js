/* ============================================================
 * Dziennik Obecności KTS Gliwice — konfiguracja strony
 * (strona żyje na GitHub Pages, dane zapisuje w arkuszu Google
 *  przez API Apps Script)
 *
 * DWA pola do wypełnienia (właściciel projektu — patrz CZYTAJ-TO):
 *
 * API   — adres wdrożenia Apps Script, kończy się na /exec
 *         (script.google.com → Wdróż → Zarządzaj wdrożeniami → 🌐)
 *
 * KLUCZ — Client ID OAuth z Google Cloud Console
 *         (console.cloud.google.com → APIs & Services → Credentials →
 *          Create credentials → OAuth client ID → typ „Web application",
 *          w „Authorized JavaScript origins" wklej adres tej strony:
 *          https://tmjwk.github.io)
 *         wygląda tak: 1234567890-abc…apps.googleusercontent.com
 *
 * Wartości wkleja Zet do tego pliku, gdy właściciel je prześle
 * (albo właściciel sam w GitHubie: edycja pliku docs/config.js).
 * Bez tych dwóch wartości strona pokaże kartę „Połącz stronę
 * z arkuszem" — trenerzy nie zobaczą wtedy logowania.
 * ============================================================ */

var KONFIG = {
  // adres wdrożenia przesłany przez właściciela (runda 26, 2026-11-23:
  // nowe wdrożenie „Version 5" — stare zostało usunięte przy aktualizacji,
  // więc adres się zmienił; stary (r18) jest martwy)
  API: 'https://script.google.com/macros/s/AKfycby90_ekZjH6FE7npi-X4RDPkJYfKXwQlnXPgGe1SVUBwCVKd5hjkxbrn_jSufwdYEgC-A/exec',
  // Client ID OAuth przesłany przez właściciela (runda 23, 2026-11-22);
  // backend pieczętuje go sam przy pierwszym logowaniu (aud = CLIENT_ID)
  KLUCZ: '721854294567-4shhuesqrg78pbhq96qtqueoqa18os8i.apps.googleusercontent.com'
};
