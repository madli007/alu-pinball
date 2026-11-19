# Prompt za AI agenta: ALU PINBALL 2.0 (ultra moderen remaster)

> Uporaba: v novi seji (delovna mapa `D:\Git\Brainstorm\pinball`) napiši
> **»Preberi PROMPT.md in ga v celoti izvedi.«**

---

## Tvoja naloga

V tem repoju je delujoč prototip pinballa **ALU PINBALL — Impol × Alcad edition** (`index.html`, `game.js`, `README.md`). Iz njega naredi **ultra moderen, grafično izpopolnjen in res impresiven pinball**, ki ga ljudje pokažejo sodelavcem in rečejo »wow«. Kakovost cilja na moderno indie igro, ne na tehnični demo.

**Delaj v enem kosu, do konca.** Ne ustavljaj se po fazah, ne sprašuj za potrditev vmesnih korakov in ne oddajaj polovične verzije z »naslednji koraki«. Odločitve sprejmi sam (ta dokument ti da dovolj usmeritev). Vprašaj samo, če si res blokiran. Na koncu mora biti igra dokončana, preizkušena in komitana.

---

## Kontekst: kaj že obstaja

- Čisti HTML + JS, brez knjižnic in build koraka. Canvas 2D, logična miza 600×1000.
- Lastna fizika, ki **deluje in je uglašena**: 12 substepov na frame (korak 1/720 s), gravitacija 1900, polmer žogice 10, max hitrost 3400, žogica proti kapsulam (daljice z debelino) in krogom, flipperji kot zožene kapsule s hitrostjo površine (`ω × r`), Coulombovo trenje, enosmerna vrata, kolizije med žogicami. Flipper: dolžina 74, hitrost dviga 38 rad/s, spusta 18 rad/s, restitucija 0.32.
- Elementi: zgornji lok, izstrelitveni kanal s plungerjem, levi orbit s spinnerjem, A·L·U zgornji kanali (lane change s flipperji, skill shot), 3 pop bumperji »Al 13«, 2 slingshota, B·U·G drop tarče, talilnica (scoop) z lockom, multiball (3 žogice), jackpot na orbitu, combo, extra ball, kickback, ball save, tilt, bonus × množitelj, sintetiziran zvok (Web Audio), lestvica rekordov v `localStorage`, dotik na telefonu.
- Tema: aluminij in industrija (Impol: talilnica, livarna, iztiskovanje, valjarna, folija, reciklaža) in programiranje (Alcad: bugi, hotfix, deploy, sprint, code review, produkcija). Vsa besedila v igri so **v slovenščini**.

Fiziko lahko refaktoriraš in razširiš, ampak **občutek igranja ne sme poslabšati**: brez tunelinga, brez zataknjenih žogic, močni in odzivni flipperji, ujemanje (cradle) na dvignjenem flipperju mora delovati.

---

## Tehnične omejitve

- Statična stran, ki deluje na **GitHub Pages** in lokalno z `npx --yes http-server@14.1.1 . -p 8123 -c-1`. **Brez build koraka** in brez npm odvisnosti v repoju.
- ES moduli so dovoljeni in zaželeni (`<script type="module">`): razdeli kodo na smiselne datoteke (npr. `src/physics.js`, `src/table.js`, `src/render/…`, `src/audio.js`, `src/rules.js`, `src/ui.js`, `src/config.js`).
- Zunanje knjižnice so dovoljene samo prek CDN z **natančno pripeto verzijo** (npr. `three@0.160.0` z jsDelivr ali unpkg). Raje vanilla in lastni WebGL shaderji, če to zmoreš čisto. Vse ostalo (teksture, zvoki) generiraj proceduralno v kodi: **brez slikovnih ali zvočnih datotek**, razen če jih generiraš sam kot SVG ali kodo.
- Cilj je **60 fps na povprečnem prenosniku** in tekoče igranje na sodobnem telefonu. Imej nastavitev kakovosti (Nizka / Srednja / Visoka / Ultra), ki se privzeto nastavi glede na izmerjeno zmogljivost; na šibkih napravah izklopi drage efekte.
- Rekordi so **samo v `localStorage`** (brez strežnika in brez zunanjih storitev). Vsak dostop zavij v `try/catch`, da igra deluje tudi, če shramba ni na voljo.
- Logotipov firm ne uporabljaj, imeni sta samo kot tekst (nastavljiva v configu). V nogi ali na začetnem zaslonu naj piše, da je to neuradna igra za hec.

