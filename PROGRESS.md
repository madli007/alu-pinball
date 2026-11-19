# PROGRESS — ALU PINBALL 2.0 remaster

> Dnevnik napredka za izvedbo `PROMPT.md`. Sproti se posodablja, da lahko naslednja seja
> nadaljuje, če zmanjka tokenov. Nova seja: preberi `PROMPT.md`, nato ta dokument.

Zadnja posodobitev: 2026-11-19

## Načrt (koraki)
- [x] 1. Arhitektura: `index.html` + `src/*.js` ES moduli (config, bus, table, physics, rules, audio, input, ui, storage, main, render/{art,gl,scene,lights,dmd,renderer}).
- [x] 2. Nova postavitev mize z rampo (plast 1), 4 misije, wizard, mystery, super jackpot, add-a-ball, combo. Uglašeno z botom.
- [x] 3. WebGL izris: brušen aluminij (shader), talina (fbm), dinamične luči žogic, bloom (dual kawase), končna obdelava (ACES, vinjeta, CA, distorzija nad pečjo, perspektiva). 2D rezerva brez WebGL.
- [x] 4. DMD (128×32, lastna pisava 5×7 s šumniki), svetlobni šovi + attract, kamera (shake, slow-mo, zoom, parallax).
- [x] 5. UI: steklo, Google Fonts, zasloni, top 10 + statistika (localStorage v try/catch).
- [x] 6. Zvok: reverb (konvolucija), panning, proceduralna glasba s plastmi.
- [x] 7. Kontrole: tipkovnica, dotik, gamepad, pavza ob izgubi fokusa.
- [x] 8. `tests.html` + `node tests/run-node.mjs` (38 testov uspešnih).
- [x] 9. Preverjanje v brskalniku (desktop, 1440×900, 375×812), zmogljivost (~2 ms/frame pri 1040×1733), konzola brez napak.
- [x] 10. `README.md` posodobljen, commit na `main` (brez push).

## Dnevnik
- 2026-11-19: Implementirano vse jedro, fizika in pravila testirani v Node (bot: povprečna igra ~5 min).
  Grafika deluje v brskalniku (WebGL). Odpravljeno: ohišje je prekrivalo mizo, pregoreli bumperji,
  samodejna kakovost je napačno padla zaradi 30 Hz rAF (zdaj se vrne nazaj, če znižanje ne pomaga).

## Opombe
- Strežnik: `.claude/launch.json` v `D:\Git\Brainstorm` (konfiguracija `pinball`, http-server@14.1.1).
- Geometrija: rampa vhod x 172–202 pri y 545, lasnica do y≈268, izhod na levi inlane (78, 690).
  Orbit ustje dvignjeno na (68,400)–(125,440), da je dosegljiv z desnega flipperja.
- V konzoli: `__pinball.snap(x, y, w, h, merilo)` nariše mizo v polni ločljivosti za pregled.
- 2026-11-19: Preverjeno v brskalniku (namizje, širok zaslon s paneli, telefon 375×812), celotna igra z botom
  do vpisa rekorda brez napak, 2D rezerva brez WebGL deluje, zvok brez izjem. Commit na `main`.

## Ni bilo preverjeno
- Dejansko poslušanje zvoka/glasbe (preverjeno le, da se ustvari brez napak).
- Pravi telefon in pravi gamepad (le emulacija velikosti zaslona; gamepad koda ni testirana s strojno opremo).
- Občutek igranja z roko pri 60 fps (pregledovalnik je bil skrit/omejen na ~30 fps; fizika je testirana skriptno).

## Naslednje (za morebitno novo sejo)
- Vsi koraki iz `PROMPT.md` so opravljeni in commitani (`6bf03cd`). Ostane le ročni preizkus: zvok, pravi telefon,
  gamepad in občutek igranja pri 60 fps. Po spremembah fizike vedno zaženi `node tests/run-node.mjs`.
