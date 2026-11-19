# ALU PINBALL 2.0 — Impol × Alcad edition

Moderen pinball za hec v brskalniku: lastna 2D fizika, WebGL izris z bloomom, brušenim aluminijem
in animirano talino, barvni DMD zaslon, svetlobni šovi, proceduralna glasba in efekti.
Čisti HTML + JavaScript (ES moduli), **brez build koraka, brez knjižnic in brez slikovnih/zvočnih datotek**
— vse (teksture, zvok, glasba) je generirano v kodi.

> Neuradna igra za hec. Ni uradni izdelek nobene od omenjenih firm; imeni sta samo tekst (nastavljivo v `src/config.js`).

## Zagon lokalno

ES moduli zahtevajo strežnik (dvoklik na `index.html` ne deluje):

```
npx --yes http-server@14.1.1 . -p 8123 -c-1
```

Nato odpri <http://localhost:8123>. Testi: <http://localhost:8123/tests.html> ali brez brskalnika `node tests/run-node.mjs`.

## Objava na GitHub Pages

1. Potisni repo na GitHub (v korenu morajo biti `index.html`, `src/`, `tests/`).
2. **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
3. Čez minuto je igra na `https://<uporabnik>.github.io/<repo>/`.

Edina zunanja povezava so pisave Google Fonts (Orbitron, Rajdhani, Share Tech Mono); brez njih igra deluje s sistemskimi pisavami.

## Kontrole

| Vnos | Akcija |
|---|---|
| Z / ← / levi Shift | levi flipper |
| M / → / desni Shift | desni flipper |
| Presledek / ↓ (drži in spusti) | izstrelitev (moč = čas držanja) |
| B / ↑ | tresenje mize (pazi na TILT: 2 opozorili) |
| P / Esc | pavza |
| O | zvok vklop/izklop |
| Enter | začni igro |
| **Dotik** | leva/desna polovica zaslona = flipper · povleci navzdol spodaj desno = plunger · hiter poteg navzgor ali gumb ⇡ = tresenje · gumb ❚❚ = pavza |
| **Gamepad** | LB/RB (ali LT/RT) flipperja · A izstrelitev · Y tresenje · Start pavza |

Igra se samodejno ustavi, ko zavihek ali okno izgubi fokus. Pred izstrelitvijo flipperja premikata skill shot.

## Pravila

**Strele:** levi orbit (spinner »Valjarna«), rampa »Iztiskovalna stiskalnica« (dvignjena pot, vrne žogico na levi inlane),
talilnica (scoop, desno), B·U·G drop tarče (Alcad kontrola kakovosti), Code review tarča (sredina), A·L·U kanali zgoraj, 3 pop bumperji »Al 13«.

- **A·L·U kanali** → bonus množitelj ×2 … ×6. Flipperja premikata prižgane luči (lane change).
- **Skill shot**: zadeni utripajoči kanal neposredno iz izstrelitve → 100.000.
- **B·U·G tarče** → prižgejo **LOCK** v talilnici (po prvem multiballu sta potrebna dva kompleta).
- **2 locka → MULTIBALL** (3 žogice; zaklenjena žogica je vidna v peči). Orbit in rampa sta **JACKPOT**; ko zadeneš oba,
  se v talilnici prižge **SUPER JACKPOT** (2,5 × jackpot). B·U·G med multiballom = **ADD-A-BALL** (enkrat).
- **Combo**: zaporedni veliki streli (orbit, rampa, code review) v 4 s; prikaz na DMD. Zaporedne rampe dajo še rampni combo.
- **Code review**: 3 zadetki → **mystery award** (točke, lock, extra ball, ball save, množitelj, prižgana misija, kickback).
- **Extra ball** se prižge po 8 orbitih (pobereš ga v talilnici).
- **Kickback** v levem outlanu; spinner ga ponovno prižge (vsakih 25 obratov). **Ball save** 10 s po izstrelitvi.
- **Bonus** ob koncu žogice: zbran bonus × množitelj (TILT ga izniči).

### Misije (začnejo se v talilnici, ko je misija prižgana)

Prva misija je prižgana na začetku, naslednje prižgejo zadetki rampe (3–5). Med misijo luči kažejo, kaj streljati.

