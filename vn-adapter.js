/* ══════════════════════════════════════════════════════════════════════════
   vn-adapter.js — any chat-style conversation on a lesson page (the .bubble-wrap
   lines in a container, usually #conversation) can also be watched as a visual
   novel. A switch above it: 💬 Chat · 🎬 Visual novel.

   house.js loads it by itself on every intro page (a file name with _intro_, or a page with
   data-vn on any element) once the page has drawn its bubbles, so no page needs a script tag.
   It loads house-character.js and house-vn.js (from its own folder) the first time a visual
   novel is shown, so a page that never switches pays nothing.

   What it reads from the page, for each conversation:
     the lines        .bubble-wrap → the name (.bname), the side (.right), the text (.bubble,
                      without stick figures or country chips), the avatar emoji
     the place        the .setting-chip just before the conversation; without one, the page's
                      title, heading and subtitle. Keywords pick a backdrop (see PLACES below);
                      a phone or video call splits the picture in two, one half per speaker
                      (“A phone call: Toronto ↔ Sydney”: the left half is Toronto, the right Sydney).
                      A chip can name it outright: data-vn-bg="kitchen", or for a call
                      data-vn-bg="bus|livingroom" (left half | right half).
     the people       by name: the page's own house characters first (PP.PEOPLE on the present
                      perfect pages, DeductionHouse.CAST on the deduction pages, by name or role),
                      then the cast below (Ana, Ben, Leo, Mia, Sam, Emma, Tom, Lily, Mom, Dad,
                      Grandma, Grandpa, Daniel, Sofia…), then one made up from the avatar
                      (👩 👨 👧 👦 👵 👴, skin tone) — always the same for the same name.
                      A child's avatar (👦 👧) makes the person child-sized.
     the extras       pictures under a line (thought bubbles, memories) are shown under the
                      stage while that line is said.
   The choice (chat or visual novel) is remembered for every page.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const BASE = SRC ? SRC.replace(/[^/]*$/, '') : '';
  const STORE = 'house-conversation-mode';
  const W = 1600, H = 900;

  /* ── backdrops (1600 × 900, the floor from about y 520 so the speakers stand on it) ── */
  const svg = body => `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>`;
  const planks = (y0, col, line) => `<rect y="${y0}" width="1600" height="${900 - y0}" fill="${col}"/><g stroke="${line}" stroke-width="3">`
    + [40, 100, 180, 290].map(d => `<path d="M0,${y0 + d}H1600"/>`).join('')
    + [[800, 800], [560, 380], [1040, 1220], [320, -40], [1280, 1640]].map(([a, b]) => `<path d="M${a},${y0}L${b},900"/>`).join('') + '</g>';
  const skirting = (y, col) => `<rect y="${y - 14}" width="1600" height="16" fill="${col}"/>`;
  const windowDay = (x, y, w, h, sky) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${sky || '#bfe2f2'}" stroke="#fff" stroke-width="12"/>`
    + `<path d="M${x + w / 2},${y}V${y + h}M${x},${y + h / 2}H${x + w}" stroke="#fff" stroke-width="8"/>`;
  const plant = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s || 1})"><path d="M-30,0L-24,60H24L30,0Z" fill="#c96a3a"/>`
    + `<g fill="#5e9e57"><ellipse cx="-22" cy="-30" rx="16" ry="38" transform="rotate(-25 -22 -30)"/><ellipse cx="22" cy="-30" rx="16" ry="38" transform="rotate(25 22 -30)"/><ellipse cx="0" cy="-48" rx="16" ry="44"/></g></g>`;
  const frame = (x, y, w, h, inner) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff8ec" stroke="#7a4a2a" stroke-width="8"/>${inner || ''}`;

  function livingroom(o) {
    o = o || {};
    const wall = o.wall || '#ece0cc', sofa = o.sofa || '#5b7fa6';
    return svg(`<rect width="1600" height="900" fill="${wall}"/>${o.paper ? `<g fill="${o.paper}" opacity=".45">${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 100 + 40}" width="20" height="520"/>`).join('')}</g>` : ''}
      ${planks(520, o.floor || '#b98557', '#9a6a40')}${skirting(520, '#8a5a36')}
      ${windowDay(110, 120, 300, 230)}<path d="M90,110H430" stroke="#7a4a2a" stroke-width="10"/><path d="M95,112Q120,240 100,370H80V112ZM425,112Q400,240 420,370H440V112Z" fill="${o.curtain || '#c0504d'}"/>
      ${frame(620, 150, 170, 120, `<path d="M632,258L680,200L715,235L740,215L778,258Z" fill="#6aa86a"/><circle cx="745" cy="185" r="14" fill="#f2c94c"/>`)}
      <g><rect x="560" y="360" width="480" height="110" rx="30" fill="${sofa}"/><rect x="540" y="400" width="70" height="110" rx="24" fill="${sofa}"/><rect x="990" y="400" width="70" height="110" rx="24" fill="${sofa}"/>
        <rect x="600" y="430" width="400" height="70" rx="16" fill="${sofa}" stroke="rgba(0,0,0,.18)" stroke-width="4"/><rect x="620" y="500" width="14" height="22" fill="#5e3a20"/><rect x="966" y="500" width="14" height="22" fill="#5e3a20"/>
        <rect x="640" y="380" width="90" height="60" rx="14" fill="#f2c94c" opacity=".9"/></g>
      <g><rect x="1180" y="170" width="250" height="350" fill="#8a5a36"/><g fill="#6e4426"><rect x="1190" y="250" width="230" height="10"/><rect x="1190" y="340" width="230" height="10"/><rect x="1190" y="430" width="230" height="10"/></g>
        <g>${['#c0504d', '#4f81bd', '#9bbb59', '#f2c94c', '#8064a2', '#4bacc6'].map((c, i) => `<rect x="${1200 + i * 34}" y="${190 + (i % 2) * 8}" width="26" height="${60 - (i % 2) * 8}" fill="${c}"/><rect x="${1205 + i * 32}" y="${282 + (i % 3) * 6}" width="24" height="${58 - (i % 3) * 6}" fill="${['#4bacc6', '#c0504d', '#9bbb59'][i % 3]}"/>`).join('')}</g></g>
      <g><path d="M1490,520V300" stroke="#444" stroke-width="6"/><path d="M1450,300H1530L1510,240H1470Z" fill="#f6e7b0" stroke="#c9b26a" stroke-width="3"/><ellipse cx="1490" cy="522" rx="34" ry="8" fill="#444"/></g>
      ${plant(470, 462, 0.9)}<ellipse cx="800" cy="640" rx="520" ry="70" fill="${o.rug || '#c9a26a'}" opacity=".55"/>`);
  }
  function kitchen() {
    return svg(`<rect width="1600" height="900" fill="#e6efe9"/><g stroke="#cfdcd4" stroke-width="3">${Array.from({ length: 9 }, (_, i) => `<path d="M0,${300 + i * 25}H1600"/>`).join('')}</g>
      ${planks(520, '#c9a77c', '#a8865c')}<rect y="500" width="1600" height="22" fill="#6e4426"/>
      <rect x="0" y="380" width="1180" height="22" fill="#8a5a36"/><rect x="0" y="400" width="1180" height="105" fill="#f3efe6"/><g stroke="#c9c2b2" stroke-width="4">${[200, 400, 600, 800, 1000].map(x => `<path d="M${x},402V505"/>`).join('')}</g>
      <g fill="#b6aa94">${[100, 300, 500, 700, 900, 1100].map(x => `<rect x="${x - 25}" y="440" width="50" height="8" rx="4"/>`).join('')}</g>
      <rect x="40" y="110" width="520" height="150" fill="#f3efe6" stroke="#c9c2b2" stroke-width="4"/><path d="M300,110V260" stroke="#c9c2b2" stroke-width="4"/>
      ${windowDay(640, 110, 300, 200)}<rect x="1000" y="140" width="160" height="120" fill="#f3efe6" stroke="#c9c2b2" stroke-width="4"/>
      <g><rect x="380" y="352" width="120" height="30" rx="6" fill="#555"/><circle cx="410" cy="352" r="14" fill="#777"/><circle cx="470" cy="352" r="14" fill="#777"/>
        <path d="M230,380V320Q230,300 250,300H290" fill="none" stroke="#999" stroke-width="10"/><rect x="190" y="372" width="120" height="12" rx="6" fill="#bbb"/></g>
      <g><rect x="1260" y="150" width="220" height="370" rx="18" fill="#eef2f4" stroke="#b9c3c9" stroke-width="5"/><path d="M1260,290H1480" stroke="#b9c3c9" stroke-width="5"/><rect x="1450" y="190" width="10" height="70" rx="5" fill="#9aa5ab"/><rect x="1450" y="320" width="10" height="90" rx="5" fill="#9aa5ab"/>
        <circle cx="1300" cy="200" r="12" fill="#e5484d"/><rect x="1330" y="210" width="40" height="30" fill="#f2c94c" transform="rotate(-8 1350 225)"/></g>
      <g fill="#fff" stroke="#8a5a36" stroke-width="3"><rect x="720" y="350" width="34" height="32" rx="5"/><rect x="780" y="356" width="28" height="26" rx="5"/></g><circle cx="900" cy="362" r="22" fill="#e58a3a"/><circle cx="930" cy="368" r="18" fill="#e5484d"/>`);
  }
  function bedroom() {
    return svg(`<rect width="1600" height="900" fill="#dce9f5"/>${planks(520, '#c79a6a', '#a77a4a')}${skirting(520, '#8a5a36')}
      ${windowDay(640, 110, 300, 220)}<path d="M620,100H960" stroke="#7a4a2a" stroke-width="10"/>
      <g><rect x="160" y="150" width="140" height="180" fill="#ffd166" transform="rotate(-4 230 240)"/><path d="M190,290L230,190L270,290Z" fill="#e5484d" transform="rotate(-4 230 240)"/><circle cx="230" cy="180" r="18" fill="#118ab2" transform="rotate(-4 230 240)"/>
        <rect x="350" y="170" width="160" height="110" fill="#8ecae6" transform="rotate(3 430 225)"/><path d="M370,260Q430,190 490,260" fill="none" stroke="#fff" stroke-width="10" transform="rotate(3 430 225)"/></g>
      <g><rect x="60" y="370" width="460" height="100" rx="14" fill="#f5f5f5"/><rect x="60" y="440" width="460" height="70" rx="10" fill="#118ab2"/><rect x="40" y="300" width="40" height="220" rx="10" fill="#8a5a36"/><rect x="500" y="380" width="40" height="140" rx="10" fill="#8a5a36"/>
        <rect x="90" y="350" width="120" height="50" rx="20" fill="#fff" stroke="#ddd" stroke-width="3"/></g>
      <g><rect x="1100" y="380" width="340" height="24" fill="#8a5a36"/><rect x="1120" y="404" width="20" height="116" fill="#6e4426"/><rect x="1400" y="404" width="20" height="116" fill="#6e4426"/>
        <path d="M1380,380V310L1350,300" fill="none" stroke="#333" stroke-width="6"/><path d="M1320,290L1360,270L1380,310L1340,320Z" fill="#ffd166"/><rect x="1160" y="340" width="120" height="40" fill="#e5484d"/><rect x="1170" y="330" width="100" height="12" fill="#06d6a0"/></g>
      <g><rect x="1460" y="440" width="110" height="80" rx="8" fill="#ef476f"/><circle cx="1495" cy="430" r="22" fill="#ffd166"/><path d="M1530,440L1560,400" stroke="#118ab2" stroke-width="10"/></g>
      <ellipse cx="800" cy="650" rx="380" ry="60" fill="#ffd166" opacity=".45"/>`);
  }
  function backyard() {
    return svg(`<defs><linearGradient id="vnadSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec9f0"/><stop offset="1" stop-color="#e3f4fb"/></linearGradient></defs>
      <rect width="1600" height="900" fill="url(#vnadSky)"/><circle cx="1380" cy="130" r="60" fill="#fff3b0"/>
      <g fill="#6aa86a"><circle cx="160" cy="260" r="120"/><circle cx="300" cy="300" r="100"/><circle cx="1500" cy="300" r="110"/></g><rect x="215" y="330" width="30" height="190" fill="#8a5a36"/>
      <g fill="#e8d6b8" stroke="#b39466" stroke-width="3">${Array.from({ length: 33 }, (_, i) => `<path d="M${i * 50},520V${385 + (i % 2) * 6}L${i * 50 + 22},370L${i * 50 + 44},${385 + (i % 2) * 6}V520Z"/>`).join('')}</g><rect y="420" width="1600" height="12" fill="#d2bd98"/>
      <rect y="520" width="1600" height="380" fill="#7cbf6a"/><g stroke="#6aa85a" stroke-width="3">${Array.from({ length: 40 }, (_, i) => `<path d="M${i * 41 + 10},${560 + (i % 5) * 60}l6,-14l6,14"/>`).join('')}</g>
      <path d="M0,170Q400,240 800,170T1600,170" fill="none" stroke="#555" stroke-width="3"/>${Array.from({ length: 15 }, (_, i) => { const x = 50 + i * 107, t = (x % 800) / 800, y = 170 + (x < 800 ? 35 : -35) * Math.sin(t * Math.PI); return `<circle cx="${x}" cy="${Math.round(y + 9)}" r="9" fill="${['#ffd166', '#ef476f', '#06d6a0', '#118ab2'][i % 4]}"/>`; }).join('')}
      <g><rect x="1150" y="390" width="200" height="16" rx="6" fill="#8a5a36"/><rect x="1170" y="406" width="14" height="114" fill="#6e4426"/><rect x="1316" y="406" width="14" height="114" fill="#6e4426"/><rect x="1130" y="456" width="240" height="12" rx="5" fill="#8a5a36"/>
        <rect x="1190" y="372" width="40" height="18" rx="4" fill="#e5484d"/><rect x="1250" y="368" width="30" height="22" rx="4" fill="#fff" stroke="#999" stroke-width="2"/></g>
      <g><path d="M380,380H560L540,440H400Z" fill="#333"/><rect x="380" y="372" width="180" height="12" rx="4" fill="#555"/><path d="M420,440L400,520M520,440L540,520" stroke="#333" stroke-width="8"/>
        <g fill="#c0504d"><rect x="410" y="360" width="50" height="12" rx="6"/><rect x="480" y="360" width="50" height="12" rx="6"/></g>
        <path d="M440,345Q425,320 445,300T440,255M500,345Q485,320 505,300T500,255" fill="none" stroke="#ccc" stroke-width="7" stroke-linecap="round" opacity=".8"/></g>`);
  }
  function clothesshop() {
    const hanger = (x, c) => `<path d="M${x},230V244" stroke="#888" stroke-width="3"/><path d="M${x - 34},262L${x},244L${x + 34},262" fill="none" stroke="#888" stroke-width="3"/><path d="M${x - 36},262L${x - 44},380H${x + 44}L${x + 36},262L${x + 12},258L${x},272L${x - 12},258Z" fill="${c}" stroke="rgba(0,0,0,.2)" stroke-width="3"/>`;
    return svg(`<rect width="1600" height="900" fill="#f6eef0"/><rect width="1600" height="70" fill="#c45a7a"/><text x="800" y="50" text-anchor="middle" font-family="sans-serif" font-size="40" font-weight="700" fill="#fff" letter-spacing="8">CLOTHES · SHOES</text>
      <rect y="520" width="1600" height="380" fill="#e9e2dc"/><g stroke="#d6cdc4" stroke-width="3">${[560, 625, 715, 835].map(y => `<path d="M0,${y}H1600"/>`).join('')}${[[800, 800], [560, 380], [1040, 1220], [320, -40], [1280, 1640]].map(([a, b]) => `<path d="M${a},520L${b},900"/>`).join('')}</g>${skirting(520, '#b9a9a0')}
      <g><path d="M90,230H560" stroke="#777" stroke-width="8"/><path d="M110,230V520M540,230V520" stroke="#777" stroke-width="8"/>${[['#2b2b2e', 160], ['#3b82f6', 260], ['#22a55b', 360], ['#92562c', 460]].map(([c, x]) => hanger(x, c)).join('')}</g>
      <g><rect x="660" y="150" width="200" height="330" rx="100" fill="#dfe9ef" stroke="#c9b26a" stroke-width="10"/><path d="M700,250L740,210M700,300L780,220" stroke="#fff" stroke-width="8" opacity=".7"/></g>
      <g><rect x="1000" y="150" width="520" height="370" fill="#fff" stroke="#d6cdc4" stroke-width="4"/>${[230, 330, 430].map(y => `<rect x="1000" y="${y}" width="520" height="10" fill="#d6cdc4"/>`).join('')}
        ${[[1050, 205, '#fff'], [1150, 205, '#92562c'], [1250, 205, '#22a55b'], [1370, 205, '#e5484d'], [1080, 305, '#f472b6'], [1210, 305, '#2b2b2e'], [1340, 305, '#f5c518'], [1100, 405, '#3b82f6'], [1250, 405, '#fff'], [1400, 405, '#92562c']].map(([x, y, c]) => `<path d="M${x},${y + 25}V${y}H${x + 30}L${x + 40},${y + 14}H${x + 70}Q${x + 80},${y + 25} ${x + 70},${y + 25}Z" fill="${c}" stroke="#999" stroke-width="2"/>`).join('')}</g>
      <g><rect x="880" y="360" width="90" height="160" fill="#c45a7a" opacity=".85"/><text x="925" y="430" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="700" fill="#fff">SALE</text><text x="925" y="470" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#fff">-30%</text></g>
      <g fill="#e5484d"><path d="M600,300h40v12h-40z" transform="rotate(-10 620 306)"/></g>`);
  }
  function warehouse() {
    const box = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#c9965a" stroke="#8a5a36" stroke-width="3"/><path d="M${x + w / 2 - 8},${y}V${y + h * 0.45}H${x + w / 2 + 8}V${y}" fill="#e0b47a"/>`;
    const shelf = x => `<g><path d="M${x},140V520M${x + 360},140V520" stroke="#2f6db0" stroke-width="12"/>${[230, 340, 450].map(y => `<rect x="${x}" y="${y}" width="360" height="12" fill="#f0a030"/>`).join('')}
      ${box(x + 20, 160, 90, 70)}${box(x + 130, 175, 110, 55)}${box(x + 260, 160, 80, 70)}${box(x + 20, 270, 140, 70)}${box(x + 180, 285, 80, 55)}${box(x + 270, 280, 70, 60)}${box(x + 30, 380, 100, 70)}${box(x + 150, 370, 190, 80)}</g>`;
    return svg(`<rect width="1600" height="900" fill="#d7dade"/><g stroke="#c6cace" stroke-width="4">${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 100},0V520"/>`).join('')}</g>
      <rect y="520" width="1600" height="380" fill="#a9adb1"/><path d="M0,700H1600" stroke="#f5c518" stroke-width="12" stroke-dasharray="60 30"/><rect y="508" width="1600" height="14" fill="#7d8287"/>
      ${shelf(60)}<g><rect x="560" y="150" width="480" height="370" fill="#9aa0a6"/><g stroke="#868c92" stroke-width="5">${Array.from({ length: 11 }, (_, i) => `<path d="M560,${170 + i * 33}H1040"/>`).join('')}</g><rect x="560" y="140" width="480" height="20" fill="#5f6368"/><text x="800" y="120" text-anchor="middle" font-family="sans-serif" font-size="42" font-weight="800" fill="#2f8f4a">FreshBox</text></g>
      ${shelf(1180)}<g><rect x="610" y="470" width="200" height="16" fill="#b08a5a"/><rect x="610" y="500" width="200" height="16" fill="#b08a5a"/><path d="M620,486V516M710,486V516M800,486V516" stroke="#8a6a46" stroke-width="10"/>${box(630, 400, 80, 70)}${box(720, 420, 80, 50)}</g>
      ${[300, 800, 1300].map(x => `<path d="M${x},0V40" stroke="#555" stroke-width="4"/><path d="M${x - 50},70L${x - 30},40H${x + 30}L${x + 50},70Z" fill="#444"/><ellipse cx="${x}" cy="72" rx="46" ry="8" fill="#fff6c4"/>`).join('')}`);
  }
  function frontdoor() {
    return svg(`<defs><linearGradient id="vnadSky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd0f2"/><stop offset="1" stop-color="#f6e9d0"/></linearGradient></defs>
      <rect width="1600" height="900" fill="url(#vnadSky2)"/><g fill="#fff"><ellipse cx="260" cy="90" rx="110" ry="30"/><ellipse cx="1350" cy="70" rx="90" ry="26"/></g>
      <path d="M180,250L800,30L1420,250Z" fill="#a14a3b"/><rect x="230" y="240" width="1140" height="300" fill="#f1e3c6"/><g stroke="#ddcaa5" stroke-width="3">${Array.from({ length: 10 }, (_, i) => `<path d="M230,${270 + i * 28}H1370"/>`).join('')}</g>
      ${windowDay(320, 300, 230, 170)}${windowDay(1050, 300, 230, 170)}<g fill="#5e9e57"><ellipse cx="300" cy="530" rx="90" ry="40"/><ellipse cx="1300" cy="530" rx="90" ry="40"/><ellipse cx="560" cy="535" rx="60" ry="30"/><ellipse cx="1040" cy="535" rx="60" ry="30"/></g>
      <g><rect x="700" y="250" width="200" height="290" rx="6" fill="#2f5d8c"/><rect x="720" y="270" width="160" height="110" rx="4" fill="#3d72a8"/><rect x="720" y="400" width="160" height="120" rx="4" fill="#3d72a8"/><circle cx="870" cy="400" r="9" fill="#f2c94c"/>
        <rect x="690" y="240" width="220" height="14" fill="#fff"/><path d="M640,260V230" stroke="#333" stroke-width="5"/><rect x="624" y="230" width="32" height="40" rx="6" fill="#f6e7b0" stroke="#333" stroke-width="3"/>
        <rect x="660" y="540" width="280" height="20" fill="#bbb"/><rect x="640" y="558" width="320" height="20" fill="#aaa"/></g>
      <rect y="560" width="1600" height="340" fill="#86c06f"/><path d="M640,578L540,900H1060L960,578Z" fill="#d8cbb3"/><g stroke="#c4b69a" stroke-width="4"><path d="M610,680H990M580,790H1020"/></g>
      <g transform="translate(1440 470)"><rect x="-8" y="0" width="16" height="90" fill="#8a5a36"/><rect x="-46" y="-40" width="92" height="50" rx="8" fill="#e5484d"/><text x="0" y="-8" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="#fff">MAIL</text></g>`);
  }
  function hallway() {
    return svg(`<rect width="1600" height="900" fill="#e4d6c0"/>${planks(520, '#a9784c', '#8a5e38')}${skirting(520, '#6e4426')}
      <g><rect x="620" y="130" width="300" height="392" fill="#7a4a2a"/><rect x="640" y="150" width="260" height="372" fill="#9c6b45"/><rect x="690" y="180" width="160" height="110" rx="6" fill="#28406a"/><g fill="#fff" opacity=".8"><circle cx="720" cy="210" r="3"/><circle cx="800" cy="230" r="2"/><circle cx="830" cy="200" r="2.5"/></g><circle cx="880" cy="350" r="10" fill="#f2c94c"/></g>
      <g><path d="M300,520V170" stroke="#5e3a20" stroke-width="10"/><path d="M260,180H340M268,230H332" stroke="#5e3a20" stroke-width="8"/><path d="M262,180Q240,260 270,330L300,330Z" fill="#2f5d8c"/><path d="M338,230Q370,300 330,360L310,360Z" fill="#c0504d"/><ellipse cx="300" cy="522" rx="46" ry="10" fill="#5e3a20"/></g>
      <g><rect x="1080" y="380" width="260" height="22" fill="#6e4426"/><rect x="1095" y="402" width="16" height="118" fill="#5e3a20"/><rect x="1309" y="402" width="16" height="118" fill="#5e3a20"/><rect x="1100" y="440" width="220" height="10" fill="#6e4426"/>
        <path d="M1250,380V300" stroke="#444" stroke-width="5"/><path d="M1215,300H1285L1270,250H1230Z" fill="#f6e7b0"/><ellipse cx="1250" cy="330" rx="120" ry="80" fill="#fff3b0" opacity=".25"/>
        <rect x="1120" y="355" width="70" height="25" rx="4" fill="#ddd"/><path d="M1150,355Q1160,340 1170,355" fill="none" stroke="#b39466" stroke-width="4"/></g>
      <rect x="1120" y="140" width="180" height="200" rx="90" fill="#cfe0ea" stroke="#b39466" stroke-width="10"/>
      <g><rect x="440" y="400" width="130" height="120" rx="14" fill="#c0504d"/><rect x="455" y="415" width="100" height="90" rx="10" fill="none" stroke="#a03d3a" stroke-width="5"/><path d="M480,400V370H530V400" fill="none" stroke="#333" stroke-width="7"/><circle cx="460" cy="522" r="7" fill="#333"/><circle cx="550" cy="522" r="7" fill="#333"/></g>
      <ellipse cx="770" cy="640" rx="260" ry="50" fill="#7a3b3b" opacity=".45"/>`);
  }
  /* halves for calls */
  function rainynight() {
    return svg(`<rect width="1600" height="900" fill="#d9cdb8"/>${planks(520, '#9c6f48', '#7d5634')}${skirting(520, '#6e4426')}
      <g><rect x="460" y="110" width="680" height="330" rx="10" fill="#1f2d4a" stroke="#fff" stroke-width="14"/><path d="M800,110V440" stroke="#fff" stroke-width="10"/>
        <g fill="#2e4470">${[[480, 300, 70, 140], [560, 250, 60, 190], [630, 320, 80, 120], [830, 270, 70, 170], [910, 230, 60, 210], [980, 310, 90, 130]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}</g>
        <g fill="#ffd166" opacity=".8">${[[495, 320], [515, 360], [575, 270], [590, 320], [650, 340], [845, 290], [860, 340], [925, 250], [940, 300], [1000, 330], [1030, 370]].map(([x, y]) => `<rect x="${x}" y="${y}" width="10" height="12"/>`).join('')}</g>
        <g stroke="#a8c4e8" stroke-width="3" opacity=".7">${Array.from({ length: 34 }, (_, i) => { const x = 475 + (i * 53) % 650, y = 125 + (i * 97) % 280; return `<path d="M${x},${y}l-8,26"/>`; }).join('')}</g></g>
      <g><path d="M1300,520V310" stroke="#444" stroke-width="6"/><path d="M1260,310H1340L1320,250H1280Z" fill="#f6e7b0"/><ellipse cx="1300" cy="340" rx="150" ry="110" fill="#fff3b0" opacity=".22"/></g>
      <g><rect x="300" y="420" width="200" height="100" rx="24" fill="#8064a2"/><rect x="280" y="440" width="50" height="80" rx="16" fill="#8064a2"/></g>
      <rect width="1600" height="900" fill="#0b1630" opacity=".18"/>`);
  }
  function beach() {
    return svg(`<defs><linearGradient id="vnadSky3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb8f0"/><stop offset="1" stop-color="#c9ecfb"/></linearGradient></defs>
      <rect width="1600" height="900" fill="url(#vnadSky3)"/><circle cx="1280" cy="140" r="80" fill="#fff3b0"/><g fill="#fff"><ellipse cx="400" cy="120" rx="120" ry="32"/><ellipse cx="480" cy="100" rx="80" ry="30"/></g>
      <rect y="360" width="1600" height="170" fill="#2a9bd8"/><g stroke="#8fd3f4" stroke-width="5" opacity=".8">${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 140 + 20},${400 + (i % 3) * 40}q30,-12 60,0"/>`).join('')}</g>
      <path d="M0,500Q400,470 800,500T1600,500V900H0Z" fill="#f2d79b"/><path d="M0,505Q400,480 800,505T1600,505" fill="none" stroke="#fff" stroke-width="10" opacity=".8"/>
      <g><path d="M560,560L620,330" stroke="#8a5a36" stroke-width="10"/><path d="M450,370Q620,250 790,330Z" fill="#ef476f"/><path d="M520,350Q620,270 700,320" fill="none" stroke="#fff" stroke-width="10"/></g>
      <g><rect x="1080" y="540" width="220" height="40" rx="10" fill="#118ab2" transform="rotate(-6 1190 560)"/><circle cx="1360" cy="600" r="34" fill="#ffd166" stroke="#e5484d" stroke-width="8"/></g>
      <g transform="translate(220 360)"><path d="M0,180Q20,90 0,0" stroke="#8a5a36" stroke-width="16" fill="none"/><g fill="#3d8b4a"><path d="M0,0Q-90,-30 -130,20Q-60,-10 0,0Z"/><path d="M0,0Q90,-40 140,10Q60,-10 0,0Z"/><path d="M0,0Q-40,-80 -20,-120Q0,-60 0,0Z"/><path d="M0,0Q50,-70 100,-80Q40,-40 0,0Z"/></g></g>`);
  }
  function bus() {
    return svg(`<rect width="1600" height="900" fill="#e9eef2"/><rect y="0" width="1600" height="90" fill="#cfd8de"/>
      ${[80, 520, 960, 1400].map(x => `<rect x="${x}" y="140" width="360" height="230" rx="18" fill="#9fd0ef" stroke="#7d8a94" stroke-width="10"/><g fill="#c5d6e0"><rect x="${x + 30}" y="260" width="70" height="110"/><rect x="${x + 120}" y="220" width="60" height="150"/><rect x="${x + 220}" y="280" width="100" height="90"/></g><path d="M${x + 40},180l60,-20" stroke="#fff" stroke-width="8" opacity=".6"/>`).join('')}
      <rect y="380" width="1600" height="140" fill="#d2dae0"/><rect y="520" width="1600" height="380" fill="#7f8b93"/><g fill="#6f7a82">${Array.from({ length: 30 }, (_, i) => `<circle cx="${i * 56 + 20}" cy="${600 + (i % 3) * 70}" r="5"/>`).join('')}</g>
      ${[200, 640, 1080, 1520].map(x => `<g><rect x="${x - 90}" y="360" width="180" height="120" rx="20" fill="#2f6db0"/><rect x="${x - 100}" y="460" width="200" height="40" rx="12" fill="#285d96"/><rect x="${x - 70}" y="500" width="20" height="22" fill="#555"/><rect x="${x + 50}" y="500" width="20" height="22" fill="#555"/></g>`).join('')}
      ${[420, 860, 1300].map(x => `<path d="M${x},90V520" stroke="#f5c518" stroke-width="12"/>`).join('')}<path d="M0,110H1600" stroke="#9aa5ab" stroke-width="8"/>${[150, 350, 1150, 1350].map(x => `<path d="M${x},110V160" stroke="#9aa5ab" stroke-width="4"/><circle cx="${x}" cy="170" r="12" fill="none" stroke="#f5c518" stroke-width="5"/>`).join('')}`);
  }

  /* places in town */
  const counter = (x, w, col, top) => `<rect x="${x}" y="370" width="${w}" height="22" fill="${top || '#6e4426'}"/><rect x="${x + 10}" y="392" width="${w - 20}" height="128" fill="${col}"/>`;
  const sign = (x, y, w, txt, bg, fg, fs) => `<rect x="${x}" y="${y}" width="${w}" height="${(fs || 34) * 1.6}" rx="10" fill="${bg}"/><text x="${x + w / 2}" y="${y + (fs || 34) * 1.15}" text-anchor="middle" font-family="sans-serif" font-size="${fs || 34}" font-weight="700" fill="${fg}">${txt}</text>`;
  const tiles = (col, line) => `<rect y="520" width="1600" height="380" fill="${col}"/><g stroke="${line}" stroke-width="3">${[560, 625, 715, 835].map(y => `<path d="M0,${y}H1600"/>`).join('')}${[[800, 800], [560, 380], [1040, 1220], [320, -40], [1280, 1640]].map(([a, b]) => `<path d="M${a},520L${b},900"/>`).join('')}</g>`;
  const chairRow = (x, n, col) => Array.from({ length: n }, (_, i) => `<g transform="translate(${x + i * 90} 0)"><rect x="0" y="420" width="70" height="56" rx="10" fill="${col}"/><rect x="0" y="470" width="70" height="16" rx="6" fill="${col}"/><path d="M8,486V520M62,486V520" stroke="#555" stroke-width="6"/></g>`).join('');
  function airport() {
    return svg(`<rect width="1600" height="900" fill="#e8edf1"/><rect y="0" width="1600" height="60" fill="#c9d3da"/>
      <g><rect x="40" y="110" width="700" height="250" fill="#bfe2f2" stroke="#9aa5ab" stroke-width="10"/>${[215, 390, 565].map(x => `<path d="M${x},110V360" stroke="#9aa5ab" stroke-width="8"/>`).join('')}
        <g transform="translate(330 220) rotate(-12)"><path d="M-120,0Q-130,-14 -100,-14H110Q140,-10 150,0Q140,10 110,14H-100Q-130,14 -120,0Z" fill="#fff"/><path d="M-10,-12L-60,-70H-30L40,-12ZM-10,12L-60,70H-30L40,12ZM-100,-12L-125,-40H-108L-80,-12Z" fill="#dfe6ea"/></g>
        <rect x="40" y="300" width="700" height="60" fill="#9fb9a0"/></g>
      <g><rect x="880" y="110" width="440" height="210" rx="10" fill="#1e2a36"/><text x="900" y="150" font-family="monospace" font-size="28" fill="#f5c518">DEPARTURES</text>
        ${[['MADRID', '10', '09:40'], ['TOKYO', '12', '10:15'], ['LIMA', '7', '11:00'], ['ROME', '3', '11:30']].map(([c, g, t], i) => `<text x="900" y="${195 + i * 34}" font-family="monospace" font-size="24" fill="#e8f0f6">${c}</text><text x="1140" y="${195 + i * 34}" font-family="monospace" font-size="24" fill="#8fd3f4">${g}</text><text x="1210" y="${195 + i * 34}" font-family="monospace" font-size="24" fill="#e8f0f6">${t}</text>`).join('')}</g>
      ${sign(1360, 130, 200, 'GATES →', '#f5c518', '#1e2a36', 30)}
      ${tiles('#d4dadf', '#c2c9ce')}<rect y="506" width="1600" height="16" fill="#9aa5ab"/>
      <g><rect x="980" y="380" width="160" height="140" rx="10" fill="#9aa5ab"/><rect x="1000" y="400" width="120" height="70" rx="6" fill="#2b3a46"/><rect x="760" y="440" width="560" height="30" rx="8" fill="#4b5a66"/><rect x="800" y="420" width="90" height="22" rx="4" fill="#cfd8de"/><rect x="1180" y="420" width="80" height="22" rx="4" fill="#cfd8de"/>
        <path d="M1400,520V380H1440V520M1560,520V380H1520V520M1400,380H1560" fill="none" stroke="#7d8a94" stroke-width="14"/></g>`);
  }
  function museum() {
    const painting = (x, y, w, h, inner) => `<rect x="${x - 14}" y="${y - 14}" width="${w + 28}" height="${h + 28}" fill="#c9a042"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f4ead6"/>${inner}`;
    return svg(`<rect width="1600" height="900" fill="#efe6d6"/><rect width="1600" height="50" fill="#d8ccb6"/>${tiles('#cfc2ab', '#bcae95')}${skirting(520, '#a8957a')}
      ${painting(140, 160, 220, 160, `<rect x="140" y="250" width="220" height="70" fill="#6aa86a"/><circle cx="300" cy="200" r="24" fill="#f2c94c"/><path d="M140,250Q200,200 260,250" fill="#4f8a5a"/>`)}
      ${painting(480, 140, 180, 220, `<rect x="480" y="140" width="180" height="220" fill="#1f2d4a"/><circle cx="570" cy="210" r="34" fill="#f6e7b0"/><path d="M480,320Q570,280 660,320V360H480Z" fill="#2e4470"/>`)}
      <g fill="#e8dcc6" stroke="#c9b99c" stroke-width="4"><rect x="760" y="80" width="60" height="440"/><rect x="740" y="70" width="100" height="24"/><rect x="740" y="500" width="100" height="22"/></g>
      <g><rect x="960" y="430" width="560" height="90" fill="#d8ccb6" stroke="#bcae95" stroke-width="4"/>
        <g fill="none" stroke="#f6f1e6" stroke-width="16" stroke-linecap="round"><path d="M1020,400Q1150,330 1300,360Q1380,370 1420,330L1470,250"/><path d="M1080,390V430M1140,370V430M1290,370V430M1360,365V430"/><path d="M1470,250Q1500,230 1510,250"/><path d="M1020,400Q980,420 960,400"/></g>
        <g stroke="#f6f1e6" stroke-width="7">${[1160, 1190, 1220, 1250].map(x => `<path d="M${x},345V395"/>`).join('')}</g></g>
      ${sign(1140, 150, 280, 'DINOSAURS ↑', '#7a4a2a', '#fff', 30)}<path d="M100,520H700" stroke="#c9a042" stroke-width="4" stroke-dasharray="14 10"/>`);
  }
  function library() {
    const shelf = (x, w) => `<rect x="${x}" y="120" width="${w}" height="400" fill="#7a4a2a"/>${[200, 290, 380, 470].map(y => `<rect x="${x + 10}" y="${y}" width="${w - 20}" height="10" fill="#5e3a20"/>`).join('')}
      ${[130, 210, 300, 390].map((y, r) => Array.from({ length: Math.floor((w - 30) / 26) }, (_, i) => `<rect x="${x + 16 + i * 26}" y="${y + 10 + ((i * 7 + r * 3) % 4) * 5}" width="22" height="${60 - ((i * 7 + r * 3) % 4) * 5}" fill="${['#c0504d', '#4f81bd', '#9bbb59', '#f2c94c', '#8064a2', '#4bacc6', '#d9b38c'][(i + r * 2) % 7]}"/>`).join('')).join('')}`;
    return svg(`<rect width="1600" height="900" fill="#efe4cf"/>${planks(520, '#a9784c', '#8a5e38')}${skirting(520, '#6e4426')}
      ${shelf(40, 420)}${shelf(1140, 420)}${sign(560, 120, 480, 'CHILDREN’S SECTION ↑', '#2f8f4a', '#fff', 30)}
      <g>${counter(560, 480, '#9c6b45', '#6e4426')}<rect x="640" y="330" width="80" height="44" rx="4" fill="#333"/><rect x="650" y="338" width="60" height="30" fill="#8fd3f4"/><g fill="#c0504d"><rect x="900" y="340" width="90" height="16"/><rect x="905" y="324" width="80" height="16" fill="#4f81bd"/></g>
        <path d="M820,370V320" stroke="#444" stroke-width="5"/><path d="M790,320H850L835,290H805Z" fill="#2f8f4a"/></g>${plant(500, 462, 0.8)}`);
  }
  function restaurant() {
    const table = x => `<g><ellipse cx="${x}" cy="440" rx="120" ry="20" fill="#fff"/><path d="M${x - 120},440L${x - 110},500H${x + 110}L${x + 120},440Z" fill="#fff" stroke="#e6e0d8" stroke-width="3"/><rect x="${x - 6}" y="500" width="12" height="20" fill="#5e3a20"/>
      <rect x="${x - 5}" y="405" width="10" height="32" fill="#f6e7b0"/><path d="M${x},405q-6,-12 0,-20q6,8 0,20" fill="#f5a623"/><circle cx="${x - 60}" cy="436" r="14" fill="#eee" stroke="#ccc" stroke-width="2"/><circle cx="${x + 60}" cy="436" r="14" fill="#eee" stroke="#ccc" stroke-width="2"/></g>`;
    return svg(`<rect width="1600" height="900" fill="#7a2f2f"/><g fill="#6a2626">${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 100 + 30}" width="40" height="520"/>`).join('')}</g>${planks(520, '#5e3a20', '#4a2c16')}${skirting(520, '#3a2210')}
      <g><rect x="580" y="110" width="440" height="230" rx="10" fill="#1a2550" stroke="#c9a042" stroke-width="10"/><path d="M800,110V340" stroke="#c9a042" stroke-width="8"/><g fill="#ffd166">${[[620, 300], [660, 260], [700, 290], [860, 280], [920, 250], [960, 300]].map(([x, y]) => `<rect x="${x}" y="${y}" width="10" height="14"/>`).join('')}</g><circle cx="940" cy="160" r="26" fill="#f6e7b0"/></g>
      ${[250, 1350].map(x => `<path d="M${x},140V180" stroke="#c9a042" stroke-width="4"/><path d="M${x - 30},210L${x - 14},180H${x + 14}L${x + 30},210Z" fill="#f6e7b0"/><ellipse cx="${x}" cy="240" rx="110" ry="70" fill="#ffd166" opacity=".18"/>`).join('')}
      ${table(250)}${table(1350)}${sign(700, 380, 200, 'MENU', '#c9a042', '#3a2210', 34)}`);
  }
  function hospital() {
    return svg(`<rect width="1600" height="900" fill="#e6f1f2"/><rect y="300" width="1600" height="220" fill="#d3e7e9"/>${tiles('#dfe6e8', '#c9d3d6')}<rect y="506" width="1600" height="16" fill="#9fb9bd"/>
      <g><rect x="80" y="140" width="110" height="110" rx="14" fill="#fff" stroke="#c9d3d6" stroke-width="4"/><path d="M118,160H152V178H170V212H152V230H118V212H100V178H118Z" fill="#e5484d"/></g>
      ${sign(240, 150, 420, 'WAITING ROOM →', '#2f6db0', '#fff', 30)}${chairRow(900, 6, '#4bacc6')}
      <g>${counter(260, 520, '#f3efe6', '#9fb9bd')}<rect x="330" y="320" width="90" height="54" rx="4" fill="#333"/><rect x="340" y="328" width="70" height="38" fill="#8fd3f4"/>${sign(520, 420, 200, 'RECEPTION', '#2f8f4a', '#fff', 24)}</g>
      <g><rect x="900" y="130" width="620" height="200" fill="#bfe2f2" stroke="#fff" stroke-width="12"/><path d="M1106,130V330M1313,130V330" stroke="#fff" stroke-width="8"/><g fill="#9fd08f"><circle cx="980" cy="300" r="50"/><circle cx="1420" cy="290" r="60"/></g></g>${plant(840, 462, 0.8)}`);
  }
  function supermarket() {
    const aisle = (x, n) => `<g><rect x="${x}" y="200" width="300" height="320" fill="#e9eef2" stroke="#b9c3c9" stroke-width="4"/>${[270, 350, 430].map(y => `<rect x="${x}" y="${y}" width="300" height="10" fill="#b9c3c9"/>`).join('')}
      ${[210, 290, 370, 450].map((y, r) => Array.from({ length: 7 }, (_, i) => `<rect x="${x + 12 + i * 41}" y="${y + 14 + (i % 2) * 6}" width="34" height="${50 - (i % 2) * 6}" rx="4" fill="${['#e5484d', '#f5c518', '#3b82f6', '#22a55b', '#f97316', '#a855f7'][(i + r) % 6]}"/>`).join('')).join('')}
      <path d="M${x + 150},80V150" stroke="#777" stroke-width="4"/>${sign(x + 90, 140, 120, n, '#2f6db0', '#fff', 40)}</g>`;
    return svg(`<rect width="1600" height="900" fill="#f4f6f8"/><rect width="1600" height="70" fill="#22a55b"/><text x="800" y="50" text-anchor="middle" font-family="sans-serif" font-size="40" font-weight="800" fill="#fff" letter-spacing="6">SUPERMARKET</text>
      ${tiles('#e6e9ec', '#d3d8dc')}${aisle(80, '4')}${aisle(460, '5')}
      <g>${sign(900, 160, 240, 'BREAD 5 ←', '#f5c518', '#333', 30)}<rect x="900" y="380" width="250" height="140" fill="#c9965a"/><g fill="#e0a85a" stroke="#a87436" stroke-width="3">${[[930, 360], [990, 352], [1050, 360], [1110, 354]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="34" ry="18"/>`).join('')}</g></g>
      <g><rect x="1240" y="400" width="320" height="120" rx="8" fill="#555"/><rect x="1240" y="390" width="320" height="16" rx="6" fill="#222"/><rect x="1440" y="320" width="70" height="70" rx="6" fill="#333"/><rect x="1450" y="330" width="50" height="34" fill="#8fd3f4"/>${sign(1280, 150, 240, 'CHECKOUT', '#e5484d', '#fff', 30)}<path d="M1400,260V300" stroke="#777" stroke-width="4"/></g>`);
  }
  function cinema() {
    const poster = (x, c, t) => `<rect x="${x}" y="130" width="170" height="250" rx="6" fill="#1b1b1f" stroke="#c9a042" stroke-width="8"/><rect x="${x + 15}" y="145" width="140" height="170" fill="${c}"/><circle cx="${x + 85}" cy="215" r="34" fill="rgba(255,255,255,.35)"/><text x="${x + 85}" y="355" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="#fff">${t}</text>`;
    return svg(`<rect width="1600" height="900" fill="#2a1f3a"/><g fill="#33264a">${Array.from({ length: 10 }, (_, i) => `<rect x="${i * 160 + 50}" width="60" height="520"/>`).join('')}</g>
      <rect y="520" width="1600" height="380" fill="#6a1f2f"/><g fill="#7d2a3c">${Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 97) % 1600}" cy="${560 + (i * 53) % 300}" r="8"/>`).join('')}</g><rect y="506" width="1600" height="16" fill="#c9a042"/>
      ${poster(80, '#e5484d', 'SPACE')}${poster(290, '#3b82f6', 'OCEAN')}${sign(560, 120, 300, '← SCREEN 4', '#c9a042', '#2a1f3a', 34)}
      <g>${counter(560, 520, '#8a2a3c', '#c9a042')}<rect x="980" y="250" width="110" height="130" rx="8" fill="#e5484d"/><rect x="990" y="260" width="90" height="70" fill="#fff6c4"/><g fill="#fffbe8">${Array.from({ length: 12 }, (_, i) => `<circle cx="${1000 + (i % 5) * 17}" cy="${300 + Math.floor(i / 5) * 12}" r="8"/>`).join('')}</g>
        ${sign(620, 420, 220, 'TICKETS', '#c9a042', '#2a1f3a', 28)}</g>
      ${[1240, 1420].map(x => `<g><rect x="${x}" y="130" width="130" height="390" fill="#4a1f2f" stroke="#c9a042" stroke-width="8"/><circle cx="${x + 110}" cy="330" r="7" fill="#c9a042"/></g>`).join('')}
      ${Array.from({ length: 16 }, (_, i) => `<circle cx="${50 + i * 100}" cy="30" r="9" fill="#ffd166"/>`).join('')}`);
  }
  function hotel() {
    return svg(`<rect width="1600" height="900" fill="#f1e8d8"/><rect y="0" width="1600" height="300" fill="#e7dbc4"/><path d="M0,300H1600" stroke="#c9a042" stroke-width="6"/>${tiles('#e3d6bd', '#cdbf9f')}${skirting(520, '#8a6a46')}
      <g><rect x="460" y="120" width="420" height="200" fill="#7a4a2a"/>${Array.from({ length: 12 }, (_, i) => `<g transform="translate(${490 + (i % 6) * 62} ${150 + Math.floor(i / 6) * 80})"><circle r="10" fill="#c9a042"/><path d="M0,10V40" stroke="#c9a042" stroke-width="4"/><rect x="-10" y="38" width="20" height="14" rx="3" fill="#e5484d"/></g>`).join('')}</g>
      <text x="670" y="100" text-anchor="middle" font-family="serif" font-size="46" font-weight="700" fill="#7a4a2a" letter-spacing="10">HOTEL</text>
      <g>${counter(420, 500, '#9c6b45', '#5e3a20')}<circle cx="820" cy="360" r="16" fill="#c9a042"/><rect x="800" y="364" width="40" height="8" fill="#a8852a"/>${sign(470, 420, 220, 'RECEPTION', '#c9a042', '#3a2210', 26)}</g>
      <g><rect x="1100" y="150" width="280" height="370" fill="#b9b2a5" stroke="#8a6a46" stroke-width="10"/><path d="M1240,160V520" stroke="#8a6a46" stroke-width="6"/><circle cx="1400" cy="320" r="12" fill="#f5c518"/><rect x="1180" y="110" width="120" height="34" rx="6" fill="#333"/><text x="1240" y="136" text-anchor="middle" font-family="monospace" font-size="24" fill="#f5c518">▲ 3</text></g>
      ${plant(300, 462, 1.1)}${plant(1500, 462, 1.1)}<g><path d="M200,120V60" stroke="#c9a042" stroke-width="4"/><circle cx="200" cy="140" r="34" fill="#fff6c4" stroke="#c9a042" stroke-width="5"/></g>`);
  }
  function pharmacy() {
    const shelf = x => `<g><rect x="${x}" y="150" width="380" height="370" fill="#f6f8fa" stroke="#c9d3d6" stroke-width="4"/>${[240, 330, 420].map(y => `<rect x="${x}" y="${y}" width="380" height="10" fill="#c9d3d6"/>`).join('')}
      ${[160, 250, 340, 430].map((y, r) => Array.from({ length: 9 }, (_, i) => `<rect x="${x + 12 + i * 40}" y="${y + 30 - (i % 3) * 10}" width="32" height="${48 + (i % 3) * 10}" rx="3" fill="${['#fff', '#8fd3f4', '#9fd08f', '#f9c6d0', '#ffe9a8'][(i + r) % 5]}" stroke="#b9c3c9" stroke-width="2"/>`).join('')).join('')}</g>`;
    return svg(`<rect width="1600" height="900" fill="#eef5f0"/>${tiles('#e3ebe6', '#cfdad3')}<rect y="506" width="1600" height="16" fill="#9fbfac"/>
      ${shelf(40)}${shelf(1180)}<g><rect x="720" y="110" width="160" height="160" rx="20" fill="#22a55b"/><path d="M775,130H825V165H860V215H825V250H775V215H740V165H775Z" fill="#fff"/></g>
      ${sign(560, 290, 480, 'PHARMACY', '#22a55b', '#fff', 36)}<g>${counter(540, 520, '#fff', '#22a55b')}<rect x="900" y="330" width="80" height="44" rx="4" fill="#333"/><rect x="908" y="338" width="64" height="28" fill="#8fd3f4"/><g fill="#fff" stroke="#9fbfac" stroke-width="3"><rect x="620" y="340" width="50" height="30" rx="4"/><rect x="680" y="346" width="40" height="24" rx="4"/></g></g>`);
  }

  const inner = s => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  /* two scenes side by side: the middle of each, with a white seam */
  function split(a, b) {
    const half = s => `<svg width="796" height="900" viewBox="400 0 800 900" preserveAspectRatio="xMidYMid slice">${inner(s)}</svg>`;
    return svg(`${half(a)}<g transform="translate(804 0)">${half(b)}</g><rect x="796" width="8" height="900" fill="#fff"/><circle cx="800" cy="70" r="34" fill="#fff"/><text x="800" y="84" text-anchor="middle" font-size="38">📞</text>`);
  }
  const SCENES = {
    livingroom: () => livingroom(), home: () => livingroom(),
    grandmahome: () => livingroom({ wall: '#f1e4d8', paper: '#d9b8a8', sofa: '#8c5a7a', curtain: '#6a8f5a', rug: '#b07a6a' }),
    kitchen, bedroom, backyard, clothesshop, warehouse, frontdoor, hallway, rainynight, beach, bus,
    airport, museum, library, restaurant, hospital, supermarket, cinema, hotel, pharmacy
  };
  /* keywords → a scene, tried in this order (the setting chip and its section title first, then the page's title and subtitle) */
  const PLACES = [
    ['airport', /airport|✈️|boarding pass|gate \d|passenger|flight/],
    ['museum', /museum|🏛️|exhibition|gallery|painting/],
    ['library', /library|📚|librarian|borrow/],
    ['restaurant', /restaurant|🍽️|waiter|menu|having dinner|eat out/],
    ['hospital', /hospital|🏥|doctor|patient|appointment|clinic/],
    ['pharmacy', /pharmacy|💊|pharmacist|medicine|chemist/],
    ['supermarket', /supermarket|🛒|grocer|shopping for food|checkout/],
    ['cinema', /cinema|🎬|movie theater|watch a film|film|movie|popcorn/],
    ['hotel', /hotel|🏨|check(ing)? in|reception desk/],
    ['backyard', /barbecue|bbq|🌭|backyard|garden|picnic/],
    ['frontdoor', /front door|doorstep|porch/],
    ['hallway', /🧳|back from|suitcase|hallway|come home after/],
    ['warehouse', /warehouse|📦|factory|delivery company/],
    ['clothesshop', /clothes|shop|store|boutique|👕|👗|🛍️/],
    ['beach', /beach|sydney|🏖️/],
    ['rainynight', /toronto|rainy night/],
    ['bus', /\bbus\b|🚌/],
    ['kitchen', /kitchen|dinner|breakfast|lunch|cook|🍳/],
    ['livingroom', /living room|apartment|sofa|🛋️/],
    ['bedroom', /bedroom|my room|clean.*room|🛏️/],
    ['cafe', /caf[eé]|coffee|☕/],
    ['classroom', /classroom|school|class\b|teacher|🏫/],
    ['park', /\bpark\b|🌳/],
    ['livingroom', /house|home|🏠|family/]
  ];
  const sceneOf = t => { t = (t || '').toLowerCase(); for (const [id, re] of PLACES) if (re.test(t)) return id; return null; };

  /* ── people ── */
  const P = (o) => Object.assign({ eyeColor: 12, height: 3, weight: 3, mouth: 'smile' }, o);
  const KID = { height: 1, weight: 2 };
  const CAST = {
    ana: P({ bodyType: 'female', skin: 3, hairStyle: 'ponytail', hairColor: '3-0', upperGarment: 'blouse', upperColor: '#FF6600', lowerGarment: 'trousers', lowerColor: '#333333', footwear: 'shoes' }),
    mia: P({ bodyType: 'female', skin: 2, eyeColor: 7, hairStyle: 'long', hairColor: '5-0', upperGarment: 'tshirt', upperColor: '#6600CC', lowerGarment: 'jeans', lowerColor: '#000066', footwear: 'sneakers' }),
    sam: P({ bodyType: 'male', skin: 5, eyeColor: 14, hairStyle: 'short', hairColor: '1-0', upperGarment: 'polo', upperColor: '#00CC66', lowerGarment: 'chinos', footwear: 'sneakers' }),
    leo: P({ bodyType: 'male', skin: 2, eyeColor: 9, hairStyle: 'curly', hairColor: '5-0', facialHair: 'beard', upperGarment: 'shirt', upperColor: '#0066CC', lowerGarment: 'jeans', footwear: 'boots' }),
    tom: P({ bodyType: 'male', skin: 1, eyeColor: 2, hairStyle: 'buzz', hairColor: '8-0', upperGarment: 'hoodie', upperColor: '#CC0000', lowerGarment: 'jeans', footwear: 'sneakers' }),
    rosa: P({ bodyType: 'female', skin: 4, eyeColor: 13, hairStyle: 'bun', hairColor: 'grey', eyewear: 'round', upperGarment: 'blouse', upperColor: '#CC6600', lowerGarment: 'skirt', lowerColor: '#663300', footwear: 'shoes' }),
    emma: P({ bodyType: 'female', skin: 1, eyeColor: 3, hairStyle: 'bob', hairColor: '8-0', upperGarment: 'hoodie', upperColor: '#ff6b6b', lowerGarment: 'jeans', footwear: 'sneakers' }),
    ben: P(Object.assign({ bodyType: 'male', skin: 3, hairStyle: 'short', hairColor: '4-0', upperGarment: 'tshirt', upperColor: '#FF6600', lowerGarment: 'jeans', footwear: 'sneakers' }, KID)),
    lily: P(Object.assign({ bodyType: 'female', skin: 3, hairStyle: 'pigtails', hairColor: '4-0', upperGarment: 'dress', upperColor: '#FF66CC', footwear: 'sneakers' }, KID)),
    mom: P({ bodyType: 'female', skin: 3, hairStyle: 'bob', hairColor: '3-0', upperGarment: 'blouse', upperColor: '#CC0000', lowerGarment: 'trousers', lowerColor: '#333333', footwear: 'shoes', accessories: ['drops'] }),
    dad: P({ bodyType: 'male', skin: 3, hairStyle: 'sidepart', hairColor: '3-0', facialHair: 'stubble', upperGarment: 'polo', upperColor: '#663300', lowerGarment: 'chinos', footwear: 'shoes', height: 4 }),
    grandma: P({ bodyType: 'female', skin: 2, hairStyle: 'bun', hairColor: 'white', eyewear: 'glasses', upperGarment: 'blouse', upperColor: '#6666CC', lowerGarment: 'skirt', lowerColor: '#333333', footwear: 'shoes', height: 2 }),
    grandpa: P({ bodyType: 'male', skin: 2, hairStyle: 'sidepart', hairColor: 'grey', facialHair: 'moustache', eyewear: 'round', upperGarment: 'vest', upperColor: '#666666', lowerGarment: 'trousers', footwear: 'shoes' }),
    daniel: P({ bodyType: 'male', skin: 4, hairStyle: 'curly', hairColor: '1-0', upperGarment: 'shirt', upperColor: '#0066CC', lowerGarment: 'chinos', footwear: 'shoes' }),
    sofia: P({ bodyType: 'female', skin: 3, hairStyle: 'long', hairColor: '4-0', upperGarment: 'blouse', upperColor: '#CC0066', lowerGarment: 'jeans', footwear: 'shoes' }),
    park: P({ bodyType: 'female', skin: 2, hairStyle: 'bun', hairColor: '1-0', upperGarment: 'jacket', upperColor: '#6600CC', lowerGarment: 'trousers', footwear: 'heels' }),
    dan: P({ bodyType: 'male', skin: 4, hairStyle: 'short', hairColor: '1-0', eyewear: 'glasses', upperGarment: 'shirt', upperColor: '#0066CC', lowerGarment: 'chinos', footwear: 'shoes' }),
    luis: P({ bodyType: 'male', skin: 4, hairStyle: 'short', hairColor: '1-0', facialHair: 'moustache', upperGarment: 'shirt', upperColor: '#FFFFFF', lowerGarment: 'trousers', footwear: 'shoes' }),
    teacher: P({ bodyType: 'female', skin: 4, hairStyle: 'bob', hairColor: '1-0', eyewear: 'glasses', upperGarment: 'blouse', upperColor: '#666666', lowerGarment: 'skirt', footwear: 'shoes' })
  };
  const ALIAS = { mum: 'mom', mother: 'mom', 'ms. park': 'park', father: 'dad', grandmother: 'grandma', granny: 'grandma', grandfather: 'grandpa' };
  const FEMALE = /👩|👧|👵|🙋‍♀️|💁‍♀️|🙎‍♀️|🧕|👸/u, MALE = /👨|👦|👴|🙋‍♂️|💁‍♂️|🧔|🤴/u, CHILD = /👦|👧|🧒/u, OLD = /👵|👴|🧓|👩‍🦳|👨‍🦳/u;
  const TONE = { '🏻': 1, '🏼': 2, '🏽': 3, '🏾': 5, '🏿': 6 };
  const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const COLS = ['#CC0000', '#0066CC', '#00CC66', '#6600CC', '#FF6600', '#00CCCC', '#FF66CC', '#663300', '#006666', '#660066', '#CC6600', '#336699'];
  function madeUp(name, avatar) {
    let h = hash(name.toLowerCase() + avatar);
    const r = n => { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; return h % n; };
    const f = FEMALE.test(avatar) ? true : MALE.test(avatar) ? false : r(2) === 0;
    const tone = [...avatar].map(c => TONE[c]).find(Boolean);
    const hairs = f ? ['long', 'bob', 'ponytail', 'bun', 'curly', 'afro'] : ['short', 'sidepart', 'crew', 'curly', 'afro', 'buzz'];
    const c = P({ bodyType: f ? 'female' : 'male', skin: tone || 1 + r(6), eyeColor: 1 + r(16), hairStyle: /🦱/u.test(avatar) ? 'curly' : /🦲/u.test(avatar) ? 'bald' : hairs[r(hairs.length)],
      hairColor: OLD.test(avatar) ? 'grey' : /🦰/u.test(avatar) ? '9-1' : /👱/u.test(avatar) ? '9-0' : ['1-0', '3-0', '4-0', '5-0', '6-0', '8-0'][r(6)],
      upperGarment: f ? ['blouse', 'tshirt', 'hoodie'][r(3)] : ['shirt', 'polo', 'tshirt', 'hoodie'][r(4)], upperColor: COLS[r(COLS.length)],
      lowerGarment: ['jeans', 'chinos', 'trousers'][r(3)], footwear: ['sneakers', 'shoes'][r(2)] });
    if (!f && r(3) === 0) c.facialHair = ['stubble', 'beard', 'moustache'][r(3)];
    return c;
  }
  /* people named by their job (Waiter, Doctor, Security officer…) wear its clothes */
  const ROLES = [
    [/security|officer|police|guard/, { upperGarment: 'shirt', upperColor: '#1f3a68', lowerGarment: 'trousers', lowerColor: '#1f2a44', footwear: 'shoes', headwear: 'cap', headwearColor: '#1f3a68' }],
    [/doctor|pharmacist|dentist|vet\b/, { upperGarment: 'coat', upperColor: '#FFFFFF', lowerGarment: 'trousers', lowerColor: '#333333', footwear: 'shoes' }],
    [/nurse/, { upperGarment: 'tshirt', upperColor: '#4bacc6', lowerGarment: 'trackpants', lowerColor: '#4bacc6', footwear: 'sneakers' }],
    [/waiter|waitress|server/, { upperGarment: 'vest', upperColor: '#222222', lowerGarment: 'trousers', lowerColor: '#222222', footwear: 'shoes', accessories: ['tie'], tieColor: '#990000' }],
    [/receptionist|manager|clerk/, { upperGarment: 'jacket', upperColor: '#2f3e66', lowerGarment: 'trousers', lowerColor: '#2f3e66', footwear: 'shoes' }],
    [/guide/, { upperGarment: 'jacketopen', upperColor: '#7a4a2a', lowerGarment: 'chinos', footwear: 'shoes' }],
    [/librarian|teacher|professor/, { upperGarment: 'vest', upperColor: '#6a8f5a', lowerGarment: 'chinos', footwear: 'shoes', eyewear: 'glasses' }],
    [/cashier|shop assistant|cinema worker|worker|staff/, { upperGarment: 'polo', lowerGarment: 'chinos', footwear: 'sneakers' }],
    [/chef|cook/, { upperGarment: 'shirt', upperColor: '#FFFFFF', lowerGarment: 'trousers', lowerColor: '#333333', footwear: 'shoes' }],
    [/passenger|guest|tourist|traveller|traveler/, { held: { left: null, right: 'suitcase' } }],
    [/student|pupil/, { upperGarment: 'hoodie', accessories: ['backpack'] }]
  ];
  function dress(c, role) {
    const hit = ROLES.find(([re]) => re.test(role)); if (!hit) return;
    const o = JSON.parse(JSON.stringify(hit[1]));
    if (o.upperGarment === 'jacket' && c.bodyType === 'female') o.accessories = ['drops'];
    Object.assign(c, o);
  }
  function personFor(name, avatar) {
    const key = name.replace(/\s*\(.*\)\s*$/, '').trim(), low = key.toLowerCase(), id = ALIAS[low] || low;
    let c = null;
    const DH = window.DeductionHouse, PP = window.PP;
    if (DH && DH.CAST) {
      const inner = (name.match(/\(([^)]+)\)/) || [])[1];
      const hit = Object.values(DH.CAST).find(p => [p.name, p.role].some(v => v && [low, (inner || '').toLowerCase()].includes(String(v).toLowerCase())));
      if (hit) c = JSON.parse(JSON.stringify(hit.c));
    }
    if (!c && PP && PP.PEOPLE && PP.PEOPLE[id]) c = JSON.parse(JSON.stringify(PP.PEOPLE[id].hc));
    if (!c && CAST[id]) c = JSON.parse(JSON.stringify(CAST[id]));
    if (!c) { c = madeUp(key, avatar || ''); dress(c, low); }
    if (CHILD.test(avatar || '')) Object.assign(c, KID);
    if (OLD.test(avatar || '') && !/grey|white/.test(c.hairColor || '')) c.hairColor = 'grey';
    c.name = key;
    return c;
  }

  /* ── reading a conversation from the page ── */
  function linesOf(container) {
    return [...container.querySelectorAll('.bubble-wrap')].map(w => {
      const nameEl = w.querySelector('.bname, .bubble-name'), bubble = w.querySelector('.bubble');
      const clone = bubble ? bubble.cloneNode(true) : document.createElement('div');
      clone.querySelectorAll('.ss-figs, .pp-country, svg, .dh-think, .pp-memories, script, style').forEach(n => n.remove());
      const col = bubble && bubble.parentElement;
      const extras = col ? [...col.children].filter(n => n !== bubble && n !== nameEl && !n.matches('.bname, .bubble-name')) : [];
      return { name: (nameEl ? nameEl.textContent : '').trim() || 'Someone', avatar: ((w.querySelector('.avatar') || {}).textContent || '').trim(),
        side: w.classList.contains('right') ? 'right' : 'left', text: clone.textContent.replace(/\s+/g, ' ').trim(), wrap: w, extras,
        colour: ((w.querySelector('.avatar') || {}).getAttribute && (w.querySelector('.avatar').getAttribute('style') || '').match(/#[0-9a-f]{6}/i) || [])[0] };
    }).filter(l => l.text);
  }
  function chipFor(container) {
    for (let n = container.previousElementSibling; n; n = n.previousElementSibling) {
      if (n.matches('.setting-chip')) return n;
      if (n.matches('.sec-div') || n.matches('.bubble-wrap, .vnad-bar') || n.querySelector('.bubble-wrap')) return null;
    }
    return null;
  }
  /* the section title over a conversation (“At the airport ✈️”), when it has one of its own */
  function titleFor(container) {
    for (let n = container.previousElementSibling; n; n = n.previousElementSibling) {
      if (n.matches('.sec-div')) return /conversation|before you read/i.test(n.textContent) ? '' : n.textContent;
      if (n.matches('.bubble-wrap') || n.querySelector('.bubble-wrap')) return '';
    }
    return '';
  }
  const pageText = () => [document.title, (document.querySelector('.page h1') || {}).textContent, (document.querySelector('.page h1 ~ .subtitle') || {}).textContent].join(' · ');
  const LEVEL_WPM = { a1: 125, a1a2: 135, a2: 145, a2b1: 150, b1: 160, b1b2: 165, b2: 170 };
  function wpm() { const t = document.querySelector('.cefr-tag'); const m = t && t.className.match(/cefr-(\w+)/); return (m && LEVEL_WPM[m[1]]) || 140; }
  /* a face for some lines (the pose stays: only brows, eyes and mouth change) */
  function emotionOf(t) {
    if (/^(ha\b|ha ha|haha|😄)/i.test(t) || /😄|😂/.test(t)) return 'joy';
    if (/^(wow|really\?|what\?|oh!|me\?)/i.test(t)) return 'surprise';
    if (/^(oh no|sorry|oh dear)/i.test(t)) return 'apprehension';
    if (/^(great|cool|lucky you|thanks|thank you|nice|good|yes!|of course|sure)/i.test(t)) return 'serenity';
    if (/^(hmm|wait)/i.test(t)) return 'interest';
    return null;
  }

  /* ── building the scene ── */
  const OUT = /\b(bus|beach|office|park|caf[eé]|shop|store|warehouse|car|train|airport)\b/;
  function setting(container, lines) {
    const chip = chipFor(container), chipText = ((chip ? chip.textContent : '') + ' ' + titleFor(container)).trim();
    const forced = chip && chip.getAttribute('data-vn-bg');
    const text = chipText + ' · ' + (chip ? '' : pageText());
    const lower = (chipText || pageText()).toLowerCase();
    const call = forced ? forced.includes('|') : /📞|📱|phone|video call|on a call|calls? (her|him|me|you)\b/.test(chipText.toLowerCase() || pageText().toLowerCase());
    let bg, halves = null;
    if (call) {
      if (forced && forced.includes('|')) halves = forced.split('|').map(s => s.trim());
      else {
        const parts = (chipText.includes('↔') ? chipText.split('↔') : []).map(sceneOf);
        halves = [parts[0] || null, parts[1] || null];
        if (!halves[0] && !halves[1]) {   /* no “A ↔ B”: the first speaker is where the page says (on the bus…), or in another home */
          const first = (lines[0] || {}).side === 'right' ? 1 : 0, m = pageText().toLowerCase().match(OUT);
          halves[first] = (m && sceneOf(m[0])) || 'grandmahome'; halves[1 - first] = 'livingroom';
        }
        halves = halves.map((h, i) => h || (i ? 'livingroom' : 'grandmahome'));
      }
      bg = 'vnad:' + halves.join('|');
    } else bg = forced || sceneOf(chipText) || sceneOf(pageText()) || 'cafe';
    return { bg, halves, call, video: /video/.test(lower), evening: /evening|night/.test(chipText.toLowerCase()) && !/rainynight|hallway/.test(bg) };
  }
  function backdrop(st) {
    const get = id => SCENES[id] ? SCENES[id]() : (window.HouseVN.background(id) || SCENES.livingroom());
    let s = st.halves ? split(get(st.halves[0]), get(st.halves[1])) : get(st.bg);
    if (st.evening) s = s.replace(/<\/svg>$/, '<rect width="1600" height="900" fill="#1a2550" opacity=".22"/></svg>');
    return s;
  }
  const OUTFIT = { beach: { upperGarment: 'tshirt', lowerGarment: 'shorts', footwear: 'sandals', eyewear: 'sunglasses' }, rainynight: { upperGarment: 'hoodie' } };
  /* the name tab has white text: a light colour (a white coat) is darkened until it reads */
  function tabColour(c) {
    if (!/^#[0-9a-f]{6}$/i.test(c || '')) return null;
    let [r, g, b] = [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
    const lum = () => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (lum() > 0.92) return null;   /* white or nearly: the page's accent colour instead */
    while (lum() > 0.55) { r *= 0.85; g *= 0.85; b *= 0.85; }
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }
  function script(container, lines, st) {
    const cast = {}, ids = {}, sideOf = {};
    for (const l of lines) {
      const key = l.name.replace(/\s*\(.*\)\s*$/, '').trim();
      if (!ids[l.name]) {
        let id = key.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'p'; while (cast[id]) id += '_';
        ids[l.name] = id; sideOf[id] = l.side;
        const c = personFor(l.name, l.avatar);
        if (st.halves) {   /* a call: dressed for where they are, the phone at the ear (or held out for a video call) */
          const where = st.halves[l.side === 'left' ? 0 : 1];
          Object.assign(c, OUTFIT[where] || {});
          c.held = Object.assign({}, c.held, { right: 'phone' });
          c.joints = Object.assign({}, c.joints, st.video ? { shoulderR: 35, elbowR: 105 } : { shoulderR: 20, elbowR: 140 });
        }
        cast[id] = { name: l.name, color: tabColour(l.colour || c.upperColor), lang: 'en', wpm: wpm(), character: c };
      }
    }
    /* who is on stage: the first speaker on each side from the start; someone new on a side comes in when they
       first speak, and whoever stood there leaves if they have nothing more to say (the airport worker makes
       way for the security officer), or stays beside them if they do */
    const seq = lines.map(l => ids[l.name]), lastAt = {};
    seq.forEach((id, i) => { lastAt[id] = i; });
    const onSide = { left: [], right: [] }, firstOf = {};
    for (const id of seq) if (!onSide[sideOf[id]].length && !(id in firstOf)) { onSide[sideOf[id]].push(id); firstOf[id] = 0; }
    const out = lines.map((l, i) => {
      const id = ids[l.name], L = { who: id, say: l.text.replace(/[{}]/g, ''), at: sideOf[id], shot: 'medium' };
      const e = emotionOf(l.text); if (e) L.emotion = e;
      if (i === 0) { L.stage = {}; for (const s of ['left', 'right']) for (const o of onSide[s]) if (o !== id) L.stage[o] = { at: s, shot: 'medium' }; }
      const here = onSide[sideOf[id]];
      if (!here.includes(id)) {
        L.stage = L.stage || {};
        for (const o of here.slice()) if (lastAt[o] < i) { L.stage[o] = null; here.splice(here.indexOf(o), 1); }
        here.push(id);
      }
      return L;
    });
    const bgId = 'vnad-' + hash(st.bg + (st.evening ? '!' : ''));
    return { background: bgId, backgrounds: { [bgId]: backdrop(st) }, easing: 'quad', moveTime: 0.45, cast, lines: out, prosody: true };
  }

  /* ── loading the engines (once, when first needed) ── */
  let loading = null;
  function load(src) { return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = BASE + src; s.onload = ok; s.onerror = () => bad(new Error('Could not load ' + src)); document.head.appendChild(s); }); }
  function engines() {
    if (window.HouseCharacter && window.HouseVN) return Promise.resolve();
    return loading || (loading = (window.HouseCharacter ? Promise.resolve() : load('house-character.js')).then(() => window.HouseVN ? null : load('house-vn.js')));
  }

  /* ── the switch ── */
  const CSS = `
.vnad-bar{ display:flex; gap:6px; margin:0 0 .8rem; flex-wrap:wrap; }
.vnad-bar button{ font:inherit; font-size:.8667rem; padding:5px 12px; border-radius:999px; cursor:pointer; border:1px solid var(--color-border-secondary, #ccc);
  background:var(--surface-2, #fff); color:var(--text-secondary, #555); }
.vnad-bar button[aria-pressed="true"]{ background:var(--text-accent, #185fa5); border-color:var(--text-accent, #185fa5); color:#fff; font-weight:600; }
.vnad-bar button:focus-visible{ outline:2px solid var(--text-accent, #185fa5); outline-offset:2px; }
.vnad-host{ margin:0 0 1rem; }
.vnad-wait{ max-width:960px; margin:0 auto; aspect-ratio:16/9; border-radius:var(--radius, 12px); background:var(--surface-1, #eee); border:1px solid var(--border, #ddd); display:flex; align-items:center; justify-content:center; }
.vnad-extra{ margin:.6rem auto 0; max-width:960px; }
.vnad-extra:empty{ display:none; }
.vnad-extra .dh-think, .vnad-extra .pp-memories{ margin-left:auto; margin-right:auto; }
.vnad-msg{ font-size:.8667rem; color:var(--text-secondary, #555); padding:1rem; text-align:center; }`;
  function injectCSS() { if (document.getElementById('vnad-css')) return; const s = document.createElement('style'); s.id = 'vnad-css'; s.textContent = CSS; document.head.appendChild(s); }

  let mode = 'chat';
  try { if (localStorage.getItem(STORE) === 'vn') mode = 'vn'; } catch (e) {}
  const convs = [];

  function setup(container) {
    if (container.dataset.vnad) return; container.dataset.vnad = '1';
    const chip = chipFor(container);
    const bar = document.createElement('div'); bar.className = 'vnad-bar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Show the conversation as');
    bar.innerHTML = '<button type="button" data-m="chat">💬 Chat</button><button type="button" data-m="vn">🎬 Visual novel</button>';
    const anchor = chip && chip.nextElementSibling ? chip : null;
    (anchor ? anchor : container).insertAdjacentElement(anchor ? 'afterend' : 'beforebegin', bar);
    const host = document.createElement('div'); host.className = 'vnad-host'; host.hidden = true;
    const stageEl = document.createElement('div'); stageEl.className = 'vnad-wait';   /* a frame the size of the stage until it starts */
    const extra = document.createElement('div'); extra.className = 'vnad-extra'; extra.setAttribute('aria-live', 'polite');
    host.append(stageEl, extra);
    container.insertAdjacentElement('afterend', host);
    const C = { container, bar, host, stageEl, extra, vn: null, moved: [], visible: false };
    const giveBack = () => { for (const [n, parent, next] of C.moved) parent.insertBefore(n, next); C.moved = []; };
    C.start = () => {
      if (C.vn || C.starting) return; C.starting = true;
      stageEl.innerHTML = '<div class="vnad-msg">🎬 Loading…</div>';
      engines().then(() => {
        C.starting = false; if (mode !== 'vn') { stageEl.innerHTML = ''; return; }
        const lines = linesOf(container); if (!lines.length) { stageEl.innerHTML = ''; return; }
        const st = setting(container, lines), sc = script(container, lines, st);
        sc.onLine = i => {   /* the pictures that go with this line, under the stage */
          giveBack();
          for (const n of (lines[i] || {}).extras || []) { C.moved.push([n, n.parentNode, n.nextSibling]); extra.appendChild(n); }
        };
        stageEl.className = ''; C.vn = window.HouseVN.create(stageEl, sc);
      }).catch(err => { C.starting = false; stageEl.innerHTML = '<div class="vnad-msg">The visual novel could not be loaded. ' + err.message + '</div>'; });
    };
    C.stop = () => { if (C.vn) { C.vn.destroy(); C.vn = null; } giveBack(); stageEl.innerHTML = ''; stageEl.className = 'vnad-wait'; };
    C.apply = (fromClick) => {
      const vn = mode === 'vn';
      bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
      container.hidden = vn; host.hidden = !vn;
      if (!vn) C.stop();
      else if (fromClick === C || C.visible) C.start();
    };
    bar.addEventListener('click', e => {
      const b = e.target.closest('button[data-m]'); if (!b || b.dataset.m === mode) return;
      mode = b.dataset.m; try { localStorage.setItem(STORE, mode); } catch (err) {}
      convs.forEach(c => c.apply(C));
      if (mode === 'vn') setTimeout(() => { const s = stageEl.querySelector('.vn-stage'); if (s) s.focus({ preventScroll: true }); }, 400);
    });
    /* a visual novel starts when most of its stage is on screen, so on a page of several scenes each one
       begins as you reach it rather than all at once */
    if ('IntersectionObserver' in window)
      new IntersectionObserver(es => es.forEach(en => { C.visible = en.isIntersecting; if (C.visible && mode === 'vn') C.start(); }), { threshold: 0.45 }).observe(stageEl);
    else C.visible = true;
    convs.push(C);
    C.apply();
  }
  /* Several conversations on one page: each container of bubbles is one conversation. Bubbles written straight
     into the page (no container, or one container for every scene) are split into one conversation per run:
     a section title, a setting chip or anything else between bubbles starts a new one. */
  function conversations() {
    const parents = new Set();
    document.querySelectorAll('.bubble-wrap').forEach(w => { if (w.parentElement && !w.parentElement.closest('.vnad-host')) parents.add(w.parentElement); });
    const out = [];
    parents.forEach(p => {
      const kids = [...p.children], runs = [];
      let run = null;
      for (const k of kids) {
        if (k.matches('.bubble-wrap')) { if (!run) runs.push(run = []); run.push(k); }
        else if (!k.matches('script, style, template')) run = null;
      }
      if (runs.length === 1 && runs[0].length === kids.filter(k => !k.matches('script, style, template')).length) { out.push(p); return; }
      for (const r of runs) {
        const box = document.createElement('div'); box.className = 'vnad-conv';
        r[0].before(box); r.forEach(w => box.appendChild(w));
        out.push(box);
      }
    });
    return out;
  }
  function init() {
    injectCSS();
    conversations().forEach(setup);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
  else setTimeout(init, 0);

  window.VNAdapter = { init, SCENES, PLACES, CAST, personFor, sceneOf, split };
})();
