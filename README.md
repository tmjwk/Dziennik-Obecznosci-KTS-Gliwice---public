# Dziennik Obecności — KTS Gliwice

To repozytorium to **hosting plików strony** aplikacji „Dziennik
Obecności" klubu tenisa stołowego KTS Gliwice (zapis obecności na
treningach jednym tapnięciem).

## Jak to działa

- **Aplikacja** żyje pod adresem wdrożenia Google Apps Script (kończy
  się na `/exec`) — tam Google sam pokazuje okienko logowania kontem
  Google, a po zalogowaniu działa cała apka. To ten adres otwierają
  trenerzy.
- **To repo (GitHub Pages)** trzyma pliki interfejsu: `docs/index.html`
  (style inline), `docs/config.js`, `docs/app.js`. Strona pobiera je
  z Pages i rozmawia z API Apps Script (fetch POST /exec) — dzięki temu
  **zmiana wyglądu = push do tego repo**, bez ruszania Apps Script.
- **Arkusz Google (Drive)** to baza danych klubu: uczestnicy,
  obecności, archiwum, log. Dostęp = udostępnienie arkusza (Edytor)
  + biała lista (zakładka `Biala_lista`).

Otwarcie strony bezpośrednio na GitHub Pages pokazuje ekran
„To nie jest aplikacja" — to zamierzone (tu nie ma sesji Google ani
danych; apka działa tylko pod `/exec`).

## Techniczne

- Hosting: GitHub Pages (branch `main`, folder `/docs`).
- Bez zależności, bez buildera — czysty HTML/CSS/JS.
- Responsywna: telefon 375 px → desktop.
- Repo prywatne (projekt) trzyma źródło, testy i backend Apps Script;
  to repo dostaje gotową stronę.

---
Właściciel projektu: KTS Gliwice. Backend: Google Apps Script + Arkusze Google.