| Misija | Cilj | Čas |
|---|---|---|
| **Talina** (Impol) | zadeni bumperje 12× — peč se vidno segreva | 40 s |
| **Valjarna** (Impol) | navij 50 m pločevine: spinner 1 m, orbit 12 m | 45 s |
| **Hotfix v produkcijo** (Alcad) | hurry-up: vrednost pada od 2.000.000, zadeni rampo, preden pade na nič | 30 s |
| **Sprint** (Alcad) | zadeni vseh 5 označenih strelov (orbit, rampa, talilnica, B·U·G, review) | 60 s |

**Finale »Naročilo izpolnjeno«** (wizard): ko opraviš vse štiri misije, se v talilnici prižge finale — 4-ball multiball,
vse je vredno jackpot, poseben svetlobni šov in glasba. Ko ostane ena žogica, dobiš nagrado in misije se začnejo znova.

## Grafika in kakovost

- WebGL: miza v shaderju (brušen aluminij z anizotropnim odsevom, ki sledi kameri in žogicam), animirana talina (fbm šum),
  dinamične luči žogic in bliskov, toplotna distorzija nad pečjo, večnivojski bloom (dual-kawase), ACES, vinjeta, rahla perspektiva.
- Dinamični elementi (kromirane žogice z odsevom okolja in senco, bumperji, flipperji, slingi, tarče, spinner, rampa) se rišejo
  v Canvas 2D sloj, ki ga shader združi z emisijskim slojem za bloom.
- **Kakovost**: Samodejno / Nizka / Srednja / Visoka / Ultra (Nastavitve). Samodejno začne z Visoko (na telefonu Srednjo),
  zniža stopnjo, če fps pade pod ~48, in se vrne nazaj, če znižanje ne pomaga (zaslon z 30 Hz).
- Brez WebGL igra preklopi na preprostejši 2D izris.

## Rekordi

Top 10 z arkadnim vpisom 3 inicialk (flipperja ali puščici menjata črko, presledek potrdi, lahko tudi tipkaš; na dotik ▲▼).
Statistika (igre, najdaljši combo, največji jackpot, misije, finale, čas) — vse **samo v `localStorage`**
(ključi `aluPinball2.*`); če shramba ni na voljo, igra deluje naprej.

## Struktura

```
index.html            postavitev (ohišje, DMD, miza, stranski paneli)
tests.html            testi v brskalniku
src/config.js         CFG (imena, žogice, ravnotežje), fizikalne konstante, paleta, misije, stopnje kakovosti
src/table.js          geometrija mize, senzorji, luči (inserti)
src/physics.js        fizika: kapsule, krogi, flipperji (ω×r), trenje, plasti (rampa), enosmerna vrata
src/rules.js          pravila: točkovanje, misije, multiball, wizard, mystery, combo, tilt, ball search
src/audio.js          Web Audio: efekti (reverb, panning) + proceduralna glasba s plastmi
src/render/art.js     proceduralna grafika mize (potisk, dvignjeni elementi, neon, rampa, panorama za krom)
src/render/scene.js   dinamični sloj (inserti, bumperji, flipperji, žogice, delci)
src/render/gl.js      WebGL shaderji in bloom
src/render/lights.js  svetlobni šovi in attract način
src/render/dmd.js     DMD 128×32 z bitno pisavo in animacijami
src/render/renderer.js kamera, efekti, kakovost, 2D rezerva
src/ui.js             zasloni, nastavitve, inicialke, paneli
src/input.js          tipkovnica, dotik, gamepad
src/storage.js        localStorage (try/catch)
src/main.js           povezava vsega in glavna zanka
tests/tests.js        streli s flipperjev, rampa, stresni test (brez tuneliranja), ball search, pravila, bot
```

## Prilagajanje

V `src/config.js`:

- `CFG.naslov`, `CFG.podnaslov`, `CFG.firmaA`, `CFG.firmaB`, `CFG.opomba` — besedila;
- `CFG.steviloZogic`, `CFG.ballSaveSek`, `CFG.multiballSaveSek`, `CFG.wizardSaveSek` — prizanesljivost;
- `CFG.comboOkno`, `CFG.rampZaMisijo`, `CFG.orbitZaExtraBall`, `CFG.reviewZaMystery`, `CFG.spinZaKickback` — ravnotežje;
- `MODES` — cilji, časi in nagrade misij; `QUALITY` — parametri stopenj kakovosti.

Fizikalne konstante (`GRAV`, `MAXV`, `STEP`, `BR`) so uglašene — spreminjaj previdno in nato zaženi teste.

V konzoli brskalnika je na voljo `__pinball` (stanje igre) in `__pinball.snap()` (posnetek mize v polni ločljivosti).
