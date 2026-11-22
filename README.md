# Dziennik Obecności — KTS Gliwice

**Strona trenerów** (frontend) aplikacji „Dziennik Obecności" klubu tenisa
stołowego KTS Gliwice — zapis obecności na treningach jednym tapnięciem.

## Jak to działa

- **Ta strona (GitHub Pages)** — interfejs: logowanie kontem Google,
  kafelki zawodników, tap = obecność. To jest ten adres, który znają
  trenerzy.
- **API (Google Apps Script)** — pośrednik: przyjmuje żądania strony,
  sprawdza tożsamość (token Google) i białą listę, zapisuje dane w arkuszu.
- **Arkusz Google (Drive)** — baza danych klubu: uczestnicy, obecności,
  archiwum, log. Dostęp do niego mają tylko uprawnione konta.

Dostęp ma wyłącznie osoba, która: (1) zaloguje się kontem Google i
(2) jest na białej liście w arkuszu (dodaje właściciel). Bez tego strona
pokazuje tylko ekran logowania/odmowy — żadnych danych klubu tu nie ma.

## Techniczne

- Pliki: `docs/index.html` + `docs/config.js` (adres API i Client ID
  OAuth) + `docs/app.js` (logika; bez zależności, bez buildera).
- Hosting: GitHub Pages (branch `main`, folder `/docs`).
- Responsywna: telefon 375 px → desktop.
- Aktualizacja UI: podmiana plików w `docs/` (repo prywatne trzyma
  źródło i testy; publiczne dostaje gotową stronę).

---
Właściciel projektu: KTS Gliwice. Backend: Google Apps Script + Arkusze Google.