---

## Grafika: tu mora igra zasijati

Izberi pristop, ki da najbolj impresiven rezultat in ga res dokončaj. Priporočilo: **WebGL izris** (lasten ali Three.js z ortografsko ali rahlo perspektivno kamero nad 2D fiziko). Fizika ostane 2D, izris pa daje občutek globine. Obvezno dosezi:

1. **Bloom / HDR glow**: pravi post-processing bloom (večnivojski blur svetlih delov), ne samo `shadowBlur`. Neon, insert luči in talina res žarijo.
2. **Igralna površina z globino**:
   - proceduralno brušen aluminij z anizotropnim odsevom, ki se premika glede na kamero ali žogico;
   - pod-površinski »inserti« (luči pod prosojno plastiko) z mehkim sijem;
   - grafika mize v slogu moderne industrijske ilustracije (procedurni vzorci: shema tovarne, tekoča talina, vezja, koda).
3. **Žogica iz kroma**: odsev okolja (environment map ali proceduralni odsev), specular highlight, **mehka senca** na mizi in **dinamična luč**, ki jo žogica meče na bližnje elemente; sled pri visoki hitrosti z motion blurom.
4. **Elementi s 3D videzom**: bumperji s kapico, obročem in osvetlitvijo od spodaj, ki ob udarcu poskočijo; flipperji s kovinskim materialom; slingshoti z gumo, ki se vidno ukrivi; drop tarče, ki se animirano pogreznejo; spinner, ki se res vrti v 3D; **rampa** z vidnim dvigom, senco in prosojno ali kovinsko ograjo (habitrail).
5. **Talilnica in talina**: animirana žareča talina (shader šum), toplotna distorzija zraka nad pečjo, iskre kot staljen aluminij ob udarcih.
6. **Svetlobne šove**: ob vsakem večjem dogodku (multiball, jackpot, mode start, wizard) koreografirana animacija luči čez celo mizo; v attract načinu (ko nihče ne igra) mize valovi svetlobe kot pri pravem automatu.
7. **DMD / zaslon**: nad mizo moderen »dot matrix« ali LED zaslon z animacijami (štetje točk, ikone, kratke animacije za dogodke, Alcad »terminal« animacije s tipkanjem kode, Impol animacija valjanja pločevine). Mora izgledati kot del automata, ne kot navaden HTML tekst.
8. **Kamera in »juice«**:
   - dinamično tresenje ob udarcih;
   - kratek **slow-motion** in zoom pri jackpotu ali odločilnem udarcu;
   - subtilen parallax pri tresenju mize;
   - gladki prehodi med zasloni (začetni zaslon, igra, bonus, konec igre, vpis rekorda).
9. **UI**: moderen, čist, s steklenimi paneli (glassmorphism) in lepo tipografijo (Google Fonts je dovoljen, npr. Orbitron, Rajdhani ali Inter); animirani števci točk; vse odzivno od telefona (portret) do širokega zaslona. Na širokem zaslonu je miza na sredini, ob strani pa lepo izkoriščen prostor (DMD, cilji, trenutni mode, lestvica).

Vizualna konsistenca: ena barvna paleta (npr. talina oranžna `#ff7a1a`, hladno modra `#6fd3ff`, Alcad zelena za kodo `#39ff88`, jackpot zlata) na temni industrijski podlagi.

---

## Igranje: poln »standard pinball« in še več

Obdrži vse obstoječe in dodaj:

- **Rampa** (»Iztiskovalna stiskalnica«): pravi rampni strel z vhodom, dvignjeno potjo (žogica med vožnjo po rampi ne trka z elementi spodaj; uporabi plasti ali »layers«) in izhodom, ki žogico vrne na inlane flipperja. Zaporedni streli na rampo dajejo combo.
- **Vsaj 4 modi oz. misije** z jasnim ciljem, časovnikom in nagrado, ki se začnejo v talilnici, ko je mode prižgan:
  - *Talina* (Impol): zadeni bumperje X-krat v 30 s, peč se segreva;
  - *Valjarna* (Impol): spinner in orbit za metre pločevine;
  - *Hotfix v produkcijo* (Alcad): hurry-up, vrednost pada, zadeni rampo, preden pade na nič;
  - *Sprint* (Alcad): zadeni vse označene strele (luči kažejo kam), preden se sprint izteče.

  Med modom luči na mizi kažejo, kaj streljati.
