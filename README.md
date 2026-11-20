# Dziennik Obecności KTS Gliwice — PODGLĄD (demo)

Publiczna strona **podglądowa** aplikacji „Dziennik Obecności" dla klubu
tenisa stołowego KTS Gliwice. Pokazuje interfejs z **danymi przykładowymi**
(TRYB DEMO) — bez logowania, bez połączenia z arkuszem Google, bez danych
rzeczywistych zawodników.

## Co tu jest, a czego nie ma

| | tu (podgląd) | aplikacja właściwa |
|---|---|---|
| Dane | przykładowe (~12 osób) | prawdziwe (~35 zawodników) |
| Zapisywanie obecności | nie (tylko na ekranie) | tak — do arkusza Google |
| Logowanie | nie | konto Google + biała lista |
| Kod backendu | nie | repo **prywatne** |

## Dlaczego osobne repo

Kod źródłowy i dane klubu zostają w **repozytorium prywatnym** (decyzja
właściciela). To repo zawiera wyłącznie statyczną stronę podglądową UI —
żadnych danych osobowych, żadnych kluczy.

## Techniczne

- Jeden plik: `docs/index.html` (HTML + CSS + JS, bez zależności, bez buildera).
- Hosting: GitHub Pages (branch `main`, folder `/docs`).
- Responsywna: telefon 375 px → tablet → desktop.
- Aktualizacja podglądu = podmiana `docs/index.html` przy nowej wersji UI.

---
Kontakt: właściciel klubu KTS Gliwice. Aplikacja: Google Apps Script + Arkusze Google.
