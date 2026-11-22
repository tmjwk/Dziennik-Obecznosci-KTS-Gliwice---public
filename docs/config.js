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
  // adres wdrożenia przesłany przez właściciela (runda 18, 2026-11-22)
  API: 'https://script.google.com/macros/s/AKfycbyUE2KFmvbfOa2JcYfTJoMVzYvyEGHiprqTKKpGCzkBE8OZJbdeqR2m4q-WVeBhwWOZvg/exec',
  KLUCZ: ''  // <- Client ID OAuth (…apps.googleusercontent.com) — czeka na właściciela
};
