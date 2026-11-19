# ALU PINBALL — Impol × Alcad edition

Pinball za hec, napisan v čistem HTML + JavaScript (brez knjižnic in brez build koraka).

## Igranje lokalno
Zaradi varnostnih omejitev brskalnika je najbolje zagnati preprost strežnik v tej mapi:

```
npx http-server . -p 8123
```

in odpreti http://localhost:8123. (Večinoma deluje tudi samo dvoklik na `index.html`.)

## Objava na GitHub Pages
1. Ustvari repo in vanj daj `index.html` in `game.js`.
2. Na GitHubu: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
3. Čez minuto je igra na `https://<uporabnik>.github.io/<repo>/`.

## Kontrole
| Tipka | Akcija |
|---|---|
| Z / ← / levi Shift | levi flipper |
| M / → / desni Shift | desni flipper |
| Presledek / ↓ (drži) | izstrelitev |
| B / ↑ | tresenje mize (pazi na TILT) |
| P | pavza |
| O | zvok vklop/izklop |
| Telefon | leva/desna polovica zaslona |

## Pravila
- **A·L·U kanali** zgoraj: zapri vse tri → bonus množitelj ×2 … ×6. Flipperji premikajo prižgane luči (lane change).
- **Skill shot**: pred izstrelitvijo utripa en kanal (premikaš ga s flipperji), zadeni ga direktno iz izstrelitve → 100.000.
- **B·U·G tarče** (Alcad kontrola kakovosti): podri vse → prižge LOCK v **talilnici**.
- **2 locka → MULTIBALL** (3 žogice). Med multiballom je **levi orbit JACKPOT**, talilnica pa pol jackpota.
- **Orbit** (iztiskovalna linija): zaporedni streli v 4 s dajo combo, 5 orbitov prižge EXTRA BALL (pobereš ga v talilnici).
- **Spinner** (valjarna): vsakih 20 obratov ponovno prižge **KICKBACK** v levem outlanu.
- **Ball save** prvih 10 sekund po izstrelitvi.
- Rekordi se shranijo v brskalnik (localStorage).

## Prilagajanje
Na vrhu `game.js` je objekt `CFG` (naslov, imeni firm, število žogic, ball save).
