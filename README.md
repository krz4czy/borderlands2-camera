# Borderlands 2 Camera

Aparat w przeglądarce, który robi z obrazu z kamery grafikę w stylu Borderlands 2: grube kontury tuszem, płaskie plamy koloru (3–4 tony), kreskowanie w cieniach, ciepła paleta, ziarno i winieta. Wszystko liczy się na GPU (WebGL), więc chodzi płynnie na iPhonie.

**Live:** https://krz4czy.github.io/borderlands2-camera/

## Co jest w środku

- Filtr WebGL: 4× filtr bilateralny, krawędzie Sobel + DoG, pogrubianie i czyszczenie konturów, pasma cieni, kreskowanie, paleta, ziarno, winieta.
- HUD gracza: tarcza, zdrowie, amunicja, granaty, pasek XP z poziomem, kompas i celownik.
- Plakietki wrogów nad ludźmi i zwierzętami z detektora MediaPipe EfficientDet-Lite0 (COCO). Kot to np. Feral Kitty albo Badass Skag, pies to Skag Pup albo Alpha Skag, ptak to Rakk, koń lub krowa to Bullymong.
- Rekwizyty AR: skag z otwieraną trójdzielną paszczą, bela siana i czerwona skrzynia. Do tego rewolwer w pierwszej osobie.
- Menu ⚙ w stylu menu pauzy, gdzie każdy element włączasz osobno. Ustawiają się tu też grubość konturów i siła filtra, a wszystko zapisuje się w przeglądarce.
- REC nagrywa obraz razem z HUD-em: MP4 na iPhonie, WebM gdzie indziej. 📸 robi PNG. Przycisk ZAPISZ otwiera arkusz udostępniania iOS (np. „Zapisz wideo”).
- ⟲ przełącza przednią i tylną kamerę. Obraz z przedniej jest lustrzany.

Test bez kamery: `index.html?test=URL_obrazka_lub_wideo&raw`.

## Prawa

To fanowski filtr wizualny, nie oficjalny produkt Gearbox / 2K. Borderlands jest znakiem towarowym swoich właścicieli. Wszystkie grafiki (HUD, skag, rekwizyty, broń) są narysowane od zera w kodzie. Nie ma tu żadnych plików, fontów ani logo z gry. Font to Bangers (Google Fonts, OFL).

## Jak odpalić

Kamera działa tylko przez HTTPS albo na `localhost`. Na iPhonie otwórz stronę w Safari i zezwól na kamerę.
