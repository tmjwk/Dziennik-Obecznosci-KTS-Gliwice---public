# Dziennik Obecności — KTS Gliwice

**Strona (frontend) aplikacji „Dziennik Obecności" klubu tenisa stołowego
KTS Gliwice** — zapis obecności na treningach jednym tapnięciem.

## Jak działa

1. Użytkownik wchodzi na **tę stronę** (adres GitHub Pages).
2. Pierwsze co widzi: **„Zaloguj się z Google"** — logowanie kontem Google
   (Google Identity Services).
3. Po zalogowaniu widzi sekcję zapisu danych do arkusza: kafelki
   zawodników, tap = obecność, 3 tapy = usunięcie, widok Członkowie
   (dodawanie, edycja, import listy).

Dane żyją w arkuszu Google klubu; strona zapisuje je przez API
Google Apps Script. Dostęp: e-mail musi być na białej liście
(zakładka `Biala_lista` w arkuszu) — dodaje właściciel.

## Dla właściciela

Strona wymaga dwóch ustawień w `docs/config.js` (adres API + Client ID) —
szczegóły w CZYTAJ-TO z paczki wdrożeniowej. Bez nich strona pokazuje
kartę „Połącz stronę z arkuszem".

## Techniczne

- Hosting: GitHub Pages (branch `main`, folder `/docs`).
- Bez zależności, bez buildera — czysty HTML/CSS/JS.
- Responsywna: telefon 375 px → desktop.
- Repo prywatne (projekt) trzyma źródło, testy i backend Apps Script.
