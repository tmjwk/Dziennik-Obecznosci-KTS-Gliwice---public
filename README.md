# Dziennik Obecności — KTS Gliwice (strona informacyjna)

Publiczna **wizytówka** aplikacji „Dziennik Obecności" dla klubu tenisa
stołowego KTS Gliwice. Od rundy 14 (2026-11-22) strona publiczna NIE jest
podglądem interfejsu z danymi przykładowymi — koniec z mockupami (decyzja
właściciela). Znajdziesz tu opis możliwości aplikacji i zasady dostępu.

- Aplikacja właściwa: **Web App Google Apps Script** (adres `/exec`,
  udostępniany przez właściciela klubu trenerom wraz z dostępem).
- Kod źródłowy: **repozytorium prywatne** (decyzja właściciela).
- Dane zawodników: **arkusz Google klubu**, dostęp tylko dla uprawnionych
  kont (udostępnienie pliku + biała lista); każda obecność podpisana
  kontem trenera.

## Techniczne

- Jeden plik: `docs/index.html` (HTML + CSS, bez zależności, bez buildera).
- Hosting: GitHub Pages (branch `main`, folder `/docs`).
- Responsywna: telefon 375 px → tablet → desktop.
- Aktualizacja: `python3 scripts/build_public_page.py` (w środowisku
  roboczym) → przegląd diffu → commit + push; Pages przebuduje się sam.
