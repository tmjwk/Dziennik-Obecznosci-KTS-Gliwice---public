/* ============================================================
 * Dziennik Obecności KTS Gliwice — konfiguracja frontendu
 * (strona żyje na GitHub Pages, dane bierze z API Apps Script)
 *
 * DWA pola do wypełnienia (robi to właściciel — patrz CZYTAJ-TO):
 *
 * API   — URL wdrożenia Apps Script, kończy się na /exec
 *         (script.google.com → Wdróż → Zarządzaj wdrożeniami → 🌐)
 *
 * KLUCZ — Client ID OAuth (Google Cloud Console → APIs & Services →
 *         Credentials → OAuth client ID, typ „Aplikacja internetowa",
 *         „Autoryzowane źródła JavaScript": adres strony na GitHub Pages)
 *         wygląda tak: 1234567890-abc…apps.googleusercontent.com
 *
 * Trenerzy NIE muszą tu nic wpisywać: dostają od właściciela link
 * z ustawieniami w adresie (…/#api=…&klucz=…) — strona zapisze je
 * sama przy pierwszym otwarciu. Ręcznie można je też wpisać na
 * stronie w ⚙ (przycisk w prawym górnym rogu ekranu logowania).
 * ============================================================ */

var KONFIG = {
  API: '',   // <- wklej URL wdrożenia (/exec)
  KLUCZ: ''  // <- wklej Client ID OAuth (…apps.googleusercontent.com)
};