- **Wizard mode** (»Naročilo izpolnjeno«): ko končaš vse mode, začne se velik finale z multiballom, kjer je vse vredno jackpot, s posebnim svetlobnim šovom in glasbo.
- **Multiball** naj ima vidno zaklenjene žogice (fizično ali vizualno v talilnici), **super jackpot** in **add-a-ball**.
- **Mystery award** (»Code review«): naključna nagrada (točke, prižgan lock, extra ball, ball save, množitelj).
- **Magnet ali ball lock mehanizem** je opcijski, če lepo zapolni mizo.
- **Combo sistem** s prikazom na DMD.
- **Ravnotežje**: igra traja 3–8 minut za povprečnega igralca, nobena strategija ne prinese neskončnih točk, drain ni prepogost (outlane-i so pošteni, kickback in ball save pomagata).
- Postavitev mize preuredi, kolikor je treba za rampo in nove elemente; preveri, da so vsi streli dosegljivi s flipperji (napiši si skriptni test strelov).

---

## Zvok in glasba

- Bogat sintetiziran zvok (Web Audio): plasti, reverb (konvolucija z generiranim impulzom), stereo panning glede na položaj na mizi, mehanski kliki in kovinski udarci.
- **Proceduralna glasba**: synthwave ali industrial loop, ki se stopnjuje med multiballom, modi in wizard modom (dinamične plasti). V nastavitvah ločeni glasnosti za glasbo in efekte.
- Zvok se začne šele po prvi interakciji uporabnika (zahteva brskalnika).

---

## Rekordi (samo localStorage)

- Top 10 lestvica z arkadnim vpisom inicialk (3 znaki, izbira s flipperji ali tipkovnico ali dotikom) ali imena.
- Prikaz na začetnem zaslonu in v attract načinu; poudari nov rekord z animacijo.
- Statistika v `localStorage`: število iger, najdaljši combo, največji jackpot. Prikaži jo na zaslonu z rekordi.

---

## Kontrole

- Tipkovnica: Z / ← / levi Shift (levi flipper), M / → / desni Shift (desni flipper), presledek ali ↓ (plunger, drži in spusti), B ali ↑ (tresenje), P ali Esc (pavza), O (zvok). Prikaži jih na začetnem zaslonu.
- Dotik: leva in desna polovica zaslona za flipperja, plunger z vlečenjem navzdol v spodnjem desnem delu, tresenje s potegom navzgor ali z gumbom. Prepreči scroll in zoom med igro.
- Gamepad (Gamepad API): ramenski gumbi za flipperja, A za plunger. To je bonus.
- Pavza ob izgubi fokusa zavihka.

---

## Kakovost in preverjanje (obvezno, pred commitom)

1. Zaženi strežnik (`npx --yes http-server@14.1.1 . -p 8123 -c-1`) in igro preizkusi v brskalniku (vgrajeni brskalnik ali preview).
2. **Brez napak v konzoli** ob nalaganju in med igro.
3. **Skriptni testi fizike** prek konzole ali testne strani (npr. `tests.html`, ki teče brez build koraka):
   - streli z obeh flipperjev dosežejo zgornji del mize;
   - rampa, orbit, talilnica in vse tarče so dosegljive;
   - žogica nikoli ne preleti stene pri max hitrosti (stresni test z naključnimi hitrostmi in več tisoč koraki);
   - nobena žogica ne obstane za vedno (ball search deluje);
   - multiball, modi, wizard mode in konec igre se pravilno sprožijo in končajo.
4. Preveri izgled na **mobilni** velikosti (portret, npr. 375×812) in na **namizju**; posnemi zaslone in jih sam preglej. Popravi vse, kar izgleda neurejeno.
5. Preveri zmogljivost: izmeri fps z vklopljenimi efekti; nastavitev kakovosti naj dejansko pomaga.
6. Sam odigraj vsaj nekaj simuliranih iger (avtomatski »bot«, ki pritiska flipperja, ko je žogica blizu) in preveri, da igra ni prelahka ali pretežka.

---

## Oddaja

- Posodobi `README.md` (opis, kontrole, pravila, modi, objava na GitHub Pages, struktura datotek, nastavitve v configu).
- Na koncu **komitaj** vse v lokalni git (veja `main`) z opisnim sporočilom. Ne pushaj.
- V končnem odgovoru kratko povzemi: kaj je novo, kako zagnati igro in kaj morebiti ni bilo preverjeno.
