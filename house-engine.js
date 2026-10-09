/* ══════════════════════════════════════════════════════════════════════════
   house-engine.js — the house builder's engine: the world model, every
   catalogue (pieces, furniture, appliances, styles), the geometry, both
   renderers (3D isometric and floor plan) and the save format.

   It has no page of its own. The house builder page (a1_freer_house_builder)
   drives it interactively; lesson pages use HousePicture (below) to draw
   houses from saved JSON as pictures, and HousePictureChoice for the
   sentence ↔ picture exercise. Load it after house.js:

     <script src="house.js"></script>
     <script src="house-engine.js"></script>

     const engine = HouseEngine.create(hooks);   // one independent house
     engine.state                                // live state (level, rot, floors…)
     engine.renderIso(stBy, rmBy) → svg markup   // what the builder draws each frame

   hooks (all optional) let the builder add its own overlays to a render:
     showHandles(), selKeys(t), selKey(t), selectedSide(), setViewBox(view, box)
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';


  /* ── Scene styles ─────────────────────────────────────────────────────────
     The materials (light and dark), the 3D scene and the blueprint. Injected
     once into <head> the first time an engine is created, so a page that
     draws houses needs no CSS of its own for them. */
  const STYLE_ID = 'house-engine-styles';
  const CSS = `
/* ═══════════ Scene tokens: isometric materials + blueprint ═══════════ */
:root{
  --iso-bg:#f3f4f1;
  --lot:#e9ebe5;        --lot-line:#c3c8bf;
  --slab-l:#d4d7cf;     --slab-r:#bdc1b8;
  --floor:#e3c89c;      --floor-seam:#cfb07f;
  --wall-l:#f5f0e7;     --wall-r:#d9d0c0;     --wall-t:#a99b85;
  --door-l:#bb8455;     --door-r:#98663b;     --door-t:#7b5231;
  --sill-t:#8f8577;
  --glass:rgba(135,193,236,.52); --glass-edge:#ffffff;
  --winlow-t:#7fb9e6;
  --conc-l:#dedad2;     --conc-r:#c6c1b7;     --conc-t:#ebe8e1;
  --stair-l:#c99b67;    --stair-r:#a87a48;    --stair-t:#e0bd8c;
  --col-l:#a8764a;      --col-r:#8a5d35;      --col-t:#6e4a2a;
  --rail-l:#f6f5f0;     --rail-r:#d5d4cc;     --rail-t:#ffffff;
  --brick-l:#c27658;    --brick-r:#a05c44;    --mortar:#ecdcca;
  --furn-l:#b07a4b;     --furn-r:#8e5f37;     --furn-t:#c79264;
  --linen-l:#f6f3ec;    --linen-r:#ddd7cb;    --linen-t:#fdfbf7;
  --duvet-l:#e2b552;    --duvet-r:#c4983c;    --duvet-t:#edc565;
  --sofa-l:#6f9a90;     --sofa-r:#577f76;     --sofa-t:#80aaa0;
  --cushion-l:#d9a441;   --cushion-r:#b98430;   --cushion-t:#e6b65c;
  --cush-l:#8cb5aa;     --cush-r:#729a90;     --cush-t:#9cc4b9;
  --appdark:#2c3035;    --appdark-r:#1f2226;  --tv:#24282d;
  --appl-l:#eceff1;     --appl-r:#cfd5d9;     --appl-t:#f6f8f9;
  --lampbase:#8a7350;   --shade-l:#f4e4c1;    --shade-r:#dcc8a0;   --shade-t:#faeed6;
  --cab-l:#f2efe8;      --cab-r:#d8d3c8;      --cab-line:#b7b0a2;
  --stone-l:#8c8f94;    --stone-r:#75787d;    --stone-t:#a5a8ad;
  --water:#5fb4e2;      --pooltile-l:#d5edf3; --pooltile-r:#b5d9e3;  --coping:#ece5d6;
  --ctile-l:#eef3f5;    --ctile-r:#d3dce1;    --ctile-line:#aebcc4;
  --ftile:#e6eaec;      --ftile-line:#b9c1c6;  --carpet:#8fa2bd;    --wood-line:#c3a170;
  --clay-l:#cc6d4d;     --clay-r:#a9553c;     --clay-t:#bd6245;    --clay-line:#8a3f2b;
  --rconc-l:#a9adb0;    --rconc-r:#8a8e92;    --rconc-t:#9b9fa2;   --rconc-line:#75797c;
  --rmetal-l:#c3ccd3;   --rmetal-r:#9ca7b0;   --rmetal-t:#b1bbc3;  --rmetal-line:#7d8892;
  --roof-edge:rgba(60,40,30,.5);
  --lap-l:#aac0d1;      --lap-r:#8ca3b5;      --lap-line:#7890a3;
  --vert-l:#abbd9f;     --vert-r:#8ea082;     --vert-line:#7a8d6f;
  --board-l:#c29566;    --board-r:#a27547;    --board-t:#d8b184;   --board-line:#94693f;
  --latt-l:#d9bb8c;     --latt-r:#b8996a;     --latt-t:#e8cfa5;
  --metal-l:#b9bfc4;    --metal-r:#979ea4;    --metal-t:#d3d8dc;   --mesh:rgba(150,158,165,.18); --mesh-line:#8d959c;
  --grass:#b3d796;      --deck:#d8d0c1;       --deck-seam:#c2b8a5;
  --gone:#e5756a;

  --bp-bg:#1f4f8e;  --bp-grid:rgba(255,255,255,.11); --bp-lot:rgba(255,255,255,.38);
  --bp-ink:#eaf3ff; --bp-glass:#9fd3ff; --bp-room:rgba(255,255,255,.07);
  --bp-text:#cfe3ff; --bp-hi:#ffd166; --bp-gone:#ff8a80;

  --slot-accent:#185fa5; --slot-accent-soft:#e6f1fb;
}
html[data-theme="dark"]{
  --iso-bg:#1c1e21;
  --lot:#2c2f33;        --lot-line:#484c52;
  --slab-l:#232528;     --slab-r:#1a1b1e;
  --floor:#8c6f4a;      --floor-seam:#735a3b;
  --wall-l:#d8d2c6;     --wall-r:#b0a898;     --wall-t:#7d715f;
  --door-l:#9a6c44;     --door-r:#7b5332;     --door-t:#5f3f25;
  --sill-t:#6a6256;
  --glass:rgba(120,180,230,.45); --glass-edge:#dfe9f2;
  --winlow-t:#5d9ccc;
  --conc-l:#45433f;     --conc-r:#383633;     --conc-t:#55534e;
  --stair-l:#a07449;    --stair-r:#835c36;    --stair-t:#b98d5c;
  --col-l:#8d6440;      --col-r:#704d2f;      --col-t:#563a22;
  --rail-l:#d4d3cc;     --rail-r:#aaa9a2;     --rail-t:#e6e5df;
  --brick-l:#9c5a43;    --brick-r:#7d4533;    --mortar:#b9a896;
  --furn-l:#8b5f3a;     --furn-r:#6e4a2c;     --furn-t:#9e6f47;
  --linen-l:#d6d2c8;    --linen-r:#b9b4a9;    --linen-t:#e2ded5;
  --duvet-l:#b08a35;    --duvet-r:#8f6f29;    --duvet-t:#bf9842;
  --sofa-l:#4d7169;     --sofa-r:#3c5952;     --sofa-t:#5a8076;
  --cushion-l:#a9772f;   --cushion-r:#8a611f;   --cushion-t:#bd8a3e;
  --cush-l:#628a80;     --cush-r:#4f7068;     --cush-t:#6e978c;
  --appdark:#1f2226;    --appdark-r:#16181b;  --tv:#191c20;
  --appl-l:#b7bcc0;     --appl-r:#9aa0a5;     --appl-t:#c6cbcf;
  --lampbase:#6d5a3f;   --shade-l:#c9b993;    --shade-r:#b2a37f;   --shade-t:#d6c7a3;
  --cab-l:#c9c5bd;      --cab-r:#aca89f;      --cab-line:#8e897f;
  --stone-l:#5e6166;    --stone-r:#4b4e52;    --stone-t:#6f7277;
  --water:#2f7aa8;      --pooltile-l:#7fa9b4; --pooltile-r:#668f9a;  --coping:#8c8679;
  --ctile-l:#b9c2c7;    --ctile-r:#9aa4aa;    --ctile-line:#7d878d;
  --ftile:#6b7174;      --ftile-line:#575c5f;  --carpet:#4f6079;    --wood-line:#6f5536;
  --clay-l:#a5563c;     --clay-r:#84432f;     --clay-t:#964d36;    --clay-line:#6a3221;
  --rconc-l:#7d8184;    --rconc-r:#65686b;    --rconc-t:#717477;   --rconc-line:#56595c;
  --rmetal-l:#8e979e;   --rmetal-r:#737c83;   --rmetal-t:#818a91;  --rmetal-line:#5f676e;
  --roof-edge:rgba(0,0,0,.45);
  --lap-l:#7f95a6;      --lap-r:#667b8b;      --lap-line:#566a79;
  --vert-l:#83957a;     --vert-r:#6a7b61;     --vert-line:#5a6a52;
  --board-l:#9a734c;    --board-r:#7b5a39;    --board-t:#ad8660;   --board-line:#6b4d30;
  --latt-l:#ad9270;     --latt-r:#8f7656;     --latt-t:#bca283;
  --metal-l:#8f969c;    --metal-r:#737a80;    --metal-t:#a7aeb3;   --mesh:rgba(150,158,165,.16); --mesh-line:#80888f;
  --grass:#4d7a44;      --deck:#6b665d;       --deck-seam:#5a564e;

  --bp-bg:#163a69;

  --slot-accent:#6aa9ec; --slot-accent-soft:#1f3346;
}

/* isometric scene */
.iso-scene polygon{ stroke-width:1.1; stroke-linejoin:round; }
.lot{ fill:var(--lot); stroke:var(--lot); }
.slab-l{ fill:var(--slab-l); stroke:var(--slab-l); }
.slab-r{ fill:var(--slab-r); stroke:var(--slab-r); }
.lot-line{ stroke:var(--lot-line); stroke-width:1; stroke-dasharray:4 4; fill:none; }
.m-earth.fl{ fill:var(--slab-l); stroke:var(--slab-l); }
.m-earth.fr{ fill:var(--slab-r); stroke:var(--slab-r); }
.m-lot.ft{ fill:var(--lot); stroke:var(--lot); }
.m-floor.ft{ fill:var(--floor); stroke:var(--floor-seam); stroke-width:.8; }
.m-conc.fl{ fill:var(--conc-l); stroke:var(--conc-l); }
.m-conc.fr{ fill:var(--conc-r); stroke:var(--conc-r); }
.m-conc.ft{ fill:var(--conc-t); stroke:var(--conc-t); }
.m-stair.fl{ fill:var(--stair-l); stroke:var(--stair-l); }
.m-stair.fr{ fill:var(--stair-r); stroke:var(--stair-r); }
.m-stair.ft{ fill:var(--stair-t); stroke:var(--stair-t); }
.m-col.fl{ fill:var(--col-l); stroke:var(--col-l); }
.m-col.fr{ fill:var(--col-r); stroke:var(--col-r); }
.m-col.ft{ fill:var(--col-t); stroke:var(--col-t); }
.m-rail.fl{ fill:var(--rail-l); stroke:var(--rail-l); stroke-width:.4; }
.m-rail.fr{ fill:var(--rail-r); stroke:var(--rail-r); stroke-width:.4; }
.m-rail.ft{ fill:var(--rail-t); stroke:var(--rail-t); stroke-width:.4; }
.m-brick.fl{ fill:var(--brick-l); stroke:var(--brick-l); }
.m-brick.fr{ fill:var(--brick-r); stroke:var(--brick-r); }
.m-lap.fl{ fill:var(--lap-l); stroke:var(--lap-l); }
.m-lap.fr{ fill:var(--lap-r); stroke:var(--lap-r); }
.m-vert.fl{ fill:var(--vert-l); stroke:var(--vert-l); }
.m-vert.fr{ fill:var(--vert-r); stroke:var(--vert-r); }
.m-board.fl{ fill:var(--board-l); stroke:var(--board-l); stroke-width:.4; }
.m-board.fr{ fill:var(--board-r); stroke:var(--board-r); stroke-width:.4; }
.m-board.ft{ fill:var(--board-t); stroke:var(--board-t); stroke-width:.4; }
.m-latt.fl{ fill:var(--latt-l); stroke:var(--latt-l); stroke-width:.4; }
.m-latt.fr{ fill:var(--latt-r); stroke:var(--latt-r); stroke-width:.4; }
.m-latt.ft{ fill:var(--latt-t); stroke:var(--latt-t); stroke-width:.4; }
.m-metal.fl{ fill:var(--metal-l); stroke:var(--metal-l); stroke-width:.4; }
.m-metal.fr{ fill:var(--metal-r); stroke:var(--metal-r); stroke-width:.4; }
.m-metal.ft{ fill:var(--metal-t); stroke:var(--metal-t); stroke-width:.4; }
.m-clay.fl{ fill:var(--clay-l); stroke:var(--clay-l); }  .m-clay.fr{ fill:var(--clay-r); stroke:var(--clay-r); }  .m-clay.ft{ fill:var(--clay-t); stroke:var(--clay-t); }
.m-rconc.fl{ fill:var(--rconc-l); stroke:var(--rconc-l); }  .m-rconc.fr{ fill:var(--rconc-r); stroke:var(--rconc-r); }  .m-rconc.ft{ fill:var(--rconc-t); stroke:var(--rconc-t); }
.m-rmetal.fl{ fill:var(--rmetal-l); stroke:var(--rmetal-l); }  .m-rmetal.fr{ fill:var(--rmetal-r); stroke:var(--rmetal-r); }  .m-rmetal.ft{ fill:var(--rmetal-t); stroke:var(--rmetal-t); }
.m-rend.fl{ fill:var(--wall-l); stroke:var(--wall-l); }  .m-rend.fr{ fill:var(--wall-r); stroke:var(--wall-r); }  .m-rend.ft{ fill:var(--wall-t); stroke:var(--wall-t); }
.iso-scene polygon.rf{ stroke:var(--roof-edge); stroke-width:.9; }
.pat-rclay{ stroke:var(--clay-line); stroke-width:.8; fill:none; }
.pat-rconc{ stroke:var(--rconc-line); stroke-width:.8; fill:none; }
.pat-rmetal{ stroke:var(--rmetal-line); stroke-width:.7; fill:none; }
.m-ctile.fl{ fill:var(--ctile-l); stroke:var(--ctile-l); }  .m-ctile.fr{ fill:var(--ctile-r); stroke:var(--ctile-r); }
.pat-ctile{ stroke:var(--ctile-line); stroke-width:.7; fill:none; }
.m-fwood.ft{ fill:var(--floor); stroke:var(--floor); }
.m-ftile.ft{ fill:var(--ftile); stroke:var(--ftile-line); stroke-width:.8; }
.m-fcarpet.ft{ fill:var(--carpet); stroke:var(--carpet); }
.pat-fwood{ stroke:var(--wood-line); stroke-width:.7; fill:none; }
.pat-ftile{ stroke:var(--ftile-line); stroke-width:.7; fill:none; }
.sel-floor{ fill:var(--slot-accent); opacity:.35; stroke:none; pointer-events:none; }
.hsel-floor{ fill:var(--slot-accent); opacity:.16; stroke:none; pointer-events:none; }
.marquee{ fill:var(--slot-accent); fill-opacity:.08; stroke:var(--slot-accent); stroke-width:1.5; stroke-dasharray:6 4; pointer-events:none; }
.m-water.ft{ fill:var(--water); stroke:var(--water); }
.m-pooltile.fl{ fill:var(--pooltile-l); stroke:var(--pooltile-l); }  .m-pooltile.fr{ fill:var(--pooltile-r); stroke:var(--pooltile-r); }
.m-coping.ft{ fill:var(--coping); stroke:var(--coping); }
.pat-water{ stroke:#fff; stroke-width:1.2; stroke-linecap:round; opacity:.55; fill:none; }
.m-furn.fl{ fill:var(--furn-l); stroke:var(--furn-l); stroke-width:.5; }  .m-furn.fr{ fill:var(--furn-r); stroke:var(--furn-r); stroke-width:.5; }  .m-furn.ft{ fill:var(--furn-t); stroke:var(--furn-t); stroke-width:.5; }
.m-linen.fl{ fill:var(--linen-l); stroke:var(--linen-l); stroke-width:.5; }  .m-linen.fr{ fill:var(--linen-r); stroke:var(--linen-r); stroke-width:.5; }  .m-linen.ft{ fill:var(--linen-t); stroke:var(--linen-t); stroke-width:.5; }
.m-duvet.fl{ fill:var(--duvet-l); stroke:var(--duvet-l); stroke-width:.5; }  .m-duvet.fr{ fill:var(--duvet-r); stroke:var(--duvet-r); stroke-width:.5; }  .m-duvet.ft{ fill:var(--duvet-t); stroke:var(--duvet-t); stroke-width:.5; }
.m-sofa.fl{ fill:var(--sofa-l); stroke:var(--sofa-l); stroke-width:.5; }  .m-sofa.fr{ fill:var(--sofa-r); stroke:var(--sofa-r); stroke-width:.5; }  .m-sofa.ft{ fill:var(--sofa-t); stroke:var(--sofa-t); stroke-width:.5; }
.m-cush.fl{ fill:var(--cush-l); stroke:var(--sofa-r); stroke-width:.5; }  .m-cush.fr{ fill:var(--cush-r); stroke:var(--sofa-r); stroke-width:.5; }  .m-cush.ft{ fill:var(--cush-t); stroke:var(--sofa-r); stroke-width:.5; }
.piece-svg{ display:inline-block; vertical-align:middle; }
.slot-badge .piece-svg{ width:19px; height:15px; }
.brush-emoji .piece-svg{ width:25px; height:20px; display:block; }
.m-appdark.fl, .m-appdark.ft{ fill:var(--appdark); stroke:var(--appdark); stroke-width:.4; }  .m-appdark.fr{ fill:var(--appdark-r); stroke:var(--appdark-r); stroke-width:.4; }
.m-tvbody.fl, .m-tvbody.ft{ fill:var(--tv); stroke:var(--tv); stroke-width:.4; }  .m-tvbody.fr{ fill:var(--appdark-r); stroke:var(--appdark-r); stroke-width:.4; }
.m-appl.fl{ fill:var(--appl-l); stroke:var(--appl-r); stroke-width:.5; }  .m-appl.fr{ fill:var(--appl-r); stroke:var(--appl-r); stroke-width:.5; }  .m-appl.ft{ fill:var(--appl-t); stroke:var(--appl-r); stroke-width:.5; }
.m-lampbase{ fill:var(--lampbase); stroke:var(--lampbase); stroke-width:.4; }
.m-shade.fl{ fill:var(--shade-l); stroke:var(--shade-r); stroke-width:.4; }  .m-shade.fr{ fill:var(--shade-r); stroke:var(--shade-r); stroke-width:.4; }  .m-shade.ft{ fill:var(--shade-t); stroke:var(--shade-r); stroke-width:.4; }
.m-cab.fl{ fill:var(--cab-l); stroke:var(--cab-l); stroke-width:.5; }  .m-cab.fr{ fill:var(--cab-r); stroke:var(--cab-r); stroke-width:.5; }  .m-cab.ft{ fill:var(--cab-l); stroke:var(--cab-l); }
.m-stone.fl{ fill:var(--stone-l); stroke:var(--stone-l); stroke-width:.5; }  .m-stone.fr{ fill:var(--stone-r); stroke:var(--stone-r); stroke-width:.5; }  .m-stone.ft{ fill:var(--stone-t); stroke:var(--stone-t); stroke-width:.5; }
.m-cooktop.fl, .m-cooktop.ft{ fill:#1b1d20; stroke:#3a3e43; stroke-width:.5; }  .m-cooktop.fr{ fill:#121315; stroke:#3a3e43; stroke-width:.5; }
.m-steel.fl{ fill:#d3d9dd; stroke:#9aa2a8; stroke-width:.5; }  .m-steel.fr{ fill:#b0b8be; stroke:#9aa2a8; stroke-width:.5; }  .m-steel.ft{ fill:#e3e8eb; stroke:#9aa2a8; stroke-width:.5; }
.burner{ fill:none; stroke:#8b9096; stroke-width:1.2; }
.burner-in{ fill:#3a2a26; stroke:none; }
.basin{ fill:#8f989f; stroke:#6f777d; stroke-width:.8; }
.m-porc.fl{ fill:#f7f8f9; stroke:#c9d0d5; stroke-width:.6; }  .m-porc.fr{ fill:#dde2e6; stroke:#c9d0d5; stroke-width:.6; }  .m-porc.ft{ fill:#ffffff; stroke:#c9d0d5; stroke-width:.6; }
html[data-theme="dark"] .m-porc.fl{ fill:#cfd3d6; }  html[data-theme="dark"] .m-porc.fr{ fill:#b2b7bb; }  html[data-theme="dark"] .m-porc.ft{ fill:#dde1e4; }
.m-hot{ fill:#d9534f; stroke:#a33a37; stroke-width:.5; }  .m-cold{ fill:#3d7fd9; stroke:#2c5fa3; stroke-width:.5; }
.seat{ fill:#ffffff; stroke:#b9c1c7; stroke-width:1; }  .seat-in{ fill:#bfd9e6; stroke:#9fb3bf; stroke-width:.6; }
.tubin{ fill:#e4edf2; stroke:#c3cfd6; stroke-width:.8; }
.m-office.fl{ fill:#3e434a; stroke:#2a2e33; stroke-width:.5; }  .m-office.fr{ fill:#2e3237; stroke:#2a2e33; stroke-width:.5; }  .m-office.ft{ fill:#4c525a; stroke:#2a2e33; stroke-width:.5; }
.m-speaker.fl{ fill:#5a3f2e; stroke:#3d2a1e; stroke-width:.5; }  .m-speaker.fr{ fill:#46301f; stroke:#3d2a1e; stroke-width:.5; }  .m-speaker.ft{ fill:#6a4b37; stroke:#3d2a1e; stroke-width:.5; }
.m-silver.fl{ fill:#cdd2d6; stroke:#9aa1a7; stroke-width:.5; }  .m-silver.fr{ fill:#aeb4b9; stroke:#9aa1a7; stroke-width:.5; }  .m-silver.ft{ fill:#dfe3e6; stroke:#9aa1a7; stroke-width:.5; }
.m-rug{ fill:#a8443a; stroke:#7e2f27; stroke-width:.8; }  .m-rug.ft{ fill:#a8443a; }
.rug-border{ fill:none; stroke:#e9c98f; stroke-width:1.6; }  .rug-mid{ fill:#2f4f6e; stroke:#e9c98f; stroke-width:1; }
.deco-mirror{ fill:#cfe2ea; stroke:#ffffff; stroke-width:1; }
.deco-groove{ fill:#0e0f11; stroke:none; }  .deco-btn{ fill:#3d7fd9; stroke:none; }
.deco-display{ fill:#2fd0c0; stroke:#0b3b37; stroke-width:.5; }  .deco-knob{ fill:#8a9096; stroke:none; }
.deco-cone{ fill:#141517; stroke:#6c7176; stroke-width:.8; }
.deco-keys{ fill:#2c3035; stroke:none; }
.m-pot.fl{ fill:#bf6a43; stroke:#8e4a2c; stroke-width:.5; }  .m-pot.fr{ fill:#9c5333; stroke:#8e4a2c; stroke-width:.5; }  .m-pot.ft{ fill:#5a3d2b; stroke:#8e4a2c; stroke-width:.5; }
.m-leaf.fl{ fill:#5f9e4c; stroke:#3f7231; stroke-width:.5; }  .m-leaf.fr{ fill:#4a813a; stroke:#3f7231; stroke-width:.5; }  .m-leaf.ft{ fill:#76b762; stroke:#3f7231; stroke-width:.5; }
.m-potrim.fr{ fill:#b05f3b; stroke:#8e4a2c; stroke-width:.5; }  .m-potrim.ft{ fill:#4a3222; stroke:#8e4a2c; stroke-width:.6; }
.plant-vein{ stroke:#3f7231; stroke-width:.6; fill:none; opacity:.55; }
.m-pages.fl, .m-pages.fr, .m-pages.ft{ fill:#f4efe2; stroke:#d6ceba; stroke-width:.4; }
.m-bk1.fl, .m-bk1.ft{ fill:#b83c3c; stroke:#7f2626; stroke-width:.4; }  .m-bk1.fr{ fill:#962f2f; stroke:#7f2626; stroke-width:.4; }
.m-bk2.fl, .m-bk2.ft{ fill:#3463a3; stroke:#21436f; stroke-width:.4; }  .m-bk2.fr{ fill:#284f84; stroke:#21436f; stroke-width:.4; }
.m-bk3.fl, .m-bk3.ft{ fill:#3f8a4f; stroke:#285c33; stroke-width:.4; }  .m-bk3.fr{ fill:#326f3f; stroke:#285c33; stroke-width:.4; }
.m-bk4.fl, .m-bk4.ft{ fill:#cfa62b; stroke:#8f711b; stroke-width:.4; }  .m-bk4.fr{ fill:#a9871f; stroke:#8f711b; stroke-width:.4; }
.deco-spine{ fill:rgba(255,255,255,.75); stroke:none; }
.stair-rail{ stroke:#5b4128; stroke-width:2.2; stroke-linecap:round; fill:none; }
html[data-theme="dark"] .stair-rail{ stroke:#c9a77e; }
.it.ghost .stair-rail{ opacity:.6; }  .it.gone .stair-rail{ stroke:var(--gone); }
.m-fridge.fl{ fill:#e7ebed; stroke:#c3c9cc; stroke-width:.5; }  .m-fridge.fr{ fill:#ccd2d5; stroke:#c3c9cc; stroke-width:.5; }  .m-fridge.ft{ fill:#f4f6f7; stroke:#c3c9cc; stroke-width:.5; }
.m-utility.fl{ fill:#dfe3e5; stroke:#b7bdc1; stroke-width:.5; }  .m-utility.fr{ fill:#c2c8cb; stroke:#b7bdc1; stroke-width:.5; }  .m-utility.ft{ fill:#eef1f2; stroke:#b7bdc1; stroke-width:.5; }
.m-tank.fl{ fill:#cfd5d8; stroke:#a8afb3; stroke-width:.5; }  .m-tank.fr{ fill:#b2b9bd; stroke:#a8afb3; stroke-width:.5; }  .m-tank.ft{ fill:#dde2e4; stroke:#a8afb3; stroke-width:.5; }
.deco-porthole{ fill:#2a3034; stroke:#8b9196; stroke-width:1.1; }  .deco-porthole-in{ fill:#44525c; stroke:none; }
.deco-vent{ stroke:#7b8389; stroke-width:1; fill:none; }
.deco-led{ fill:#3dd16a; stroke:none; }
.deco-gauge{ fill:#eceff1; stroke:#7b8389; stroke-width:1; }  .deco-needle{ stroke:#b8443a; stroke-width:1; }
.deco-fanring{ fill:none; stroke:#7b8389; stroke-width:1.3; }  .deco-fanblade{ fill:#9aa0a5; stroke:none; }
.m-cushion.fl{ fill:var(--cushion-l); stroke:var(--cushion-r); stroke-width:.5; }  .m-cushion.fr{ fill:var(--cushion-r); stroke:var(--cushion-r); stroke-width:.5; }  .m-cushion.ft{ fill:var(--cushion-t); stroke:var(--cushion-r); stroke-width:.5; }
.deco-ovenwin{ fill:#1c2024; stroke:#8b9196; stroke-width:1; }
.deco-fold{ stroke:rgba(0,0,0,.18); stroke-width:1; fill:none; }
.deco-screen{ fill:#22394f; stroke:#0f1215; stroke-width:.6; }
.deco-shine{ stroke:rgba(255,255,255,.28); stroke-width:3; fill:none; stroke-linecap:round; }
.deco-mwwin{ fill:#2a3138; stroke:#9aa0a5; stroke-width:.6; }
.deco-mwpad{ fill:#5d656c; stroke:none; }
.deco-cabdoor{ fill:none; stroke:var(--cab-line); stroke-width:.8; }
.deco-handle{ stroke:#7b8085; stroke-width:1.6; stroke-linecap:round; fill:none; }
.m-mesh{ fill:var(--mesh); stroke:none; }
.m-none{ fill:none; stroke:none; }
.pat-brick{ stroke:var(--mortar); stroke-width:.8; fill:none; }
.pat-lap{ stroke:var(--lap-line); stroke-width:1; fill:none; }
.pat-vert{ stroke:var(--vert-line); stroke-width:.9; fill:none; }
.pat-board{ stroke:var(--board-line); stroke-width:.7; fill:none; }
.deco-glass{ fill:var(--glass); stroke:var(--glass-edge); stroke-width:1; }
.deco-roundglass{ fill:var(--glass); stroke:var(--glass-edge); stroke-width:1.8; }
.deco-frame{ stroke:var(--glass-edge); stroke-width:1.3; fill:none; }
.deco-louver{ stroke:var(--door-t); stroke-width:.9; fill:none; }
.deco-latt{ stroke:var(--latt-r); stroke-width:1.4; fill:none; }
.deco-chain{ stroke:var(--mesh-line); stroke-width:.5; fill:none; }
.cylbody{ stroke:none; }
.it.gone path{ stroke:var(--gone) !important; }
.it.gone ellipse, .it.gone .cylbody{ fill:var(--gone) !important; }
.it.sel{ filter:drop-shadow(0 0 1.5px var(--slot-accent)) drop-shadow(0 0 3px var(--slot-accent)); }
.it.hsel{ filter:drop-shadow(0 0 2px var(--slot-accent)); }
.roof-handle{ fill:#fff; stroke:var(--slot-accent); stroke-width:2; pointer-events:none; }
.sel-side{ stroke:var(--slot-accent); stroke-width:5; stroke-linecap:round; fill:none; opacity:.9; pointer-events:none; }
.m-grass.ft{ fill:var(--grass); stroke:var(--grass); }
.m-deck.ft{ fill:var(--deck); stroke:var(--deck-seam); stroke-width:.8; }
.air-line{ stroke:var(--slot-accent); stroke-width:1; stroke-dasharray:4 5; fill:none; opacity:.3; }
.air-edge{ stroke:var(--slot-accent); stroke-width:1.4; fill:none; opacity:.55; }
.m-wall.fl, .m-post.fl{ fill:var(--wall-l); stroke:var(--wall-l); }
.m-wall.fr, .m-post.fr{ fill:var(--wall-r); stroke:var(--wall-r); }
.m-wall.ft, .m-post.ft{ fill:var(--wall-t); stroke:var(--wall-t); }
.m-door.fl{ fill:var(--door-l); stroke:var(--door-l); }
.m-door.fr{ fill:var(--door-r); stroke:var(--door-r); }
.m-door.ft{ fill:var(--door-t); stroke:var(--door-t); }
.m-sill{ fill:var(--sill-t); stroke:var(--sill-t); }
.m-glass{ fill:var(--glass); stroke:var(--glass-edge) !important; stroke-width:1 !important; }
.m-winlow.fl{ fill:var(--wall-l); stroke:var(--wall-l); }
.m-winlow.fr{ fill:var(--wall-r); stroke:var(--wall-r); }
.m-winlow.ft{ fill:var(--winlow-t); stroke:var(--winlow-t); }
.it.ghost{ opacity:.55; }
.it.gone polygon{ fill:var(--gone) !important; stroke:var(--gone) !important; }
.it.gone{ opacity:.7; }
.hov{ fill:none; stroke:var(--slot-accent); stroke-width:5; stroke-linecap:round; opacity:.85; pointer-events:none; }
.hov.erase{ stroke:var(--gone); }

/* blueprint scene */
.bp-bg{ fill:var(--bp-bg); }
.bp-grid{ stroke:var(--bp-grid); stroke-width:1; fill:none; }
.bp-lot{ stroke:var(--bp-lot); stroke-width:1.2; stroke-dasharray:6 5; fill:none; }
.bp-room{ fill:var(--bp-room); }
.bp-garden{ fill:rgba(126,217,140,.22); }
.bp-balcony{ fill:rgba(255,255,255,.13); }
.bp-lap{ stroke:var(--bp-ink); stroke-width:1.2; fill:none; }
.bp-vert{ stroke:var(--bp-ink); stroke-width:1.2; fill:none; stroke-dasharray:3 2; }
.bp-brick{ fill:url(#bpHatch); stroke:var(--bp-ink); stroke-width:.6; }
.bp-dash{ stroke-dasharray:4 3; }
.bp-fboard{ fill:var(--bp-ink); stroke:none; }
.bp-chain{ stroke:var(--bp-ink); stroke-width:1.1; stroke-dasharray:2 3; fill:none; }
.bp-latt{ stroke:var(--bp-ink); stroke-width:.8; fill:none; }
.bp-sel{ stroke:var(--bp-hi); stroke-width:11; stroke-linecap:round; opacity:.4; fill:none; pointer-events:none; }
.bp-hsel{ stroke:var(--bp-hi); stroke-width:8; stroke-linecap:round; opacity:.25; fill:none; pointer-events:none; }
.bp-selside{ fill:var(--bp-hi); opacity:.9; pointer-events:none; }
.bp-selring{ fill:none; stroke:var(--bp-hi); stroke-width:2.2; pointer-events:none; }
.bp-roof{ fill:none; stroke:var(--bp-ink); stroke-width:1.4; stroke-dasharray:8 5; }
.bp-ridge{ fill:none; stroke:var(--bp-ink); stroke-width:1.4; }
.bp-rooftxt{ fill:var(--bp-text); font-family:var(--font-sans); font-weight:600; opacity:.85; }
.bp.ghost .bp-roof, .bp.ghost .bp-ridge{ stroke:var(--bp-hi); }
.bp.gone .bp-roof, .bp.gone .bp-ridge{ stroke:var(--bp-gone); }
.bp-handle{ fill:var(--bp-bg); stroke:var(--bp-hi); stroke-width:2; pointer-events:none; }
.bp-ctile{ stroke:var(--bp-ink); stroke-width:1.2; fill:none; stroke-dasharray:1.5 2.5; }
.bp-fpat{ pointer-events:none; }
.bp-selfloor{ fill:var(--bp-hi); opacity:.35; pointer-events:none; }
.bp-hselfloor{ fill:var(--bp-hi); opacity:.15; pointer-events:none; }
.bp-marquee{ fill:var(--bp-hi); fill-opacity:.08; stroke:var(--bp-hi); stroke-width:1.5; stroke-dasharray:6 4; pointer-events:none; }
.bp-pool{ fill:rgba(125,205,255,.35); stroke:var(--bp-ink); stroke-width:1.6; }
.bp-poolin{ fill:none; stroke:var(--bp-ink); stroke-width:.8; opacity:.7; }
.bp-wave{ fill:none; stroke:var(--bp-ink); stroke-width:1; opacity:.55; }
.bp-blocked{ fill:url(#bpHatch); fill-opacity:.5; stroke:var(--bp-ink); stroke-width:1.2; stroke-dasharray:6 4; opacity:.75; }
.bp.ghost .bp-pool{ stroke:var(--bp-hi); fill:rgba(255,209,102,.25); }
.bp.gone .bp-pool{ stroke:var(--bp-gone); fill:rgba(255,138,128,.25); }
.bp-furn{ fill:rgba(255,255,255,.08); stroke:var(--bp-ink); stroke-width:1.2; }
.bp-furnline{ fill:none; stroke:var(--bp-ink); stroke-width:2.4; stroke-linecap:round; }
.bp-furnthin{ fill:none; stroke:var(--bp-ink); stroke-width:.9; }
.bp.ghost .bp-furn, .bp.ghost .bp-furnline, .bp.ghost .bp-furnthin{ stroke:var(--bp-hi); }
.bp.gone .bp-furn, .bp.gone .bp-furnline, .bp.gone .bp-furnthin{ stroke:var(--bp-gone); }
.bp-appl{ fill:rgba(255,255,255,.12); stroke:var(--bp-ink); stroke-width:1; }
.bp.ghost .bp-appl{ stroke:var(--bp-hi); }  .bp.gone .bp-appl{ stroke:var(--bp-gone); }
.bp-closed{ fill:var(--bp-ink); stroke:none; }
.bp.ghost .bp-closed{ fill:var(--bp-hi); }  .bp.gone .bp-closed{ fill:var(--bp-gone); }
.bp-fence{ fill:none; stroke:var(--bp-ink); stroke-width:1; }
.bp-fpost{ fill:var(--bp-ink); }
.bp-areaname{ fill:var(--bp-text); font-family:var(--font-sans); font-weight:600; opacity:.85; }
.bp.ghost .bp-fence{ stroke:var(--bp-hi); }  .bp.ghost .bp-fpost{ fill:var(--bp-hi); }
.bp.gone .bp-fence{ stroke:var(--bp-gone); }  .bp.gone .bp-fpost{ fill:var(--bp-gone); }
.bp-area{ fill:var(--bp-text); font-family:var(--font-sans); font-weight:600; letter-spacing:.02em; }
.bp-dim{ stroke:var(--bp-text); stroke-width:1; fill:none; opacity:.75; }
.bp-dimtxt{ fill:var(--bp-text); font-family:var(--font-sans); opacity:.85; }
.bp-wall{ fill:var(--bp-ink); stroke:var(--bp-ink); stroke-width:.6; }
.bp-win{ fill:var(--bp-bg); stroke:var(--bp-ink); stroke-width:1.3; }
.bp-glass{ stroke:var(--bp-glass); stroke-width:1.6; fill:none; }
.bp-leaf{ stroke:var(--bp-ink); stroke-width:2.2; stroke-linecap:round; fill:none; }
.bp-swing{ stroke:var(--bp-ink); stroke-width:1; stroke-dasharray:4 3; fill:none; opacity:.8; }
.bp-mark{ fill:none; stroke:var(--bp-hi); stroke-width:1.6; }
.bp-markfill{ fill:var(--bp-hi); }
.bp.ghost{ opacity:.6; }
.bp.ghost .bp-wall{ fill:var(--bp-hi); stroke:var(--bp-hi); }
.bp.ghost .bp-win, .bp.ghost .bp-leaf, .bp.ghost .bp-swing{ stroke:var(--bp-hi); }
.bp.gone .bp-wall{ fill:var(--bp-gone); stroke:var(--bp-gone); }
.bp.gone .bp-win, .bp.gone .bp-leaf, .bp.gone .bp-swing, .bp.gone .bp-glass{ stroke:var(--bp-gone); }
.bp.below{ opacity:.26; }
.bp-col{ fill:var(--bp-ink); stroke:var(--bp-ink); stroke-width:.6; }
.bp-colx{ stroke:var(--bp-bg); stroke-width:1.2; fill:none; }
.bp.ghost .bp-col{ fill:var(--bp-hi); stroke:var(--bp-hi); }
.bp.gone .bp-col{ fill:var(--bp-gone); stroke:var(--bp-gone); }
.bp-stair{ fill:none; stroke:var(--bp-ink); stroke-width:1.3; }
.bp-tread{ stroke:var(--bp-ink); stroke-width:.8; opacity:.75; fill:none; }
.bp-arrow{ stroke:var(--bp-ink); stroke-width:1.4; fill:none; }
.bp-arrowhead{ fill:var(--bp-ink); }
.bp-hole{ fill:none; stroke:var(--bp-ink); stroke-width:1.2; stroke-dasharray:6 4; }
.bp-stairtxt{ fill:var(--bp-ink); font-family:var(--font-sans); font-weight:700; paint-order:stroke; stroke:var(--bp-bg); stroke-width:3px; }
.bp.ghost .bp-stair, .bp.ghost .bp-tread, .bp.ghost .bp-arrow{ stroke:var(--bp-hi); }
.bp.ghost .bp-arrowhead, .bp.ghost .bp-stairtxt{ fill:var(--bp-hi); }
.bp.gone .bp-stair, .bp.gone .bp-tread, .bp.gone .bp-arrow{ stroke:var(--bp-gone); }
.bp.gone .bp-arrowhead, .bp.gone .bp-stairtxt{ fill:var(--bp-gone); }
.bp-hov{ fill:none; stroke:var(--bp-hi); stroke-width:6; stroke-linecap:round; opacity:.8; pointer-events:none; }
.bp-hov.erase{ stroke:var(--bp-gone); }
`;
  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function create(opts) {
    injectStyles();
    // overlays the builder adds on top of a render; none by default
    const hooks = Object.assign({
      showHandles: () => false,
      selKeys: () => new Set(),
      selKey: () => null,
      selectedSide: () => null,
      setViewBox: () => {}
    }, opts || {});

    // everything the engine and a page both read and write
    const state = {
    COLS: 12,
    ROWS: 10,
    furnDir: 0,
    applDir: 0,
    floors: {},
    level: 0,
    currentTool: 'build',
    viewMode: 'both',
    rot: 0,
    wallsDown: false,
    showSlabs: true,
    showCeiling: false,
    showRoofs: true,
    cutout: false,
    roofHits: [],
    pending: null,
    hover: null,
    hoverPending: null,
    drag: null,
    keepAmount: 0.5,
    selection: null,
    hoverTarget: null,
    marquee: null
    };

  
    /* ═══════════════ WORLD MODEL ═══════════════
       One grid square = 1 metre. Walls, doors and windows live on the
       grid LINES, not in the squares (like a real floor plan):
         h:r:c  — the line from corner (c, r) to (c+1, r)
         v:r:c  — the line from corner (c, r) to (c, r+1)
       A value is { type:'wall' } | { type:'window' } | { type:'fence' } |
       { type:'door', swing, closed? }. Fences don't make rooms indoors.
       swing bit 0 = hinge at the far end of the line, bit 1 = opens toward
       the negative side (up for h-lines, left for v-lines).
  
       The house has storeys (levels) -1 (basement) … 2 (second floor).
       Each level holds its own edge map and a list of stairs. A flight of
       stairs (see STAIRS below) start on a square and climb to the next level,
       where they leave a hole in that level's floor.
  
       Columns sit on grid corners or in the middle of a square. They are
       stored in half-metre units ("X,Y" with X = 2x, Y = 2y), so a corner
       has even X and Y and a square's middle has odd X and Y. */
    /* (moved to S) */
    const MIN_SIZE = 3, MAX_SIZE = 24;
  
    const LEVELS = [-1, 0, 1, 2];
    const MIN_LEVEL = -1, MAX_LEVEL = 2;
    const LEVEL_INFO = {
      '-1': { short: 'B', tag: 'B1F', name: 'Basement' },
      '0':  { short: 'G', tag: 'GF',  name: 'Ground floor' },
      '1':  { short: '1', tag: '1F',  name: 'First floor' },
      '2':  { short: '2', tag: '2F',  name: 'Second floor' }
    };
  
    const T = 0.16;          // wall thickness (m)
    const WALL_H = 2.5;      // full wall height
    const FLOOR_T = 0.3;     // floor slab between storeys
    const LEVEL_H = WALL_H + FLOOR_T;   // one storey, floor to floor
    const DOOR_H = 2.1;
    const SILL_H = 0.9, WIN_TOP = 2.1;
    const SLAB = 0.22;       // ground plate under the lot when there is no basement
    const COL_W = 2 * T;     // column: twice as thick as a wall
    const FENCE_H = 1.0, FENCE_T = 0.08, FPOST = 0.1;   // fence / handrail: height, rail thickness, post
    const SI = 0.1;          // stairs: inset of the flights from the grid lines
    const DIRV = [[-1, 0], [0, 1], [1, 0], [0, -1]];   // N E S W as [dr, dc]
    const baseZ = L => L * LEVEL_H;
  
    // Dimetric projection with a 2:1 pixel ratio: the ground axes run at
    // atan(1/2) ≈ 26.57° from horizontal, so they meet at 126.87° and each
    // meets the vertical at 116.57°. One metre along a ground axis is
    // (±32, 16) px; vertical scale matches the same camera (cos 30°).
    const HW = 32, HH = 16;
    const ZS = HW * Math.SQRT2 * Math.cos(Math.PI / 6);   // ≈ 39.19 px per metre up
  
    const PX = 40;           // floor plan: px per metre
    const PM = 1.35;         // floor plan: margin around the lot (m)
  
    const PIECES = {
      wall:   { emoji: '🧱', word: 'Wall',   hint: 'Drag along the grid lines to draw walls. Tap a line to add one piece. Tap a door or window to turn it back into wall.' },
      door:   { emoji: '🚪', word: 'Door',   hint: 'Tap a line to add a door. Tap a door again to change which way it opens. After the fourth way, the next tap closes it.' },
      window: { emoji: '🪟', word: 'Window', hint: 'Tap a line to add a window, or drag along a line to add a row of windows.' },
      gate:   { emoji: '', word: 'Gate', hint: 'Tap a fence to put a gate in it (it takes the fence’s style), or tap an empty line for a gate on its own. Tap a gate to open it, then again to change which way it opens; after the fourth way it closes.' },
      fence:  { emoji: '🚧', word: 'Fence',  hint: 'Drag along the grid lines to build a fence or handrail. A space closed in by fences is a garden on the ground floor and a balcony on upper floors.' },
      column: { emoji: '🪵', word: 'Column', hint: 'Tap a grid corner or the middle of a square to add a column. Walls meet a corner column neatly.' },
      table:  { emoji: '🍽️', word: 'Table', hint: 'Tap a grid corner or the middle of a square to put a table there (1.2 × 0.8 m). Tap it again to turn it, or press R before you tap. Drag it to move it.' },
      chair:  { emoji: '🪑', word: 'Chair', hint: 'Tap a grid corner or the middle of a square to put a chair there. Tap it again to turn it (the back goes round), or press R before you tap. Drag it to move it.' },
      bed:    { emoji: '🛏️', word: 'Bed',   hint: 'Tap a grid corner or the middle of a square to put a double bed there (1.4 × 2 m). Tap it again to turn it, or press R before you tap. Drag it to move it.' },
      armchair: { emoji: '', word: 'Armchair', hint: 'Tap a grid corner or the middle of a square to put an armchair there. Tap it again to turn it (the back goes round), or press R before you tap. Drag it to move it.' },
      loveseat: { emoji: '', word: 'Loveseat', hint: 'Tap a grid corner or the middle of a square to put a two-seat loveseat there (1.5 m). Tap it again to turn it, or press R before you tap. Drag it to move it.' },
      couch:    { emoji: '', word: 'Couch',    hint: 'Tap a grid corner or the middle of a square to put a three-seat couch there (2.1 m). Tap it again to turn it, or press R before you tap. Drag it to move it.' },
      bookshelf:  { emoji: '📚', word: 'Bookshelf', hint: 'Tap a grid corner or the middle of a square to put a bookshelf there. It has three levels for appliances: two inside and the top. Tap it again to turn it. Drag it to move it.' },
      wallshelf:  { emoji: '', word: 'Wall shelf', hint: 'Tap a wall, on the side you want, to hang a shelf on it (1.2 m up). Tap the shelf again to move it to the other side of the wall. Drag it to another wall.' },
      countertop: { emoji: '', word: 'Countertop', hint: 'Drag along the grid lines, on the side you want, to build a run of kitchen counter (0.6 m deep), like a wall. Tap a line for one piece; drag on from the end of a counter to make it longer. Tap a piece to flip it to the other side of its line.' },
      officechair: { emoji: '', word: 'Office chair', hint: 'Tap a grid corner or the middle of a square to put an office chair there. A chair (any kind) can hold one appliance on its seat. Tap it again to turn it. Drag it to move it.' },
      tvstand:   { emoji: '', word: 'TV stand', hint: 'Tap a grid corner or the middle of a square to put a TV stand there (1.2 m). It has a shelf inside and a top for a television. Tap it again to turn it. Drag it to move it.' },
      dresser:   { emoji: '', word: 'Dresser', hint: 'Tap a grid corner or the middle of a square to put a chest of drawers there (1 m wide). Its top takes appliances and objects. Tap it again to turn it. Drag it to move it.' },
      wardrobe:  { emoji: '', word: 'Wardrobe', hint: 'Tap a grid corner or the middle of a square to put a tall two-door wardrobe there (1 × 0.6 m, 2 m high). Tap it again to turn it. Drag it to move it.' },
      sidetable: { emoji: '', word: 'Side table', hint: 'Tap a grid corner or the middle of a square to put a small side table (an end table, 0.5 m) there — next to a sofa or an armchair. Its top takes appliances and objects, like a lamp or books, and small things fit under it. Tap it again to turn it. Drag it to move it.' },
      nightstand: { emoji: '', word: 'Nightstand', hint: 'Tap a grid corner or the middle of a square to put a nightstand with two drawers there. Its top takes an appliance, like a lamp. Tap it again to turn it. Drag it to move it.' },
      mirrorcab: { emoji: '🪞', word: 'Mirror cabinet', hint: 'Tap a wall, on the side you want, to hang a bathroom cabinet with a mirror door on it. It can go over a washbasin. Tap it again to move it to the other side of the wall.' },
      acwindow:  { emoji: '', word: 'Window air conditioner', hint: 'Tap a wall, on the side you want, to fit a window-type air conditioner into it. Tap it again to move it to the other side of the wall.' },
      acsplit:   { emoji: '', word: 'Split air conditioner (evaporator)', hint: 'Tap a wall, on the side you want, to mount a split air conditioner\'s indoor unit near the ceiling. Tap it again to move it to the other side of the wall.' },
      accondenser: { emoji: '', word: 'Split air conditioner (condenser)', hint: 'Tap a wall, on the side you want, to mount the outdoor condenser unit low on it, on its bracket. Tap it again to move it to the other side of the wall.' },
      exhaustfan:{ emoji: '', word: 'Exhaust fan', hint: 'Tap a wall, on the side you want, to mount an exhaust fan near the ceiling. Tap it again to move it to the other side of the wall.' },
      radiator:  { emoji: '', word: 'Heating radiator', hint: 'Tap a wall, on the side you want, to mount a heating radiator near the floor. Tap it again to move it to the other side of the wall.' },
      wallcabinet: { emoji: '', word: 'Wall cabinet', hint: 'Tap a wall, on the side you want, to hang an upper kitchen cabinet on it, with the same doors as a countertop. Tap it again to move it to the other side of the wall.' },
      monitor:   { emoji: '🖥️', word: 'Monitor', hint: 'A computer screen (a smaller television). Tap the floor or a level of a piece of furniture. Tap it again to turn it. Drag it to move it.' },
      console:   { emoji: '🎮', word: 'Game console', hint: 'A games console lying flat. Tap the floor or a level of a piece of furniture — it fits inside a TV stand. Tap it again to turn it. Drag it to move it.' },
      stereo:    { emoji: '', word: 'Stereo', hint: 'A stereo with a speaker on each side (0.9 m wide). Tap the floor or a wide enough level. Tap it again to turn it. Drag it to move it.' },
      laptop:    { emoji: '💻', word: 'Laptop', hint: 'Tap a table, a desk, a chair or the floor. Tap it again to turn it. Drag it to move it.' },
      desktop:   { emoji: '', word: 'Computer case', hint: 'A desktop computer tower. Tap the floor or a level of a piece of furniture where it fits. Tap it again to turn it. Drag it to move it.' },
      planter:   { emoji: '🪴', word: 'Planter', hint: 'A small plant in a pot. Tap the floor, a level of a piece of furniture, a seat, or under a table or chair. Tap it again to turn it. Drag it to move it.' },
      book:      { emoji: '📕', word: 'Book', hint: 'One book lying flat. Tap the floor, a shelf, a table, a seat — or under a table or chair ("the book is under the table"). Tap it again to turn it. Drag it to move it.' },
      books:     { emoji: '', word: 'Books', hint: 'Four books standing in a row. Tap the floor, a shelf, a table, a seat, or under a table or chair. Tap it again to turn it. Drag it to move it.' },
      fridge:      { emoji: '', word: 'Refrigerator', hint: 'A tall refrigerator-freezer. Tap the floor. Tap it again to turn it. Drag it to move it.' },
      freezer:     { emoji: '', word: 'Chest freezer', hint: 'A chest freezer with a lift-up lid. Tap the floor. Tap it again to turn it. Drag it to move it.' },
      washer:      { emoji: '', word: 'Washing machine', hint: 'A front-loading washing machine. Tap the floor. Tap it again to turn it. Drag it to move it.' },
      dryer:       { emoji: '', word: 'Clothes dryer', hint: 'A front-loading clothes dryer. Tap the floor. Tap it again to turn it. Drag it to move it.' },
      washdryer:   { emoji: '', word: 'Washer-dryer', hint: 'An over-under washer and dryer, stacked. Tap the floor. Tap it again to turn it. Drag it to move it.' },
      watertank:   { emoji: '', word: 'Water tank', hint: 'A water tank with a pump beside it. Tap the floor. Tap it again to turn it. Drag it to move it.' },
      waterheater: { emoji: '', word: 'Water heater (tankless)', hint: 'Tap a wall, on the side you want, to mount a tankless electric water heater on it, with its hot and cold valves. Tap it again to move it to the other side of the wall.' },
      rug:       { emoji: '', word: 'Rug', hint: 'A 2 × 1.4 m rug on the floor. It can go under furniture, but not under walls. Tap it again to turn it. Drag it to move it.' },
      cushion:   { emoji: '', word: 'Cushion', hint: 'A throw pillow for a chair, armchair, loveseat or couch seat. Tap the seat. Tap it again to turn it. Drag it to move it.' },
      toilet:    { emoji: '🚽', word: 'Toilet', hint: 'Tap a grid corner or the middle of a square to put a toilet there, tank at the back. Tap it again to turn it, or press R before you tap. Drag it to move it.' },
      washbasin: { emoji: '', word: 'Washbasin', hint: 'Tap a grid corner or the middle of a square to put a washbasin on a pedestal there, tap at the back. Tap it again to turn it. Drag it to move it.' },
      bathtub:   { emoji: '🛁', word: 'Bathtub', hint: 'Tap a grid corner or the middle of a square to put a bathtub there (0.75 × 1.7 m), taps at the back end. Tap it again to turn it. Drag it to move it.' },
      shower:    { emoji: '🚿', word: 'Shower', hint: 'Tap a wall, on the side you want, to put a shower on it: a hot and a cold valve and the shower head. It can go over a bathtub. Tap it again to move it to the other side of the wall.' },
      tv:        { emoji: '📺', word: 'Television', hint: 'Tap the floor, or the top of a piece of furniture — a television is too big for the inside levels of a bookshelf. Tap it again to turn it. Drag it to move it.' },
      lamp:      { emoji: '', word: 'Table lamp', hint: 'Tap the floor, or a level of a table, bookshelf, shelf or countertop. Each level takes one appliance in the middle or two side by side. Tap it again to turn it. Drag it to move it.' },
      standlamp: { emoji: '', word: 'Stand lamp', hint: 'A tall floor lamp. Tap the floor. Tap it again to turn it. Drag it to move it.' },
      oven:      { emoji: '', word: 'Oven', hint: 'A free-standing oven, with a window and control dials. Tap the floor. Tap it again to turn it. Drag it to move it.' },
      toaster:   { emoji: '', word: 'Toaster', hint: 'Tap a level of a countertop, table or similar surface where it fits — or the floor. Tap it again to turn it. Drag it to move it.' },
      blender:   { emoji: '', word: 'Blender', hint: 'Tap a level of a countertop, table or similar surface where it fits — or the floor. Tap it again to turn it. Drag it to move it.' },
      stove:     { emoji: '', word: 'Stove', hint: 'A cooktop with four burners. It only goes on a countertop: tap one. Tap it again to turn it. Drag it to move it.' },
      sink:      { emoji: '', word: 'Kitchen sink', hint: 'A sink with a tap. It only goes on a countertop: tap one. Tap it again to turn it. Drag it to move it.' },
      microwave: { emoji: '', word: 'Microwave', hint: 'Tap the floor, or a level of a table, bookshelf, shelf or countertop where it fits. Tap it again to turn it. Drag it to move it.' },
      pool:   { emoji: '🏊', word: 'Swimming pool', hint: 'Drag across the squares where the pool should go. Pools are dug into the ground, so they go on the ground floor, and nothing can be built under them in the basement.' },
      roof:   { emoji: '🏠', word: 'Roof',   hint: 'Drag from one corner of the roof to the opposite corner. Corners snap to grid corners and the middles of squares. Drag the white corner handles to resize a roof, or tap a roof to turn it. Pick its type and material with 🎨 Style.' },
      stairsQ: { emoji: '', word: 'Quarter-turn staircase', hint: 'Tap a square to add an L-shaped staircase: two squares up, a landing, then two squares turning a quarter. Tap it again to turn it (it also flips to turn the other way). Pick solid or cantilever with 🎨 Style.' },
      stairsH: { emoji: '', word: 'Half-turn staircase', hint: 'Tap a square to add a U-shaped staircase (2 × 3 squares): two squares up, a landing across both lanes, two squares back. Tap it again to turn or flip it. Pick solid or cantilever with 🎨 Style.' },
      stairs: { emoji: '🪜', word: 'Straight staircase', hint: 'Tap a square to add stairs up to the next floor. They are 3 squares long. Tap them again to turn them, or press R to turn them before you tap.' }
    };
    const PIECE_ORDER = ['wall', 'door', 'window', 'fence', 'gate', 'column', 'stairs', 'stairsQ', 'stairsH', 'roof', 'pool'];
    const STAIR_PIECE = { stairs: 'straight', stairsQ: 'quarter', stairsH: 'half' };
    /* ═══════════════ STYLES ═══════════════
       Doors, windows, fences and columns have one style. Walls (and the
       wall around a door or window) have a finish on each side:
       sides.m = north / west side, sides.p = south / east side. */
    const STYLE_SETS = {
      wall:   { label: 'Wall finish',  def: 'drywall',  plural: 'walls',   list: [['drywall', 'Drywall'], ['masonry', 'Masonry'], ['lap', 'Lap siding'], ['vertical', 'Vertical siding'], ['tile', 'Ceramic tile']] },
      floor:  { label: 'Floor',        def: 'hardwood', plural: 'floors',  list: [['hardwood', 'Hardwood'], ['tile', 'Ceramic tile'], ['carpet', 'Carpet']] },
      door:   { label: 'Door style',   def: 'flush',    plural: 'doors',   list: [['flush', 'Flush'], ['halfglass', 'Half-glass'], ['fullglass', 'Full-glass'], ['louvered', 'Louvered']] },
      window: { label: 'Window style', def: 'casement', plural: 'windows', list: [['casement', 'Casement'], ['round', 'Full round'], ['clerestory', 'Clerestory'], ['fullheight', 'Full height']] },
      column: { label: 'Column shape', def: 'square',   plural: 'columns', list: [['square', 'Square'], ['round', 'Round']] },
      fence:  { label: 'Fence style',  def: 'picket',   plural: 'fences',  list: [['picket', 'Picket'], ['board', 'Full board'], ['lattice', 'Lattice'], ['chain', 'Chain-link'],
                                                                               ['boardtall', 'Tall full board'], ['latticetall', 'Tall lattice'], ['chaintall', 'Tall chain-link']] },
      roof:    { label: 'Roof type',     def: 'gable', plural: 'roofs', list: [['flat', 'Flat'], ['gable', 'Box gable'], ['opengable', 'Open gable'], ['shed', 'Box shed'], ['openshed', 'Open shed']] },
      stair:   { label: 'Stair style', def: 'solid', plural: 'staircases', list: [['solid', 'Solid'], ['cantilever', 'Cantilever']] },
      roofmat: { label: 'Roof material', def: 'clay',  plural: 'roofs', list: [['clay', 'Clay tile'], ['concrete', 'Concrete'], ['metal', 'Corrugated metal']] },
      appliance: { label: 'Color', def: 'white', plural: 'appliances', list: [['white', 'White'], ['black', 'Black']] }
    };
    // the big "white goods" — the only appliances the Style tool's black finish applies to
    const STYLABLE_APPL = new Set(['fridge', 'freezer', 'washer', 'dryer', 'washdryer', 'oven']);
    const ROOF_MAT = { clay: 'clay', concrete: 'rconc', metal: 'rmetal' };
    // 'gable' / 'shed' (box) close their ends with panels out to the roof's edge;
    // 'opengable' / 'openshed' leave the ends open and raise the walls under them instead
    const isGable = t => t === 'gable' || t === 'opengable';
    const isShed = t => t === 'shed' || t === 'openshed';
    const isOpenRoof = t => t === 'opengable' || t === 'openshed';
    const styleOK = (set, v) => STYLE_SETS[set].list.some(([id]) => id === v);
    const WALL_MAT = { drywall: 'wall', masonry: 'brick', lap: 'lap', vertical: 'vert', tile: 'ctile' };
    const FLOOR_MAT = { hardwood: 'fwood', tile: 'ftile', carpet: 'fcarpet' };
    const floorStyleAt = (L, r, c) => (state.floors[L] && state.floors[L].floorStyles.get(r + ',' + c)) || 'hardwood';
    const FENCE_MAT = { picket: 'rail', board: 'board', lattice: 'latt', chain: 'metal' };
    // tall versions (1.8 m) look the same as their short style, just higher
    const FENCE_TALL = 1.8;
    const fenceBase = fs => fs.replace(/tall$/, '');
    const fenceHeight = fs => /tall$/.test(fs) ? FENCE_TALL : FENCE_H;
    const sidesOf = v => ({ m: (v && v.sides && v.sides.m) || 'drywall', p: (v && v.sides && v.sides.p) || 'drywall' });
    const styleOf = (v, set) => (v && v.style) || STYLE_SETS[set].def;
    // world-side face materials for a wall-like piece on line o
    function sidesFm(o, v) {
      const sd = sidesOf(v);
      return o === 'h' ? { ym: WALL_MAT[sd.m], yp: WALL_MAT[sd.p] } : { xm: WALL_MAT[sd.m], xp: WALL_MAT[sd.p] };
    }
  
    // little pictures for the style buttons
    const SW = inner => `<svg viewBox="0 0 34 26" width="34" height="26" aria-hidden="true">${inner}</svg>`;
    const WALLBG = '<rect x="1" y="1" width="32" height="24" rx="3" fill="#efe9dd" stroke="#c9c0b0"/>';
    const DOORBG = inner => SW(`<rect x="9" y="1.5" width="16" height="23" rx="1.5" fill="#bb8455" stroke="#7b5231"/>${inner}<circle cx="22" cy="14" r="1.3" fill="#f3d27a"/>`);
    const SWATCH = {
      wall: {
        drywall: SW(WALLBG),
        masonry: SW('<rect x="1" y="1" width="32" height="24" rx="3" fill="#c27658"/><path d="M1 7H33M1 13H33M1 19H33M9 1V7M21 1V7M15 7V13M27 7V13M3 7V13M9 13V19M21 13V19M15 19V25M27 19V25M3 19V25" stroke="#ecdcca" stroke-width="1.2"/>'),
        lap: SW('<rect x="1" y="1" width="32" height="24" rx="3" fill="#aac0d1"/><path d="M1 5.5H33M1 10H33M1 14.5H33M1 19H33M1 23.5H33" stroke="#7890a3" stroke-width="1.3"/>'),
        vertical: SW('<rect x="1" y="1" width="32" height="24" rx="3" fill="#abbd9f"/><path d="M6 1V25M11 1V25M16 1V25M21 1V25M26 1V25M31 1V25" stroke="#7a8d6f" stroke-width="1.3"/>'),
        tile: SW('<rect x="1" y="1" width="32" height="24" rx="3" fill="#eef3f5" stroke="#c9d3d8"/><path d="M1 7H33M1 13H33M1 19H33M7 1V25M13 1V25M19 1V25M25 1V25M31 1V25" stroke="#aebcc4" stroke-width="1"/><path d="M3 3L5 3" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>')
      },
      floor: {
        hardwood: SW('<rect x="1" y="1" width="32" height="24" rx="3" fill="#e3c89c"/><path d="M1 6H33M1 11H33M1 16H33M1 21H33M12 1V6M27 6V11M7 11V16M20 16V21M30 16V21M15 21V25" stroke="#c3a170" stroke-width="1"/>'),
        tile: SW('<rect x="1" y="1" width="32" height="24" rx="3" fill="#e6eaec" stroke="#c4cbd0"/><path d="M1 9H33M1 17H33M9 1V25M17 1V25M25 1V25" stroke="#b9c1c6" stroke-width="1.2"/>'),
        carpet: SW('<rect x="1" y="1" width="32" height="24" rx="3" fill="#8fa2bd"/><path d="M5 5h.01M11 9h.01M17 4h.01M24 8h.01M29 5h.01M7 15h.01M14 19h.01M21 14h.01M27 19h.01M10 23h.01M30 13h.01" stroke="#a9bad1" stroke-width="2" stroke-linecap="round"/>')
      },
      door: {
        flush: DOORBG(''),
        halfglass: DOORBG('<rect x="12" y="4" width="10" height="8" fill="#9fd0f0" stroke="#fff"/>'),
        fullglass: DOORBG('<rect x="12" y="4" width="10" height="18" fill="#9fd0f0" stroke="#fff"/>'),
        louvered: DOORBG('<path d="M12 5H22M12 7.5H22M12 10H22M12 12.5H22M12 15H22M12 17.5H22M12 20H22" stroke="#7b5231" stroke-width="1"/>')
      },
      window: {
        casement: SW(WALLBG + '<rect x="9" y="6" width="16" height="13" fill="#9fd0f0" stroke="#fff" stroke-width="1.5"/><path d="M17 6V19" stroke="#fff" stroke-width="1.5"/>'),
        round: SW(WALLBG + '<circle cx="17" cy="12" r="7" fill="#9fd0f0" stroke="#fff" stroke-width="1.5"/>'),
        clerestory: SW(WALLBG + '<rect x="4" y="3.5" width="26" height="5.5" fill="#9fd0f0" stroke="#fff" stroke-width="1.5"/>'),
        fullheight: SW(WALLBG + '<rect x="10" y="2.5" width="14" height="21" fill="#9fd0f0" stroke="#fff" stroke-width="1.5"/>')
      },
      column: {
        square: SW('<path d="M10 5L17 2L24 5V23L17 26V8Z" fill="#8a5d35"/><path d="M10 5L17 8V26L10 23Z" fill="#a8764a"/><path d="M10 5L17 2L24 5L17 8Z" fill="#6e4a2a"/>'),
        round: SW('<defs><linearGradient id="swcyl" x1="0" x2="1"><stop offset="0" stop-color="#b8845a"/><stop offset="1" stop-color="#7c5230"/></linearGradient></defs><path d="M11 5V22A6 2.5 0 0 0 23 22V5Z" fill="url(#swcyl)"/><ellipse cx="17" cy="5" rx="6" ry="2.5" fill="#6e4a2a"/>')
      },
      fence: {
        picket: SW('<path d="M1 24H33" stroke="#8ab070" stroke-width="2"/><path d="M1 9H33M1 19H33" stroke="#bdbcb4" stroke-width="1.6"/><path d="M4 23V7L5.5 5L7 7V23ZM10 23V7L11.5 5L13 7V23ZM16 23V7L17.5 5L19 7V23ZM22 23V7L23.5 5L25 7V23ZM28 23V7L29.5 5L31 7V23Z" fill="#fbfbf8" stroke="#bdbcb4" stroke-width=".8"/>'),
        board: SW('<rect x="2" y="5" width="30" height="18" fill="#c29566" stroke="#94693f"/><path d="M7 5V23M12 5V23M17 5V23M22 5V23M27 5V23" stroke="#94693f" stroke-width=".8"/>'),
        lattice: SW('<rect x="2" y="5" width="30" height="18" fill="none" stroke="#b8996a" stroke-width="1.6"/><path d="M2 11L8 5M2 17L14 5M2 23L20 5M8 23L26 5M14 23L32 5M20 23L32 11M26 23L32 17M2 17L8 23M2 11L14 23M2 5L20 23M8 5L26 23M14 5L32 23M20 5L32 17M26 5L32 11" stroke="#b8996a" stroke-width="1.1"/>'),
        boardtall: SW('<rect x="5" y="1" width="24" height="23" fill="#c29566" stroke="#94693f"/><path d="M9 1V24M13 1V24M17 1V24M21 1V24M25 1V24" stroke="#94693f" stroke-width=".8"/>'),
        latticetall: SW('<rect x="5" y="1" width="24" height="23" fill="none" stroke="#b8996a" stroke-width="1.6"/><path d="M5 7L11 1M5 13L17 1M5 19L23 1M7 24L29 2M13 24L29 8M19 24L29 14M25 24L29 20M5 7L22 24M5 1L28 24M11 1L29 19M17 1L29 13M23 1L29 7M5 13L16 24M5 19L10 24" stroke="#b8996a" stroke-width="1.1"/>'),
        chaintall: SW('<rect x="5" y="1" width="24" height="23" fill="#d9dde0"/><path d="M5 5L9 1M5 9L13 1M5 13L17 1M5 17L21 1M5 21L25 1M8 24L29 3M12 24L29 7M16 24L29 11M20 24L29 15M24 24L29 19M5 5L24 24M5 1L28 24M9 1L29 21M13 1L29 17M17 1L29 13M21 1L29 9M25 1L29 5M5 9L20 24M5 13L16 24M5 17L12 24M5 21L8 24" stroke="#8d959c" stroke-width=".6"/><path d="M5 1H29" stroke="#979ea4" stroke-width="2"/>'),
        chain: SW('<rect x="2" y="5" width="30" height="18" fill="#d9dde0"/><path d="M2 9L6 5M2 13L10 5M2 17L14 5M2 21L18 5M4 23L22 5M8 23L26 5M12 23L30 5M16 23L32 7M20 23L32 11M24 23L32 15M28 23L32 19M2 9L16 23M2 13L12 23M2 17L8 23M2 5L20 23M6 5L24 23M10 5L28 23M14 5L32 23M18 5L32 19M22 5L32 15M26 5L32 11" stroke="#8d959c" stroke-width=".6"/><path d="M2 5H32" stroke="#979ea4" stroke-width="2"/>')
      }
    };
    SWATCH.roof = {
      flat: SW('<rect x="3" y="11" width="28" height="5" fill="#b85f43"/><rect x="6" y="16" width="22" height="8" fill="#efe9dd" stroke="#c9c0b0"/>'),
      gable: SW('<path d="M2 14L17 3L32 14Z" fill="#efe9dd" stroke="#c9c0b0"/><path d="M2 14L17 3L32 14" fill="none" stroke="#a9553c" stroke-width="2.4" stroke-linejoin="round"/><rect x="7" y="14" width="20" height="10" fill="#efe9dd" stroke="#c9c0b0"/>'),
      opengable: SW('<path d="M7 14V24H27V14L17 6.5Z" fill="#efe9dd" stroke="#c9c0b0"/><path d="M2 17.7L17 5L32 17.7" fill="none" stroke="#a9553c" stroke-width="2.4" stroke-linejoin="round"/>'),
      shed: SW('<path d="M3 13L31 5V24H3Z" fill="#efe9dd" stroke="#c9c0b0"/><path d="M3 13L31 5" fill="none" stroke="#a9553c" stroke-width="2.4"/><path d="M6 12.2V24M28 5.9V24" stroke="#c9c0b0"/>'),
      openshed: SW('<path d="M6 13.4L28 7.2V24H6Z" fill="#efe9dd" stroke="#c9c0b0"/><path d="M2 14.5L32 6" fill="none" stroke="#a9553c" stroke-width="2.4"/>')
    };
    SWATCH.appliance = {
      white: SW('<rect x="6" y="1" width="20" height="22" rx="2" fill="#eceff1" stroke="#9aa0a5"/>'),
      black: SW('<rect x="6" y="1" width="20" height="22" rx="2" fill="#2c3035" stroke="#1f2226"/>')
    };
    SWATCH.stair = {
      solid: SW('<path d="M3 23V18H10V13H17V8H24V3H31V23Z" fill="#e0bd8c" stroke="#a87a48"/>'),
      cantilever: SW('<rect x="1" y="1" width="5" height="22" fill="#efe9dd" stroke="#c9c0b0"/><path d="M6 19H13M6 14H18M6 9H23M6 4H28" stroke="#c99b67" stroke-width="2.6"/>')
    };
    SWATCH.roofmat = {
      clay: SW('<rect x="1" y="1" width="32" height="24" rx="3" fill="#c96a4b"/><path d="M1 7H33M1 13H33M1 19H33M8 1V7M20 1V7M14 7V13M26 7V13M8 13V19M20 13V19M14 19V25M26 19V25" stroke="#8a3f2b" stroke-width="1.1"/><path d="M1 6H33M1 12H33M1 18H33M1 24H33" stroke="#e08d6c" stroke-width=".7"/>'),
      concrete: SW('<rect x="1" y="1" width="32" height="24" rx="3" fill="#a5a9ac"/><path d="M1 9H33M1 17H33M11 1V9M25 1V9M4 9V17M18 9V17M32 9V17M11 17V25M25 17V25" stroke="#75797c" stroke-width="1.1"/>'),
      metal: SW('<rect x="1" y="1" width="32" height="24" rx="3" fill="#bfc9d0"/><path d="M4 1V25M7.5 1V25M11 1V25M14.5 1V25M18 1V25M21.5 1V25M25 1V25M28.5 1V25" stroke="#7d8892" stroke-width="1"/><path d="M5.7 1V25M12.7 1V25M19.7 1V25M26.7 1V25" stroke="#e3e9ed" stroke-width=".7"/>')
    };
    /* ═══════════════ FURNITURE ═══════════════
       A piece is { X, Y, type, dir }: its centre on a column spot (half-metre
       units) and the way its front faces (0 N, 1 E, 2 S, 3 W) — for a chair
       the side you sit on, for a bed the foot end. Parts are given in the
       piece's own frame: u across it, v from back (−) to front (+). */
    /* levels: surfaces that take appliances (z = height of the surface,
       clear = room above it, top = it's the top of the piece). inner = the
       usable width between a bookshelf's sides. h = overall height. */
    const FURN = {
      table: { w: 1.2, d: 0.8, h: 0.75, levels: [{ z: 0.75, top: true }, { z: 0, under: true, clear: 0.7, uw: 0.92, ud: 0.6 }] },
      chair: { w: 0.45, d: 0.45, h: 0.92, inner: 0.45, innerD: 0.4, levels: [{ z: 0.47, single: true, v: 0.02 }, { z: 0, under: true, single: true, clear: 0.42, uw: 0.33, ud: 0.33 }] },
      officechair: { w: 0.6, d: 0.6, h: 1.05, inner: 0.48, innerD: 0.42, levels: [{ z: 0.5, single: true, v: 0.02 }] },
      bed:   { w: 1.4, d: 2.0, h: 0.95 },
      armchair: { w: 0.85, d: 0.85, h: 0.82, seats: 1, inner: 0.53, innerD: 0.6, levels: [{ z: 0.44, single: true, v: 0.1 }] },
      loveseat: { w: 1.5, d: 0.85, h: 0.82, seats: 2, levels: [{ z: 0.44, v: 0.05 }] },
      couch:    { w: 2.1, d: 0.9, h: 0.82, seats: 3, levels: [{ z: 0.44, v: 0.05 }] },
      dresser:    { w: 1.0, d: 0.5, h: 0.85, levels: [{ z: 0.85, top: true }] },
      wardrobe:   { w: 1.0, d: 0.6, h: 2.0 },
      bookshelf:  { w: 0.9, d: 0.4, h: 1.26, inner: 0.84, innerD: 0.38, levels: [{ z: 0.06, clear: 0.56 }, { z: 0.66, clear: 0.56 }, { z: 1.26, top: true }] },
      wallshelf:  { w: 0.84, d: 0.38, h: 1.24, wall: true, hangZ: 1.06, pickZ: 1.2, levels: [{ z: 1.24, top: true }] },
      countertop: { w: 1.0, d: 0.6, h: 0.9, line: true, levels: [{ z: 0.9, top: true }] },
      tvstand:   { w: 1.2, d: 0.42, h: 0.5, inner: 1.15, innerD: 0.38, levels: [{ z: 0.06, clear: 0.4 }, { z: 0.5, top: true }] },
      nightstand: { w: 0.45, d: 0.4, h: 0.55, levels: [{ z: 0.55, top: true }] },
      sidetable:  { w: 0.5, d: 0.5, h: 0.55, levels: [{ z: 0.55, top: true }, { z: 0, under: true, clear: 0.5, uw: 0.4, ud: 0.4 }] },   // a couch end table
      // bathroom
      toilet:    { w: 0.4,  d: 0.7,  h: 0.8,  bath: true },
      washbasin: { w: 0.55, d: 0.45, h: 1.02, bath: true },
      bathtub:   { w: 0.75, d: 1.7,  h: 0.68, bath: true },
      shower:    { w: 0.4,  d: 0.3,  h: 1.96, wall: true, hangZ: 0.95, pickZ: 1.45, bath: true },   // on a wall: valves and a head
      mirrorcab: { w: 0.6,  d: 0.15, h: 1.9,  wall: true, hangZ: 1.2,  pickZ: 1.55, bath: true },   // a wall cabinet with a mirror door
      // wall-mounted appliances (shown in the Appliances row, but hung like a shelf — appl: true)
      acwindow:  { w: 0.55, d: 0.28, h: 0.38, wall: true, appl: true, hangZ: 1.3,  pickZ: 1.45 },
      acsplit:   { w: 0.78, d: 0.18, h: 0.22, wall: true, appl: true, hangZ: 2.15, pickZ: 2.25 },
      accondenser: { w: 0.45, d: 0.45, h: 0.35, wall: true, appl: true, hangZ: 0.4, pickZ: 0.6 },
      exhaustfan:{ w: 0.3,  d: 0.1,  h: 0.3,  wall: true, appl: true, hangZ: 2.1,  pickZ: 2.25 },
      radiator:  { w: 0.8,  d: 0.12, h: 0.6,  wall: true, appl: true, hangZ: 0.15, pickZ: 0.4 },
      waterheater: { w: 0.5, d: 0.16, h: 0.65, wall: true, appl: true, hangZ: 1.3, pickZ: 1.6 },  // tankless, with hot/cold valves
      wallcabinet: { w: 0.8, d: 0.32, h: 0.7,  wall: true, hangZ: 1.5, pickZ: 1.75 }   // upper kitchen cabinet, same doors as the countertop's base
    };
    const FURN_ORDER = ['table', 'chair', 'officechair', 'bed', 'nightstand', 'sidetable', 'dresser', 'wardrobe', 'armchair', 'loveseat', 'couch', 'bookshelf', 'tvstand', 'wallshelf', 'countertop', 'toilet', 'washbasin', 'bathtub', 'shower', 'mirrorcab', 'acwindow', 'acsplit', 'accondenser', 'exhaustfan', 'radiator', 'waterheater', 'wallcabinet'];
    const hung = o => !!FURN[o.type].wall;          // hangs on a wall (shelf, shower) instead of standing on the floor
    const SHELF_Z = 1.2;   // a wall shelf's board sits this high: anything lower than LOW_ENOUGH can stand under it
    const LOW_ENOUGH = 1.15;
    const isSofa = t => !!(FURN[t] && FURN[t].seats);
    /* (moved to S) */
    const FDIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    // where a piece stands: centre and facing. A wall shelf hangs on a wall
    // line { ek, side } instead of standing on a column spot.
    // Countertops hang off a grid line too ({ ek, side, i0, i1 }): back against
    // the line (where a wall would be), and stopping i0 / i1 short of either
    // end where something already meets that corner, so they never overlap it.
    const onLine = f => hung(f) || f.type === 'countertop';
    function furnDims(f) {
      const F_ = FURN[f.type];
      return f.type === 'countertop' ? { w: 1 - (f.i0 || 0) - (f.i1 || 0), d: F_.d } : { w: F_.w, d: F_.d };
    }
    function furnFrame(f) {
      if (!onLine(f)) return { cx: f.X / 2, cy: f.Y / 2, dir: f.dir };
      const e = parseKey(f.ek), off = (T / 2 + FURN[f.type].d / 2) * (f.side === 'p' ? 1 : -1);
      const shift = f.type === 'countertop' ? ((f.i0 || 0) - (f.i1 || 0)) / 2 : 0;
      return e.o === 'h' ? { cx: e.c + 0.5 + shift, cy: e.r + off, dir: f.side === 'p' ? 2 : 0 } : { cx: e.c + off, cy: e.r + 0.5 + shift, dir: f.side === 'p' ? 1 : 3 };
    }
    function framePt(fr, u, v) { const [fx, fy] = FDIR[fr.dir]; return [fr.cx + u * -fy + v * fx, fr.cy + u * fx + v * fy]; }
    function frameRect(fr, u0, u1, v0, v1) {
      const q = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => framePt(fr, u, v));
      return { x0: Math.min(...q.map(p => p[0])), x1: Math.max(...q.map(p => p[0])), y0: Math.min(...q.map(p => p[1])), y1: Math.max(...q.map(p => p[1])) };
    }
    const furnPt = (f, u, v) => framePt(furnFrame(f), u, v);
    const furnLocal = (f, u0, u1, v0, v1) => frameRect(furnFrame(f), u0, u1, v0, v1);
    const SIDE_OF_DIR = ['ym', 'xp', 'yp', 'xm'];   // the world side a piece's front looks at
    const furnRect = f => { const { w, d } = furnDims(f); return furnLocal(f, -w / 2, w / 2, -d / 2, d / 2); };
    // everything standing on (or hanging over) a floor: furniture and floor appliances
    const allRects = L => state.floors[L] ? [...state.floors[L].furniture.map(furnRect), ...(state.floors[L].appliances || []).filter(a => a.type !== 'rug').map(applRect)] : [];
    function furnParts(f) {
      const fr = furnFrame(f);
      const P_ = (u0, u1, v0, v1, z0, z1, m, x) => ({ rect: frameRect(fr, u0, u1, v0, v1), z0, z1, m, x });
      const legs = (du, dv, s2, h) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => P_(a * du - s2, a * du + s2, b * dv - s2, b * dv + s2, 0, h, 'furn'));
      if (f.type === 'table') return [...legs(0.52, 0.32, 0.03, 0.71), P_(-0.6, 0.6, -0.4, 0.4, 0.71, 0.75, 'furn')];
      if (f.type === 'chair') return [...legs(0.19, 0.19, 0.02, 0.43), P_(-0.225, 0.225, -0.225, 0.225, 0.43, 0.47, 'furn'), P_(-0.225, 0.225, -0.225, -0.185, 0.47, 0.92, 'furn')];
      if (f.type === 'bookshelf') {
        const hw = 0.45, hd = 0.2, s2 = 0.03;
        return [P_(-hw, -hw + s2, -hd, hd, 0, 1.26, 'furn'), P_(hw - s2, hw, -hd, hd, 0, 1.26, 'furn'), P_(-hw + s2, hw - s2, -hd, -hd + 0.02, 0, 1.26, 'furn'),
                P_(-hw + s2, hw - s2, -hd + 0.02, hd, 0, 0.06, 'furn'), P_(-hw + s2, hw - s2, -hd + 0.02, hd, 0.62, 0.66, 'furn'), P_(-hw + s2, hw - s2, -hd + 0.02, hd, 1.22, 1.26, 'furn')];
      }
      if (f.type === 'wallshelf')
        return [P_(-0.42, 0.42, -0.19, 0.19, SHELF_Z, SHELF_Z + 0.04, 'furn'), P_(-0.33, -0.3, -0.19, -0.04, SHELF_Z - 0.14, SHELF_Z, 'furn'), P_(0.3, 0.33, -0.19, -0.04, SHELF_Z - 0.14, SHELF_Z, 'furn')];
      if (f.type === 'officechair') {
        // a star base (one bar across, two half bars), a gas post, the seat and the back
        return [P_(-0.28, 0.28, -0.03, 0.03, 0.02, 0.06, 'office'), P_(-0.03, 0.03, -0.28, -0.03, 0.02, 0.06, 'office'), P_(-0.03, 0.03, 0.03, 0.28, 0.02, 0.06, 'office'),
                P_(-0.025, 0.025, -0.025, 0.025, 0.06, 0.42, 'steel'), P_(-0.24, 0.24, -0.22, 0.25, 0.42, 0.5, 'office'), P_(-0.22, 0.22, -0.28, -0.22, 0.56, 1.05, 'office')];
      }
      if (f.type === 'tvstand') {
        const hw = 0.6, hd = 0.21, s2 = 0.025;
        return [P_(-hw, -hw + s2, -hd, hd, 0, 0.5, 'furn'), P_(hw - s2, hw, -hd, hd, 0, 0.5, 'furn'), P_(-hw + s2, hw - s2, -hd, -hd + 0.02, 0, 0.5, 'furn'),
                P_(-hw + s2, hw - s2, -hd + 0.02, hd, 0, 0.06, 'furn'), P_(-hw + s2, hw - s2, -hd + 0.02, hd, 0.46, 0.5, 'furn')];
      }
      if (f.type === 'dresser') return [P_(-0.5, 0.5, -0.25, 0.25, 0.04, 0.85, 'furn', { front: SIDE_OF_DIR[fr.dir], fdeco: 'dresser' }), P_(-0.47, 0.47, -0.22, 0.22, 0, 0.04, 'furn')];
      if (f.type === 'wardrobe') return [P_(-0.5, 0.5, -0.3, 0.3, 0.05, 2.0, 'furn', { front: SIDE_OF_DIR[fr.dir], fdeco: 'wardrobe' }), P_(-0.47, 0.47, -0.27, 0.27, 0, 0.05, 'furn')];
      if (f.type === 'sidetable') return [...legs(0.21, 0.21, 0.025, 0.51), P_(-0.25, 0.25, -0.25, 0.25, 0.51, 0.55, 'furn')];
      if (f.type === 'nightstand') return [P_(-0.225, 0.225, -0.2, 0.2, 0, 0.55, 'furn', { front: SIDE_OF_DIR[fr.dir], fdeco: 'drawers' })];
      if (f.type === 'mirrorcab') return [P_(-0.3, 0.3, -0.075, 0.06, 1.2, 1.9, 'cab', { front: SIDE_OF_DIR[fr.dir], fdeco: 'mirror' })];
      if (f.type === 'acwindow') return [P_(-0.275, 0.275, -0.14, 0.14, 1.3, 1.68, 'utility', { front: SIDE_OF_DIR[fr.dir], fdeco: 'acwindow' })];
      if (f.type === 'acsplit') return [P_(-0.39, 0.39, -0.09, 0.09, 2.15, 2.37, 'utility', { front: SIDE_OF_DIR[fr.dir], fdeco: 'acsplit' })];
      if (f.type === 'accondenser') return [P_(-0.225, 0.225, -0.225, 0.225, 0.4, 0.75, 'utility', { front: SIDE_OF_DIR[fr.dir], fdeco: 'fan' })];
      if (f.type === 'exhaustfan') return [P_(-0.15, 0.15, -0.05, 0.05, 2.1, 2.4, 'utility', { front: SIDE_OF_DIR[fr.dir], fdeco: 'fan' })];
      if (f.type === 'radiator') return [P_(-0.4, 0.4, -0.06, 0.06, 0.15, 0.75, 'utility', { front: SIDE_OF_DIR[fr.dir], fdeco: 'radiator' })];
      if (f.type === 'wallcabinet') return [P_(-0.4, 0.4, -0.16, 0.16, 1.5, 2.2, 'cab', { front: SIDE_OF_DIR[fr.dir], fdeco: 'cab' })];
      if (f.type === 'waterheater')   // the tankless unit, with a hot and a cold valve where the pipes enter underneath
        return [P_(-0.25, 0.25, -0.08, 0.08, 1.3, 1.95, 'tank', { front: SIDE_OF_DIR[fr.dir], fdeco: 'gauge' }),
                P_(-0.16, -0.09, -0.07, -0.02, 1.2, 1.3, 'hot'), P_(0.09, 0.16, -0.07, -0.02, 1.2, 1.3, 'cold')];
      if (f.type === 'toilet')   // tank against the wall, pedestal, bowl with the seat on top
        return [P_(-0.2, 0.2, -0.35, -0.17, 0.33, 0.8, 'porc'), P_(-0.12, 0.12, -0.17, 0.17, 0, 0.36, 'porc'), P_(-0.19, 0.19, -0.17, 0.35, 0.36, 0.42, 'porc', { tp: 'toilet' })];
      if (f.type === 'washbasin')
        return [P_(-0.1, 0.1, -0.18, 0.04, 0, 0.75, 'porc'), P_(-0.275, 0.275, -0.225, 0.225, 0.75, 0.86, 'porc', { tp: 'basin' }),
                P_(-0.015, 0.015, -0.215, -0.185, 0.86, 1.02, 'steel'), P_(-0.015, 0.015, -0.185, -0.07, 0.98, 1.02, 'steel')];
      if (f.type === 'bathtub')
        return [P_(-0.375, 0.375, -0.85, 0.85, 0, 0.55, 'porc', { tp: 'tub' }), P_(-0.02, 0.02, -0.84, -0.8, 0.55, 0.68, 'steel'), P_(-0.02, 0.02, -0.8, -0.68, 0.64, 0.68, 'steel')];
      if (f.type === 'shower')   // hot and cold valves either side of the pipe, an arm and the shower head
        return [P_(-0.16, -0.09, -0.15, -0.1, 0.95, 1.02, 'hot'), P_(0.09, 0.16, -0.15, -0.1, 0.95, 1.02, 'cold'),
                P_(-0.012, 0.012, -0.15, -0.126, 0.95, 1.95, 'steel'), P_(-0.012, 0.012, -0.126, 0.02, 1.93, 1.96, 'steel'),
                P_(-0.09, 0.09, -0.03, 0.13, 1.86, 1.9, 'steel')];
      if (f.type === 'countertop') {
        const hw = furnDims(f).w / 2;
        return [P_(-hw, hw, -0.3, 0.26, 0, 0.86, 'cab', { front: SIDE_OF_DIR[fr.dir], fdeco: 'cab' }), P_(-hw, hw, -0.3, 0.3, 0.86, 0.9, 'stone')];
      }
      if (isSofa(f.type)) {
        // upholstered base, a back along the back edge, an arm on each side,
        // and one seat cushion per seat between the arms
        const { w, d, seats } = FURN[f.type], a = 0.16, bd = 0.2, hw = w / 2, hd = d / 2;
        const parts = [P_(-hw, hw, -hd, hd, 0, 0.24, 'sofa'), P_(-hw, hw, -hd, -hd + bd, 0.24, 0.82, 'sofa'),
                       P_(-hw, -hw + a, -hd + bd, hd, 0.24, 0.6, 'sofa'), P_(hw - a, hw, -hd + bd, hd, 0.24, 0.6, 'sofa')];
        const cw = (w - 2 * a) / seats;
        for (let i = 0; i < seats; i++) parts.push(P_(-hw + a + i * cw + 0.006, -hw + a + (i + 1) * cw - 0.006, -hd + bd, hd - 0.01, 0.24, 0.44, 'cush'));
        return parts;
      }
      return [   // bed: headboard at the back, frame, mattress, duvet over the foot end, two pillows
        P_(-0.7, 0.7, -1.0, -0.94, 0, 0.95, 'furn'), P_(-0.7, 0.7, -0.94, 1.0, 0, 0.28, 'furn'),
        P_(-0.66, 0.66, -0.92, 0.97, 0.28, 0.48, 'linen'), P_(-0.68, 0.68, -0.35, 0.99, 0.48, 0.51, 'duvet'),
        P_(-0.62, -0.06, -0.9, -0.6, 0.48, 0.58, 'linen'), P_(0.06, 0.62, -0.9, -0.6, 0.48, 0.58, 'linen')];
    }
    /* ═══════════════ APPLIANCES ═══════════════
       On the floor an appliance is { type, X, Y, dir } on a column spot, like
       furniture. On furniture it is one of the piece's items
       { type, lvl, slot, rdir }: lvl is one of the piece's levels, slot is
       'C' (the middle, a whole level to itself) or 'L' / 'R' (two side by
       side), rdir its turn relative to the piece. Items travel with their
       piece when it moves, turns or is erased. */
    const APPL = {
      tv:        { w: 0.9,  d: 0.2,  h: 0.62 },
      lamp:      { w: 0.26, d: 0.26, h: 0.45 },
      microwave: { w: 0.5,  d: 0.36, h: 0.3 },
      stove:     { w: 0.6,  d: 0.52, h: 0.03, counterOnly: true },
      sink:      { w: 0.6,  d: 0.5,  h: 0.28, counterOnly: true },
      monitor:   { w: 0.55, d: 0.18, h: 0.45 },
      console:   { w: 0.3,  d: 0.18, h: 0.08 },            // a PlayStation 2 lying flat
      stereo:    { w: 0.9,  d: 0.25, h: 0.3 },             // the unit with a speaker on each side
      laptop:    { w: 0.34, d: 0.24, h: 0.24 },
      desktop:   { w: 0.2,  d: 0.45, h: 0.45 },            // a tower case
      fridge:    { w: 0.68, d: 0.7,  h: 1.8,  floorOnly: true },
      freezer:   { w: 1.0,  d: 0.65, h: 0.85, floorOnly: true },
      washer:    { w: 0.6,  d: 0.6,  h: 0.85, floorOnly: true },
      dryer:     { w: 0.6,  d: 0.6,  h: 0.85, floorOnly: true },
      washdryer: { w: 0.6,  d: 0.65, h: 1.7,  floorOnly: true },
      watertank: { w: 0.5,  d: 0.5,  h: 1.3,  floorOnly: true },   // a true cylinder, plus the pump beside it
      oven:      { w: 0.6,  d: 0.6,  h: 0.85, floorOnly: true },
      toaster:   { w: 0.25, d: 0.2,  h: 0.18 },
      blender:   { w: 0.16, d: 0.16, h: 0.38 },
      standlamp: { w: 0.3,  d: 0.3,  h: 1.5,  floorOnly: true },
      // 🪴 objects: small things that go anywhere an appliance can
      rug:       { w: 2.0,  d: 1.4,  h: 0.01, floorOnly: true, obj: true },  // lies on the floor, under furniture
      cushion:   { w: 0.35, d: 0.35, h: 0.12, obj: true },   // a throw pillow — fits a chair, armchair, loveseat or couch seat
      planter:   { w: 0.26, d: 0.26, h: 0.42, obj: true },
      book:      { w: 0.22, d: 0.16, h: 0.035, obj: true },  // one book lying flat
      books:     { w: 0.2,  d: 0.16, h: 0.24, obj: true }    // four books standing up
    };
    const APPL_ORDER = ['tv', 'monitor', 'console', 'stereo', 'laptop', 'desktop', 'lamp', 'standlamp', 'microwave', 'stove', 'sink', 'oven', 'toaster', 'blender',
      'fridge', 'freezer', 'washer', 'dryer', 'washdryer', 'watertank', 'rug', 'cushion', 'planter', 'book', 'books'];
    /* (moved to S) */
    function applParts(type, fr, z, color) {
      const P_ = (u0, u1, v0, v1, z0, z1, m, x) => ({ rect: frameRect(fr, u0, u1, v0, v1), z0: z + z0, z1: z + z1, m, x });
      const front = SIDE_OF_DIR[fr.dir];
      // the "white goods" styled black swap to the same dark finish already used for electronics —
      // only these few types ever call matOf; everything else just keeps its own material name
      const matOf = base => color === 'black' ? 'appdark' : base;
      if (type === 'tv') return [P_(-0.15, 0.15, -0.09, 0.09, 0, 0.03, 'appdark'), P_(-0.03, 0.03, -0.03, 0.01, 0.03, 0.1, 'appdark'), P_(-0.45, 0.45, -0.03, 0.02, 0.1, 0.62, 'tvbody', { front, fdeco: 'tv' })];
      if (type === 'lamp') return [P_(-0.08, 0.08, -0.08, 0.08, 0, 0.03, 'lampbase'), P_(-0.012, 0.012, -0.012, 0.012, 0.03, 0.27, 'lampbase'), P_(-0.13, 0.13, -0.13, 0.13, 0.27, 0.45, 'shade')];
      if (type === 'stove') return [P_(-0.3, 0.3, -0.26, 0.26, 0, 0.03, 'cooktop', { tp: 'burners' })];
      if (type === 'sink') return [P_(-0.3, 0.3, -0.25, 0.25, 0, 0.02, 'steel', { tp: 'basin' }),
        P_(-0.015, 0.015, -0.23, -0.2, 0.02, 0.28, 'steel'), P_(-0.015, 0.015, -0.2, -0.08, 0.24, 0.28, 'steel')];
      if (type === 'monitor') return [P_(-0.12, 0.12, -0.08, 0.08, 0, 0.02, 'appdark'), P_(-0.02, 0.02, -0.04, 0, 0.02, 0.1, 'appdark'), P_(-0.275, 0.275, -0.04, 0.01, 0.1, 0.45, 'tvbody', { front, fdeco: 'tv' })];
      if (type === 'console') return [P_(-0.15, 0.15, -0.09, 0.09, 0, 0.078, 'appdark', { front, fdeco: 'ps2', tp: 'ps2' }),
        P_(-0.065, 0.065, 0.1, 0.2, 0, 0.022, 'appdark', { tp: 'controller' })];   // a controller resting in front of it
      if (type === 'stereo') return [P_(-0.15, 0.15, -0.12, 0.12, 0, 0.18, 'appdark', { front, fdeco: 'stereo' }),
        P_(-0.45, -0.3, -0.11, 0.11, 0, 0.3, 'speaker', { front, fdeco: 'speaker' }), P_(0.3, 0.45, -0.11, 0.11, 0, 0.3, 'speaker', { front, fdeco: 'speaker' })];
      if (type === 'laptop') return [P_(-0.17, 0.17, -0.105, 0.12, 0, 0.02, 'silver', { tp: 'keys' }), P_(-0.17, 0.17, -0.12, -0.105, 0, 0.24, 'silver', { front, fdeco: 'lcd' })];
      if (type === 'desktop') return [P_(-0.1, 0.1, -0.225, 0.225, 0, 0.45, 'appdark', { front, fdeco: 'tower' })];
      if (type === 'fridge') return [P_(-0.34, 0.34, -0.35, 0.35, 0, 1.8, matOf('fridge'), { front, fdeco: 'fridge' })];
      if (type === 'freezer') return [P_(-0.5, 0.5, -0.325, 0.325, 0, 0.85, matOf('utility'), { tp: 'freezerlid' })];
      if (type === 'washer') return [P_(-0.3, 0.3, -0.3, 0.3, 0, 0.85, matOf('utility'), { front, fdeco: 'washerdoor' })];
      if (type === 'dryer') return [P_(-0.3, 0.3, -0.3, 0.3, 0, 0.85, matOf('utility'), { front, fdeco: 'dryerdoor' })];
      if (type === 'washdryer') return [
        P_(-0.3, 0.3, -0.325, 0.325, 0, 0.82, matOf('utility'), { front, fdeco: 'washerdoor' }),
        P_(-0.3, 0.3, -0.325, 0.325, 0.82, 0.88, 'appdark'),
        P_(-0.3, 0.3, -0.325, 0.325, 0.88, 1.7, matOf('utility'), { front, fdeco: 'dryerdoor' })];
      if (type === 'watertank') return [
        P_(-0.25, 0.25, -0.25, 0.25, 0, 1.3, 'tank', { cyl: 'mat' }),
        P_(0.3, 0.55, -0.15, 0.15, 0, 0.3, 'appdark', { front, fdeco: 'pump' })];
      if (type === 'oven') return [P_(-0.3, 0.3, -0.3, 0.3, 0, 0.85, matOf('appl'), { front, fdeco: 'oven' })];
      if (type === 'toaster') return [P_(-0.125, 0.125, -0.1, 0.1, 0, 0.18, 'appl', { tp: 'toaster' })];
      if (type === 'blender') return [P_(-0.08, 0.08, -0.08, 0.08, 0, 0.1, 'appdark'), P_(-0.06, 0.06, -0.06, 0.06, 0.1, 0.38, 'appl'),
        P_(-0.066, 0.066, -0.066, 0.066, 0.38, 0.41, 'appdark'), P_(-0.022, 0.022, -0.022, 0.022, 0.41, 0.43, 'appdark')];  // a black lid, with its knob
      if (type === 'standlamp') return [P_(-0.14, 0.14, -0.14, 0.14, 0, 0.04, 'lampbase'), P_(-0.018, 0.018, -0.018, 0.018, 0.04, 1.3, 'lampbase'), P_(-0.18, 0.18, -0.18, 0.18, 1.3, 1.5, 'shade')];
      if (type === 'cushion') return [P_(-0.175, 0.175, -0.175, 0.175, 0, 0.12, 'cushion', { tp: 'cushion' })];
      if (type === 'rug') return [P_(-1, 1, -0.7, 0.7, 0, 0.01, 'rug', { tp: 'rug' })];
      if (type === 'planter') return [   // a round terracotta pot with a rim, and leaves fanning out of it
        P_(-0.085, 0.085, -0.085, 0.085, 0, 0.13, 'pot', { cyl: 'mat' }), P_(-0.1, 0.1, -0.1, 0.1, 0.13, 0.16, 'potrim', { cyl: 'mat' }),
        P_(-0.16, 0.16, -0.16, 0.16, 0.155, 0.42, 'leaf', { plant: true })];
      if (type === 'book') return [P_(-0.11, 0.11, -0.08, 0.08, 0, 0.005, 'bk1'), P_(-0.105, 0.11, -0.075, 0.075, 0.005, 0.03, 'pages'), P_(-0.11, 0.11, -0.08, 0.08, 0.03, 0.035, 'bk1')];
      if (type === 'books') return [[-0.1, -0.055, 0.22, 'bk1'], [-0.05, -0.005, 0.24, 'bk2'], [0, 0.045, 0.2, 'bk3'], [0.05, 0.095, 0.23, 'bk4']]
        .map(([u0, u1, h, m]) => P_(u0, u1, -0.08, 0.08, 0, h, m, { front, fdeco: 'spine' }));
      return [P_(-0.25, 0.25, -0.18, 0.18, 0, 0.3, 'appl', { front, fdeco: 'mw' })];
    }
    const applFrame = a => ({ cx: a.X / 2, cy: a.Y / 2, dir: a.dir });
    const applRect = a => { const { w, d } = APPL[a.type]; return frameRect(applFrame(a), -w / 2, w / 2, -d / 2, d / 2); };
    // slots on a piece's level
    // inside a bookshelf only the width between its sides counts; on top, the whole width
    const usableW = (f, lvl) => { const L_ = FURN[f.type].levels[lvl]; return L_.uw || (L_.top ? furnDims(f).w : (FURN[f.type].inner || furnDims(f).w)); };
    const SMALL = 0.45;   // under a table or chair: only small things (about laptop size)
    const slotU = (f, slot, lvl) => slot === 'C' ? 0 : (slot === 'L' ? -1 : 1) * usableW(f, lvl) / 4;
    function itemFrame(f, it) {
      const fr = furnFrame(f), [cx, cy] = framePt(fr, slotU(f, it.slot, it.lvl), FURN[f.type].levels[it.lvl].v || 0);
      return { cx, cy, dir: (fr.dir + it.rdir) % 4, z: FURN[f.type].levels[it.lvl].z };
    }
    function slotFree(f, lvl, slot, skip = -1) {
      const its = (f.items || []).filter((it, i) => i !== skip && it.lvl === lvl);
      return slot === 'C' ? !its.length : !its.some(it => it.slot === 'C' || it.slot === slot);
    }
    function slotFits(f, lvl, slot, type, rdir) {
      const F_ = FURN[f.type], L_ = F_.levels[lvl], A = APPL[type];
      if (type === 'tv' && !L_.top) return false;                       // a television only goes on top
      if (A.counterOnly && f.type !== 'countertop') return false;       // stoves and sinks only go on a countertop
      if (A.floorOnly) return false;                                    // a rug only goes on the floor
      if (L_.under && Math.max(A.w, A.d) > SMALL) return false;          // under a table or chair: small things only
      if (L_.single && slot !== 'C') return false;                      // a seat takes one appliance, in the middle
      const along = rdir % 2 ? A.d : A.w, across = rdir % 2 ? A.w : A.d;
      const width = slot === 'C' ? usableW(f, lvl) : usableW(f, lvl) / 2;
      return along <= width + 1e-6 && across <= (L_.ud || (L_.top ? F_.d : (F_.innerD || F_.d))) + 1e-6 && A.h <= (L_.clear || Infinity) + 1e-6;
    }
    function itemParts(f) {
      return (f.items || []).flatMap(it => { const fr = itemFrame(f, it); return applParts(it.type, fr, fr.z); });
    }
    const rectsOverlap = (a, b, e = 0.005) => a.x0 < b.x1 - e && b.x0 < a.x1 - e && a.y0 < b.y1 - e && b.y0 < a.y1 - e;
    const cellRect = k => { const [r, c] = k.split(',').map(Number); return { x0: c, x1: c + 1, y0: r, y1: r + 1 }; };
    // furniture may not overlap walls (or open doors), columns, stairs, stair holes, pools or other furniture
    function furnValid(f, L, ignoreIdx = -1) {
      const F = state.floors[L];
      if (hung(f)) { const v = F.edges.get(f.ek); if (!v || v.type !== 'wall') return false; }
      const R_ = furnRect(f);
      if (R_.x0 < -0.001 || R_.y0 < -0.001 || R_.x1 > state.COLS + 0.001 || R_.y1 > state.ROWS + 0.001) return false;
      const st = { edges: F.edges, colSet: F.columns };
      for (const [k, v] of F.edges) {
        const e = parseKey(k), [[x0, y0], [x1, y1]] = edgeEnds(e.o, e.r, e.c);
        if (rectsOverlap(R_, { x0: x0 - T / 2, x1: x1 + T / 2, y0: y0 - T / 2, y1: y1 + T / 2 })) return false;
        { const lf = openLeaf(e, v, st); if (lf && rectsOverlap(R_, lf)) return false; }
      }
      for (const k of F.columns) if (rectsOverlap(R_, colFootprint(k))) return false;
      for (const s2 of F.stairs) if (stairCellRects(s2).some(r2 => rectsOverlap(R_, r2))) return false;
      for (const k of holeSquares(L)) if (rectsOverlap(R_, cellRect(k))) return false;
      if (L === 0) for (const k of poolSquares()) if (rectsOverlap(R_, cellRect(k))) return false;
      // something hung on a wall (a shelf, a shower) may be over low things: anything lower than its lowest part
      const under = (lo, hi) => hung(hi) && !hung(lo) && FURN[lo.type].h <= FURN[hi.type].hangZ - 0.02;
      if (F.furniture.some((o, i) => i !== ignoreIdx && rectsOverlap(R_, furnRect(o)) && !under(o, f) && !under(f, o))) return false;
      if (!hung(f) && (F.appliances || []).some(a => a.type !== 'rug' && rectsOverlap(R_, applRect(a)))) return false;
      return true;
    }
    function applValid(a, L, ignoreIdx = -1) {
      const R_ = applRect(a), F = state.floors[L];
      if (R_.x0 < -0.001 || R_.y0 < -0.001 || R_.x1 > state.COLS + 0.001 || R_.y1 > state.ROWS + 0.001) return false;
      const st = { edges: F.edges, colSet: F.columns };
      for (const [k, v] of F.edges) {
        const e = parseKey(k), [[x0, y0], [x1, y1]] = edgeEnds(e.o, e.r, e.c);
        if (rectsOverlap(R_, { x0: x0 - T / 2, x1: x1 + T / 2, y0: y0 - T / 2, y1: y1 + T / 2 })) return false;
        { const lf = openLeaf(e, v, st); if (lf && rectsOverlap(R_, lf)) return false; }
      }
      for (const k of F.columns) if (rectsOverlap(R_, colFootprint(k))) return false;
      for (const s2 of F.stairs) if (!stairAllowsUnder(s2, R_, APPL[a.type].h)) return false;   // under a cantilever stair is fine if it fits
      for (const k of holeSquares(L)) if (rectsOverlap(R_, cellRect(k))) return false;
      if (L === 0) for (const k of poolSquares()) if (rectsOverlap(R_, cellRect(k))) return false;
      const rug = a.type === 'rug';
      if (!rug && F.furniture.some(o => !hung(o) && rectsOverlap(R_, furnRect(o)))) return false;
      // a rug may lie under furniture and appliances, but not on another rug; nothing else overlaps
      return !(F.appliances || []).some((o, i) => i !== ignoreIdx && (rug === (o.type === 'rug')) && rectsOverlap(R_, applRect(o)));
    }
    function furnIndexAt(w) {
      const list = state.floors[state.level].furniture;
      // a wall shelf hangs high: in the 3D view pick it where it is drawn
      if (w.sp) for (let i = list.length - 1; i >= 0; i--) {
        if (!hung(list[i])) continue;
        const fr = furnFrame(list[i]), [sx, sy] = scr(fr.cx, fr.cy, baseZ(state.level) + FURN[list[i].type].pickZ);
        if (Math.hypot(sx - w.sp.x, sy - w.sp.y) < 24) return i;
      }
      for (let i = list.length - 1; i >= 0; i--) {
        if (w.sp && hung(list[i])) continue; const R_ = furnRect(list[i]); if (w.x > R_.x0 - 0.05 && w.x < R_.x1 + 0.05 && w.y > R_.y0 - 0.05 && w.y < R_.y1 + 0.05) return i; }
      return -1;
    }
  
    const emptyLevel = () => ({ edges: new Map(), stairs: [], columns: new Set(), colStyles: new Map(), roofs: [], floorStyles: new Map(), pools: [], furniture: [], appliances: [] });
    /* (moved to S) */
    LEVELS.forEach(L => { state.floors[L] = emptyLevel(); });
    /* (moved to S) */
    const cur = () => state.floors[state.level].edges;
  
    const key = (o, r, c) => `${o}:${r}:${c}`;
    function parseKey(k) { const p = k.split(':'); return { o: p[0], r: +p[1], c: +p[2] }; }
    function validEdge(o, r, c, cols = state.COLS, rows = state.ROWS) {
      if (!Number.isInteger(r) || !Number.isInteger(c)) return false;
      if (o === 'h') return r >= 0 && r <= rows && c >= 0 && c < cols;
      if (o === 'v') return r >= 0 && r < rows && c >= 0 && c <= cols;
      return false;
    }
    function edgeEnds(o, r, c) { return o === 'h' ? [[c, r], [c + 1, r]] : [[c, r], [c, r + 1]]; }
    const levelUsed = L => state.floors[L].edges.size > 0 || state.floors[L].stairs.length > 0 || state.floors[L].columns.size > 0 || state.floors[L].roofs.length > 0 || state.floors[L].pools.length > 0 || state.floors[L].furniture.length > 0 || state.floors[L].appliances.length > 0;
    const colKey = (X, Y) => X + ',' + Y;
    const colXY = k => k.split(',').map(Number);   // half-metre units
    const basementUsed = () => levelUsed(-1);
  
    /* ═══════════════ STAIRS ═══════════════
       A staircase is { r, c, dir, type, hand, style }:
         type   'straight'  3 squares in a row
                'quarter'   an L: 2 squares, a landing, then 2 squares turning a quarter
                'half'      a U: 2 squares up one lane, a landing across both lanes,
                            2 squares back along the other lane
         dir    the way the first flight climbs (0 N, 1 E, 2 S, 3 W)
         hand   0: the turn (or the second lane) is to the right, 1: to the left
         style  'solid' (blocks down to the floor) or 'cantilever' (floating treads,
                with room underneath for small things)
       Shapes are laid out in "lane" coordinates: u along the first flight from the
       back edge of its first square, v across it toward the turn side. Every flight
       climbs 14 risers in all; a landing is one of them. */
    const STAIR_TYPES = { straight: 'Straight staircase', quarter: 'Quarter-turn staircase', half: 'Half-turn staircase' };
    const STAIR_CELLS = { straight: [[0, 0], [1, 0], [2, 0]], quarter: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], half: [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1]] };
    const RISERS = 14, RAIL_H = 0.9;
    const sType = st => STAIR_CELLS[st.type] ? st.type : 'straight';
    function laneFrame(st) {
      const [dr, dc] = DIRV[st.dir], F = [dc, dr], side = st.hand ? -1 : 1, V = [-F[1] * side, F[0] * side];
      return { F, V, O: [st.c + 0.5 - F[0] * 0.5 - V[0] * 0.5, st.r + 0.5 - F[1] * 0.5 - V[1] * 0.5] };
    }
    function lanePt(st, u, v) { const { F, V, O } = laneFrame(st); return [O[0] + F[0] * u + V[0] * v, O[1] + F[1] * u + V[1] * v]; }
    function laneRect(st, u0, u1, v0, v1) {
      const q = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => lanePt(st, u, v));
      return { x0: Math.min(...q.map(p => p[0])), x1: Math.max(...q.map(p => p[0])), y0: Math.min(...q.map(p => p[1])), y1: Math.max(...q.map(p => p[1])) };
    }
    const stairRect = laneRect;
    function stairCells(st) {
      return STAIR_CELLS[sType(st)].map(([i, j]) => { const [x, y] = lanePt(st, i + 0.5, j + 0.5); return [Math.floor(y), Math.floor(x)]; });
    }
    // the grid lines between two squares of the same staircase (they must stay empty)
    function stairCrossEdges(st) {
      const cells = stairCells(st), set = new Set(cells.map(([r, c]) => r + ',' + c)), out = [];
      cells.forEach(([r, c]) => {
        if (set.has((r + 1) + ',' + c)) out.push(key('h', r + 1, c));
        if (set.has(r + ',' + (c + 1))) out.push(key('v', r, c + 1));
      });
      return out;
    }
    /* The flights and landings in lane coordinates. A flight runs from `from`
       to `to` along its axis ('u' or 'v'), spans a0…a1 across it, has n steps
       and its first step is riser number `first`. */
    function stairLayout(st) {
      const t = sType(st);
      if (t === 'straight') return { flights: [{ axis: 'u', from: SI, to: 3 - SI, a0: SI, a1: 1 - SI, n: 14, first: 1 }], landings: [], path: [[SI + 0.55, 0.5], [3 - SI - 0.06, 0.5]] };
      if (t === 'quarter') return {
        flights: [{ axis: 'u', from: SI, to: 2, a0: SI, a1: 1 - SI, n: 6, first: 1 }, { axis: 'v', from: 1, to: 3 - SI, a0: 2, a1: 3 - SI, n: 7, first: 8 }],
        landings: [{ u0: 2, u1: 3 - SI, v0: SI, v1: 1, h: 7, open: [['u1'], ['v0']] }],
        path: [[SI + 0.55, 0.5], [2.5, 0.5], [2.5, 3 - SI - 0.06]] };
      return {
        flights: [{ axis: 'u', from: SI, to: 2, a0: SI, a1: 1 - SI, n: 6, first: 1 }, { axis: 'u', from: 2, to: SI, a0: 1 + SI, a1: 2 - SI, n: 7, first: 8 }],
        landings: [{ u0: 2, u1: 3 - SI, v0: SI, v1: 2 - SI, h: 7, open: [['u1'], ['v0'], ['v1']] }],
        path: [[SI + 0.55, 0.5], [2.5, 0.5], [2.5, 1.5], [SI + 0.06, 1.5]] };
    }
    const flightRect = (st, fl, t0, t1) => fl.axis === 'u' ? laneRect(st, Math.min(t0, t1), Math.max(t0, t1), fl.a0, fl.a1) : laneRect(st, fl.a0, fl.a1, Math.min(t0, t1), Math.max(t0, t1));
    // every tread (and landing): its footprint and the riser number of its top
    function stairTreads(st) {
      const L_ = stairLayout(st), out = [];
      L_.flights.forEach((fl, fi) => {
        for (let k = 0; k < fl.n; k++) {
          const t0 = fl.from + (fl.to - fl.from) * k / fl.n, t1 = fl.from + (fl.to - fl.from) * (k + 1) / fl.n;
          out.push({ rect: flightRect(st, fl, t0, t1), riser: fl.first + k, flight: fi, k, t0, t1 });
        }
      });
      L_.landings.forEach(ld => out.push({ rect: laneRect(st, ld.u0, ld.u1, ld.v0, ld.v1), riser: ld.h, landing: ld }));
      return out;
    }
    const isCantilever = st => st.style === 'cantilever';
    const TREAD_T = 0.06;
    // can something h metres tall stand at rect R_ under this staircase?
    function stairAllowsUnder(st, R_, h) {
      const cellsHit = stairCells(st).some(([r, c]) => rectsOverlap(R_, { x0: c, x1: c + 1, y0: r, y1: r + 1 }));
      if (!cellsHit) return true;
      if (!isCantilever(st)) return false;
      return stairTreads(st).every(t => !rectsOverlap(R_, t.rect) || h <= t.riser * LEVEL_H / RISERS - (t.landing ? 0.1 : TREAD_T) - 0.03);
    }
    const stairCellRects = st => stairCells(st).map(([r, c]) => ({ x0: c, x1: c + 1, y0: r, y1: r + 1 }));
    const cellSet = cells => new Set(cells.map(([r, c]) => r + ',' + c));
    // squares of level L taken by stairs, and squares that are holes (stairs from below)
    function stairSquares(L) { const s = new Set(); if (state.floors[L]) state.floors[L].stairs.forEach(st => stairCells(st).forEach(([r, c]) => s.add(r + ',' + c))); return s; }
    const holeSquares = L => (L - 1 >= MIN_LEVEL ? stairSquares(L - 1) : new Set());
    // lines of level L that must stay empty: they would cut through a flight or a stair hole
    function blockedEdges(L) {
      const b = new Set();
      [L, L - 1].forEach(l => { if (state.floors[l]) state.floors[l].stairs.forEach(s => stairCrossEdges(s).forEach(k => b.add(k))); });
      // no wall through furniture or appliances, and a wall with a shelf on it stays a wall
      if (state.floors[L]) state.floors[L].furniture.forEach(f => { if (hung(f)) b.add(f.ek); });
      allRects(L).forEach(R_ => {
        for (let r = Math.floor(R_.y0); r <= Math.ceil(R_.y1); r++) for (let c = Math.floor(R_.x0); c <= Math.ceil(R_.x1); c++) {
          if (rectsOverlap(R_, { x0: c - T / 2, x1: c + 1 + T / 2, y0: r - T / 2, y1: r + T / 2 })) b.add(key('h', r, c));
          if (rectsOverlap(R_, { x0: c - T / 2, x1: c + T / 2, y0: r - T / 2, y1: r + 1 + T / 2 })) b.add(key('v', r, c));
        }
      });
      // a pool: nothing across its water on the ground floor; nothing at all
      // on or inside its outline on any basement level below it
      const ps = poolSquares();
      if (ps.size && L <= 0) ps.forEach(sq => {
        const [r, c] = sq.split(',').map(Number);
        [key('h', r, c), key('h', r + 1, c), key('v', r, c), key('v', r, c + 1)].forEach(k => {
          if (L < 0) { b.add(k); return; }
          const e = parseKey(k), A = e.o === 'h' ? (e.r - 1) + ',' + e.c : e.r + ',' + (e.c - 1);
          if (ps.has(A) && ps.has(e.r + ',' + e.c)) b.add(k);
        });
      });
      return b;
    }
    /* ═══════════════ SWIMMING POOLS ═══════════════
       A pool is { c0, r0, c1, r1 } in whole squares (c1, r1 exclusive) on
       the ground floor. It is dug into the ground, so the squares under it
       are off limits on every basement level (B1F and any deeper ones). */
    const POOL_DEPTH = 1.45;
    const poolCellsOf = q => { const out = []; for (let r = q.r0; r < q.r1; r++) for (let c = q.c0; c < q.c1; c++) out.push(r + ',' + c); return out; };
    function poolSquares(list) { const s2 = new Set(); (list || state.floors[0].pools).forEach(q => poolCellsOf(q).forEach(k => s2.add(k))); return s2; }
    function poolIndexAt(w) {
      if (state.level !== 0) return -1;
      const r = Math.floor(w.y), c = Math.floor(w.x);
      return state.floors[0].pools.findIndex(q => r >= q.r0 && r < q.r1 && c >= q.c0 && c < q.c1);
    }
    // a column spot that would stand in the water (not on the pool's edge)
    function colInPool(k, ps) {
      const [X, Y] = colXY(k);
      if (X % 2) return ps.has(((Y - 1) / 2) + ',' + ((X - 1) / 2));
      const c = X / 2, r = Y / 2;
      return [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]].every(([rr, cc]) => ps.has(rr + ',' + cc));
    }
    function poolValid(q) {
      if (state.level !== 0 || q.c1 <= q.c0 || q.r1 <= q.r0) return false;
      const mine = new Set(poolCellsOf(q));
      if (state.floors[0].pools.some(o => poolCellsOf(o).some(k => mine.has(k)))) return false;
      const G = state.floors[0];
      for (const k of G.edges.keys()) {   // nothing may stand across the water
        const e = parseKey(k), A = e.o === 'h' ? (e.r - 1) + ',' + e.c : e.r + ',' + (e.c - 1);
        if (mine.has(A) && mine.has(e.r + ',' + e.c)) return false;
      }
      if ([...G.columns].some(k => colInPool(k, mine))) return false;
      if ([...stairSquares(0), ...holeSquares(0)].some(k => mine.has(k))) return false;
      if (allRects(0).some(r2 => [...mine].some(k => rectsOverlap(r2, cellRect(k))))) return false;
      for (const L of LEVELS) {             // and the basement under it must be empty
        if (L >= 0) continue;
        const F = state.floors[L];
        for (const k of F.edges.keys()) {
          const e = parseKey(k), A = e.o === 'h' ? (e.r - 1) + ',' + e.c : e.r + ',' + (e.c - 1);
          if (mine.has(A) || mine.has(e.r + ',' + e.c)) return false;
        }
        if ([...F.columns].some(k => colTouches(k, mine))) return false;
        if ([...stairSquares(L)].some(k => mine.has(k))) return false;
      }
      return true;
    }
    function stairValid(s, L, ignoreIdx = -1) {
      if (L >= MAX_LEVEL) return false;
      const cells = stairCells(s);
      if (cells.some(([r, c]) => r < 0 || r >= state.ROWS || c < 0 || c >= state.COLS)) return false;
      const mine = cellSet(cells);
      if (L <= 0) { const ps = poolSquares(); if ([...mine].some(k => ps.has(k))) return false; }   // not in or under a pool
      // no furniture on the flight, or round the hole it makes upstairs (small things may sit under a cantilever one)
      const crs = stairCellRects(s), hitsMe = r2 => crs.some(c2 => rectsOverlap(c2, r2));
      if (state.floors[L].furniture.some(f => hitsMe(furnRect(f)))) return false;
      if ((state.floors[L].appliances || []).some(a => a.type !== 'rug' && !stairAllowsUnder(s, applRect(a), APPL[a.type].h))) return false;
      if (allRects(L + 1).some(hitsMe)) return false;
      const clash = (list, skip) => list.some((o, i) => i !== skip && stairCells(o).some(([r, c]) => mine.has(r + ',' + c)));
      if (clash(state.floors[L].stairs, ignoreIdx)) return false;                         // other stairs here
      if (L - 1 >= MIN_LEVEL && clash(state.floors[L - 1].stairs, -1)) return false;      // a hole from below
      if (clash(state.floors[L + 1].stairs, -1)) return false;                            // stairs above, over the hole
      const cross = stairCrossEdges(s);
      if (cross.some(k => state.floors[L].edges.has(k) || state.floors[L + 1].edges.has(k))) return false;
      // no column on the flight (or around the hole it makes above)
      if ([L, L + 1].some(l => [...state.floors[l].columns].some(k => colTouches(k, mine)))) return false;
      return true;
    }
    // does column k overlap any of the squares in the set?
    function colTouches(k, squares) {
      const [X, Y] = colXY(k);
      if (X % 2) return squares.has(((Y - 1) / 2) + ',' + ((X - 1) / 2));      // middle of a square
      const c = X / 2, r = Y / 2;                                                // corner: its four squares
      return [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]].some(([rr, cc]) => squares.has(rr + ',' + cc));
    }
    function colValid(k, L) {
      if (state.floors[L].columns.has(k)) return false;
      const [X, Y] = colXY(k);
      if (X < 0 || Y < 0 || X > 2 * state.COLS || Y > 2 * state.ROWS || (X % 2) !== (Y % 2)) return false;
      const busy = new Set([...stairSquares(L), ...holeSquares(L)]);
      if (colTouches(k, busy)) return false;
      const ps = poolSquares();
      if (L < 0 && colTouches(k, ps)) return false;
      if (L === 0 && colInPool(k, ps)) return false;
      if (allRects(L).some(r2 => rectsOverlap(r2, colFootprint(k)))) return false;
      return true;
    }
    // nearest column spot (corner or middle of a square) to a point
    function nearestColSpot(x, y) {
      const corner = [Math.round(x), Math.round(y)], mid = [Math.floor(x) + 0.5, Math.floor(y) + 0.5];
      const d = ([px, py]) => Math.hypot(px - x, py - y);
      const [px, py] = d(corner) <= d(mid) ? corner : mid;
      if (px < 0 || py < 0 || px > state.COLS || py > state.ROWS || d([px, py]) > 0.5) return null;
      return colKey(px * 2, py * 2);
    }
    function stairIndexAt(L, x, y) {
      const r = Math.floor(y), c = Math.floor(x);
      return state.floors[L].stairs.findIndex(s => stairCells(s).some(([sr, sc]) => sr === r && sc === c));
    }
  
    /* ═══════════════ ROOMS ═══════════════
       A room is a group of squares closed in by walls, doors or windows.
       Flood from the outside first; whatever is left over is indoors. */
    const isIndoorEdge = v => v.type !== 'fence';
    function computeRooms(edges, blocks = () => true) {
      const closed = k => { const v = edges.get(k); return !!v && blocks(v); };
      const id = new Int32Array(state.ROWS * state.COLS).fill(-1);
      const OUT = -2;
      const idx = (r, c) => r * state.COLS + c;
      const exits = (r, c) => [
        [r - 1, c, key('h', r, c)], [r + 1, c, key('h', r + 1, c)],
        [r, c - 1, key('v', r, c)], [r, c + 1, key('v', r, c + 1)]
      ];
      const inGrid = (r, c) => r >= 0 && r < state.ROWS && c >= 0 && c < state.COLS;
      const flood = (queue, mark) => {
        while (queue.length) {
          const [r, c] = queue.pop();
          for (const [nr, nc, k] of exits(r, c)) {
            if (!inGrid(nr, nc) || closed(k) || id[idx(nr, nc)] !== -1) continue;
            id[idx(nr, nc)] = mark; queue.push([nr, nc]);
          }
        }
      };
      const outside = [];
      for (let r = 0; r < state.ROWS; r++) for (let c = 0; c < state.COLS; c++) {
        if (id[idx(r, c)] !== -1) continue;
        const open = exits(r, c).some(([nr, nc, k]) => !inGrid(nr, nc) && !closed(k));
        if (open) { id[idx(r, c)] = OUT; outside.push([r, c]); }
      }
      flood(outside, OUT);
      const rooms = [];
      for (let r = 0; r < state.ROWS; r++) for (let c = 0; c < state.COLS; c++) {
        if (id[idx(r, c)] !== -1) continue;
        const n = rooms.length;
        id[idx(r, c)] = n;
        flood([[r, c]], n);
        rooms.push({ cells: [] });
      }
      for (let r = 0; r < state.ROWS; r++) for (let c = 0; c < state.COLS; c++) {
        const v = id[idx(r, c)]; if (v >= 0) rooms[v].cells.push([r, c]);
      }
      // label square: the room square closest to the room's centre
      rooms.forEach(rm => {
        let sr = 0, sc = 0; rm.cells.forEach(([r, c]) => { sr += r; sc += c; });
        const cr = sr / rm.cells.length, cc = sc / rm.cells.length;
        let best = rm.cells[0], bd = Infinity;
        rm.cells.forEach(([r, c]) => { const d = (r - cr) ** 2 + (c - cc) ** 2; if (d < bd) { bd = d; best = [r, c]; } });
        rm.label = best;
      });
      return { id, rooms, inRoom: (r, c) => inGrid(r, c) && id[idx(r, c)] >= 0 };
    }
    /* Indoor rooms are closed in by walls, doors and windows. Counting
       fences too finds the extra spaces a fence closes off; those that are
       not already indoors are the fenced areas (garden or balcony), kept on
       the indoor result as .fenced. */
    function computeAreas(edges) {
      const indoor = computeRooms(edges, isIndoorEdge);
      const all = computeRooms(edges);
      const rooms = all.rooms.filter(rm => !indoor.inRoom(rm.cells[0][0], rm.cells[0][1]));
      const set = new Set(); rooms.forEach(rm => rm.cells.forEach(([r, c]) => set.add(r + ',' + c)));
      indoor.fenced = { rooms, inRoom: (r, c) => set.has(r + ',' + c) };
      return indoor;
    }
    const EMPTY_ROOMS = { rooms: [], inRoom: () => false, fenced: { rooms: [], inRoom: () => false } };
  
    // A new door opens into the room it belongs to, if one side is indoors.
    function defaultSwing(o, r, c) {
      const eff = new Map(cur()); eff.set(key(o, r, c), { type: 'door' });
      const rm = computeRooms(eff, isIndoorEdge);
      const plus = rm.inRoom(r, c);
      const minus = o === 'h' ? rm.inRoom(r - 1, c) : rm.inRoom(r, c - 1);
      return (minus && !plus) ? 2 : 0;
    }
  
    /* ═══════════════ PREVIEW STATE ═══════════════
       What a level looks like right now, with any live preview applied.
       Previews only ever touch the current level. */
    function displayState(L) {
      const base = state.floors[L];
      const stairs = base.stairs.map(s => ({ s, cls: '' }));
      const p = L === state.level ? (state.pending || state.hoverPending) : null;
      const columns = [...base.columns].map(k => ({ k, cls: '' }));
      if (p && p.colDel) { const c = columns.find(o => o.k === p.colDel); if (c) c.cls = 'gone'; }
      if (p && p.colAdd) columns.push({ k: p.colAdd.k, cls: p.colAdd.bad ? 'gone' : 'ghost', bad: p.colAdd.bad });
      let colStyles = base.colStyles;
      if (p && p.colMove) {   // moving a column: it leaves its old spot and shows up at the new one
        const { from, to, bad } = p.colMove, i = columns.findIndex(o => o.k === from);
        if (i >= 0) columns.splice(i, 1);
        columns.push({ k: to, cls: bad ? 'gone' : 'ghost', bad });
        if (!bad && base.colStyles.has(from)) { colStyles = new Map(base.colStyles); colStyles.set(to, base.colStyles.get(from)); }
      }
      // every column shown (even one being erased) shapes the walls around it — but not one that can't go there
      const colSet = new Set(columns.filter(o => !o.bad).map(o => o.k));
      const roofs = base.roofs.map((r, idx) => ({ r, cls: '', idx }));
      if (p && p.roofDel != null && roofs[p.roofDel]) roofs[p.roofDel].cls = 'gone';
      if (p && p.roofSet) roofs[p.roofSet.idx] = { r: p.roofSet.r, cls: p.roofSet.bad ? 'gone' : 'ghost', idx: p.roofSet.idx };
      if (p && p.roofAdd) roofs.push({ r: p.roofAdd.r, cls: p.roofAdd.bad ? 'gone' : 'ghost', idx: -1 });
      const furniture = (base.furniture || []).map((f, idx) => ({ f, cls: '', idx }));
      if (p && p.furnDel != null && furniture[p.furnDel]) furniture[p.furnDel].cls = 'gone';
      if (p && p.furnSet) furniture[p.furnSet.idx] = { f: p.furnSet.f, cls: p.furnSet.bad ? 'gone' : 'ghost', idx: p.furnSet.idx };
      if (p && p.furnAdd) furniture.push({ f: p.furnAdd.f, cls: p.furnAdd.bad ? 'gone' : 'ghost', idx: -1 });
      if (p && p.furnAdds) p.furnAdds.forEach(fa => furniture.push({ f: fa.f, cls: fa.bad ? 'gone' : 'ghost', idx: -1 }));
      if (p && p.furnSets) p.furnSets.forEach(fs => { furniture[fs.idx] = { f: fs.f, cls: 'ghost', idx: fs.idx }; });
      const appliances = (base.appliances || []).map((a, idx) => ({ a, cls: '', idx }));
      if (p && p.applDel != null && appliances[p.applDel]) appliances[p.applDel].cls = 'gone';
      if (p && p.applSet) appliances[p.applSet.idx] = { a: p.applSet.a, cls: p.applSet.bad ? 'gone' : 'ghost', idx: p.applSet.idx };
      if (p && p.applAdd) appliances.push({ a: p.applAdd.a, cls: p.applAdd.bad ? 'gone' : 'ghost', idx: -1 });
      const pools = (base.pools || []).map((q, idx) => ({ q, cls: '', idx }));
      if (p && p.poolDel != null && pools[p.poolDel]) pools[p.poolDel].cls = 'gone';
      if (p && p.poolAdd) pools.push({ q: p.poolAdd.q, cls: p.poolAdd.bad ? 'gone' : 'ghost', idx: -1 });
      if (!p) return { edges: base.edges, ghost: null, gone: null, stairs, columns, colSet, colStyles, roofs, pools, furniture, appliances };
      const edges = new Map(base.edges), ghost = new Set(), gone = new Map();
      if (p.edges) p.edges.forEach((v, k) => {
        if (v === null) { if (base.edges.has(k)) { gone.set(k, base.edges.get(k)); edges.delete(k); } }
        else { edges.set(k, v); ghost.add(k); }
      });
      if (p.stairDel != null && stairs[p.stairDel]) stairs[p.stairDel].cls = 'gone';
      if (p.stairSet) stairs[p.stairSet.idx] = { s: p.stairSet.s, cls: 'ghost' };
      if (p.stairAdd) stairs.push({ s: p.stairAdd.s, cls: p.stairAdd.bad ? 'gone' : 'ghost' });
      return { edges, ghost, gone, stairs, columns, colSet, colStyles, roofs, pools, furniture, appliances };
    }
  
    // Corner posts: one at every grid corner touched by a wall piece.
    // Corners touched only by fences get a slim fence post instead.
    function postList(st) {
      const posts = new Map();   // "x,y" → 'solid' | 'ghost' | 'gone'
      const walled = wallVerts(st);
      const touch = (k, kind) => {
        const e = parseKey(k);
        edgeEnds(e.o, e.r, e.c).forEach(([x, y]) => {
          const pk = x + ',' + y, was = posts.get(pk);
          if (kind === 'gone') { if (!was) posts.set(pk, 'gone'); }
          else if (kind === 'solid' || was === 'solid') posts.set(pk, 'solid');
          else posts.set(pk, 'ghost');
        });
      };
      st.edges.forEach((v, k) => touch(k, st.ghost && st.ghost.has(k) ? 'ghost' : 'solid'));
      if (st.gone) st.gone.forEach((v, k) => touch(k, 'gone'));
      if (st.colSet) st.colSet.forEach(k => { const [X, Y] = colXY(k); posts.delete((X / 2) + ',' + (Y / 2)); });
      posts.fenceOnly = new Set([...posts.keys()].filter(pk => !walled.has(pk)));
      return posts;
    }
    // grid corners touched by a wall, door or window (not just fences)
    function wallVerts(st) {
      if (st._wv) return st._wv;
      const wv = new Set();
      const add = (v, k) => { if (v.type === 'fence') return; const e = parseKey(k); edgeEnds(e.o, e.r, e.c).forEach(([x, y]) => wv.add(x + ',' + y)); };
      st.edges.forEach(add);
      if (st.gone) st.gone.forEach(add);
      return (st._wv = wv);
    }
  
    /* ═══════════════ GEOMETRY (world, metres) ═══════════════ */
    // How far a wall piece stops short of each of its two corners: half a
    // wall at a plain corner post, half a column where a column stands.
    // A fence stops at a slim fence post unless a wall post is there.
    function edgeInsets(o, r, c, st, fence) {
      const [[x0, y0], [x1, y1]] = edgeEnds(o, r, c);
      const cs = st && st.colSet, wv = fence ? wallVerts(st) : null;
      const at = (x, y) => (cs && cs.has(colKey(2 * x, 2 * y))) ? COL_W / 2
        : (fence && !wv.has(x + ',' + y)) ? FPOST / 2 : T / 2;
      return [at(x0, y0), at(x1, y1)];
    }
    function segFootprint(o, r, c, st, fence) {
      const [i0, i1] = edgeInsets(o, r, c, st, fence), h = (fence ? FENCE_T : T) / 2;
      return o === 'h'
        ? { x0: c + i0, x1: c + 1 - i1, y0: r - h, y1: r + h }
        : { x0: c - h, x1: c + h, y0: r + i0, y1: r + 1 - i1 };
    }
    const colFootprint = k => { const [X, Y] = colXY(k), x = X / 2, y = Y / 2; return { x0: x - COL_W / 2, x1: x + COL_W / 2, y0: y - COL_W / 2, y1: y + COL_W / 2 }; };
    function thinAcross(fp, o, th) {
      if (o === 'h') { const m = (fp.y0 + fp.y1) / 2; return { x0: fp.x0, x1: fp.x1, y0: m - th / 2, y1: m + th / 2 }; }
      const m = (fp.x0 + fp.x1) / 2; return { x0: m - th / 2, x1: m + th / 2, y0: fp.y0, y1: fp.y1 };
    }
    // Door leaf standing open at 90°, hinged on the wall face.
    // The opening runs between the two jambs, so a column beside a door
    // makes the door a little narrower.
    /* A gate swings like a door, between the fence posts. Its leaf is a
       panel of the fence's own style; leaf is the footprint of the open leaf. */
    function gateGeom(o, r, c, swing, st) {
      const far = swing & 1, neg = (swing >> 1) & 1, [i0, i1] = edgeInsets(o, r, c, st, true);
      const W = 1 - i0 - i1 - 0.03, dir = neg ? -1 : 1, along = far ? -1 : 1, th = 0.06, off = FENCE_T / 2;
      if (o === 'h') {
        const hx = far ? c + 1 - i1 - 0.015 : c + i0 + 0.015;
        const leaf = { x0: Math.min(hx, hx + along * th), x1: Math.max(hx, hx + along * th), y0: Math.min(r + dir * off, r + dir * (off + W)), y1: Math.max(r + dir * off, r + dir * (off + W)) };
        return { hinge: [hx, r], tip: [hx, r + dir * W], shut: [hx + along * W, r], w: W, leaf, leafO: 'v' };
      }
      const hy = far ? r + 1 - i1 - 0.015 : r + i0 + 0.015;
      const leaf = { x0: Math.min(c + dir * off, c + dir * (off + W)), x1: Math.max(c + dir * off, c + dir * (off + W)), y0: Math.min(hy, hy + along * th), y1: Math.max(hy, hy + along * th) };
      return { hinge: [c, hy], tip: [c + dir * W, hy], shut: [c, hy + along * W], w: W, leaf, leafO: 'h' };
    }
    // the footprint an open door leaf or open gate takes up, if any
    function openLeaf(e, v, st) {
      if (v.type === 'door' && !v.closed) return leafFootprint(doorGeom(e.o, e.r, e.c, v.swing | 0, st));
      if (v.type === 'fence' && v.gate && v.open) return gateGeom(e.o, e.r, e.c, v.swing | 0, st).leaf;
      return null;
    }
    function doorGeom(o, r, c, swing, st) {
      const far = swing & 1, neg = (swing >> 1) & 1;
      const [i0, i1] = edgeInsets(o, r, c, st), W = 1 - i0 - i1;
      const dir = neg ? -1 : 1, along = far ? -1 : 1;
      if (o === 'h') {
        const hx = far ? c + 1 - i1 : c + i0;
        const hy = neg ? r - T / 2 : r + T / 2;
        return { hinge: [hx, hy], tip: [hx, hy + dir * W], shut: [hx + along * W, hy], w: W };
      }
      const hy = far ? r + 1 - i1 : r + i0;
      const hx = neg ? c - T / 2 : c + T / 2;
      return { hinge: [hx, hy], tip: [hx + dir * W, hy], shut: [hx, hy + along * W], w: W };
    }
    function leafFootprint(g) {
      const LT = 0.05, inset = 0.035;
      const [hx, hy] = g.hinge, [tx, ty] = g.tip;
      const ax = Math.sign(g.shut[0] - hx), ay = Math.sign(g.shut[1] - hy);
      const cx = hx + ax * inset, cy = hy + ay * inset;
      const ex = tx + ax * inset, ey = ty + ay * inset;
      return {
        x0: Math.min(cx, ex) - (ax ? LT / 2 : 0), x1: Math.max(cx, ex) + (ax ? LT / 2 : 0),
        y0: Math.min(cy, ey) - (ay ? LT / 2 : 0), y1: Math.max(cy, ey) + (ay ? LT / 2 : 0)
      };
    }
  
    /* ═══════════════ ISOMETRIC VIEW ═══════════════ */
    // Quarter-turn rotation of the world before projecting. Rotated
    // coordinates are (a, b); the viewer always looks from +a +b.
    function rotPt(x, y) {
      switch (state.rot) {
        case 1: return [state.ROWS - y, x];
        case 2: return [state.COLS - x, state.ROWS - y];
        case 3: return [y, state.COLS - x];
        default: return [x, y];
      }
    }
    function unrot(a, b) {
      switch (state.rot) {
        case 1: return { x: b, y: state.ROWS - a };
        case 2: return { x: state.COLS - a, y: state.ROWS - b };
        case 3: return { x: state.COLS - b, y: a };
        default: return { x: a, y: b };
      }
    }
    function rotBox(fp) {
      const p = rotPt(fp.x0, fp.y0), q = rotPt(fp.x1, fp.y1);
      return { a0: Math.min(p[0], q[0]), a1: Math.max(p[0], q[0]), b0: Math.min(p[1], q[1]), b1: Math.max(p[1], q[1]) };
    }
    const P = (a, b, z) => [(a - b) * HW, (a + b) * HH - z * ZS];
    const pts = arr => arr.map(([a, b, z]) => { const [x, y] = P(a, b, z); return x.toFixed(2) + ',' + y.toFixed(2); }).join(' ');
  
    // World side that a rotated face looks toward: the +a face and the +b face.
    function worldSide(axis) { return (axis === 'a' ? ['xp', 'ym', 'xm', 'yp'] : ['yp', 'xp', 'ym', 'xm'])[state.rot]; }
    const W = (x, y, z) => { const [a, b] = rotPt(x, y); const [sx, sy] = P(a, b, z); return sx.toFixed(2) + ' ' + sy.toFixed(2); };
    // a vertical face of a box, addressed by world side, with t running along it (metres)
    /* The linear (shear/scale) part of the affine map from a face's own local
       (t, z) — t a world coordinate along the wall, z a world height, both in
       metres — to final screen pixels, for a given world side. Only the linear
       part is needed: textures are tiled in world units via patternTransform,
       and SVG's own infinite tiling grid (anchored at world (0,0)) takes care
       of lining a wall segment up with its neighbours without a per-wall
       translation term. The two faces that share a world axis (yp/ym both vary
       t as world x; xp/xm both vary it as world y) share one matrix — only the
       fixed coordinate differs, and that is exactly the translation this
       intentionally leaves out. */
    function sideMatrix(side) {
      const onX = side === 'yp' || side === 'ym';  // t runs along world x (else world y)
      const d = [[[1, 0], [0, 1], [-1, 0], [0, -1]], [[0, 1], [-1, 0], [0, -1], [1, 0]]][onX ? 0 : 1][state.rot];
      const dxdt = (d[0] - d[1]) * HW, dydt = (d[0] + d[1]) * HH;
      return `matrix(${dxdt.toFixed(3)},${dydt.toFixed(3)},0,${(-ZS).toFixed(3)},0,0)`;
    }
    const TEX_SIDES = ['yp', 'ym', 'xp', 'xm'];
    // one small tileable pattern per (material, side): same visual period as the old per-course
    // lines, but the browser repeats one tiny tile instead of this app stroking hundreds of them
    function texturePatternDefs() {
      const tile = (mat, w, h, inner) => TEX_SIDES.map(side =>
        `<pattern id="pat-${mat}-${side}" patternUnits="userSpaceOnUse" width="${w}" height="${h}" patternTransform="${sideMatrix(side)}">${inner}</pattern>`).join('');
      let d = '';
      // vector-effect:non-scaling-stroke doesn't play well with a sheared patternTransform
      // (the isometric faces are sheared, not just scaled), so each stroke-width here is
      // pre-shrunk by the transform's own scale instead, to land back around the original
      // ~0.7-1px screen width: ÷HW-ish (≈35.8) for a world-plane line, ÷ZS (≈39.2) for a
      // vertical one — close enough together that one approximate divisor (37) suits both.
      // a plain stroke-width ATTRIBUTE loses to the .pat-X class's own stroke-width in the
      // cascade, so it has to go in style="" instead, which outranks a class selector
      const sw = px => `style="stroke-width:${(px / 37).toFixed(4)}"`;
      d += tile('lap', 1, 0.2, `<path class="pat-lap" d="M0 .2H1" ${sw(1)}/>`);
      d += tile('vert', 0.15, 1, `<path class="pat-vert" d="M.15 0V1" ${sw(0.9)}/>`);
      d += tile('board', 0.12, 1, `<path class="pat-board" d="M.12 0V1" ${sw(0.7)}/>`);
      d += tile('ctile', 0.2, 0.2, `<path class="pat-ctile" d="M.2 0V.2H0" ${sw(0.7)}/>`);
      // running bond: a 2-course-tall tile, the lower course's joint offset by half a brick
      d += tile('brick', 0.3, 0.3, `<path class="pat-brick" d="M0 0H.3M0 .15H.3M0 0V.15M.15 .15V.3" ${sw(0.8)}/>`);
      return d;
    }
    function faceWorld(bx, side) {
      switch (side) {
        case 'yp': return { t0: bx.x0, t1: bx.x1, pt: (t, z) => W(t, bx.y1, z) };
        case 'ym': return { t0: bx.x0, t1: bx.x1, pt: (t, z) => W(t, bx.y0, z) };
        case 'xp': return { t0: bx.y0, t1: bx.y1, pt: (t, z) => W(bx.x1, t, z) };
        default:   return { t0: bx.y0, t1: bx.y1, pt: (t, z) => W(bx.x0, t, z) };
      }
    }
    /* Surface textures: a rectangle over the face, the same shape the base
       polygon already uses, filled with that material's tiled pattern (see
       texturePatternDefs) instead of hundreds of individually stroked course
       lines. The pattern is anchored to world coordinates, so courses and
       boards still line up from one piece of wall to the next. */
    function textureSVG(mat, bx, side) {
      if (!['lap', 'ctile', 'vert', 'board', 'brick'].includes(mat)) return '';
      const f = faceWorld(bx, side);
      const q = [f.pt(f.t0, bx.z0), f.pt(f.t1, bx.z0), f.pt(f.t1, bx.z1), f.pt(f.t0, bx.z1)];
      return `<polygon fill="url(#pat-${mat}-${side})" points="${q.join(' ')}"/>`;
    }
    /* Decorations drawn on the long visible face of a box (door panels,
       window frames, fence infill). They are symmetric, so u (0…1 across the
       face) can run either way. */
    function decoSVG(kind, face, bx) {
      const L = face.len, rel = z => bx.z0 + z;
      // (clipped to the box, so a door cut down by the walls-down / cutout modes doesn't keep floating glass)
      const quad = (u0, u1, z0, z1, cls) => {
        z1 = Math.min(z1, bx.z1 - 0.03);
        if (z1 <= z0 + 0.02) return '';
        return `<polygon class="${cls}" points="${[face.pt(u0, z0), face.pt(u1, z0), face.pt(u1, z1), face.pt(u0, z1)].map(q => q.replace(' ', ',')).join(' ')}"/>`;
      };
      const line = (u0, z0, u1, z1) => `M${face.pt(u0, z0)}L${face.pt(u1, z1)}`;
      switch (kind) {
        case 'tv': return quad(0.025, 0.975, bx.z0 + 0.03, bx.z1 - 0.025, 'deco-screen') + `<path class="deco-shine" d="${line(0.12, bx.z1 - 0.09, 0.32, bx.z0 + 0.12)}"/>`;
        case 'mw': return quad(0.06, 0.66, bx.z0 + 0.05, bx.z1 - 0.05, 'deco-mwwin') + quad(0.72, 0.94, bx.z0 + 0.07, bx.z1 - 0.07, 'deco-mwpad');
        case 'cab': return quad(0.025, 0.49, bx.z0 + 0.07, bx.z1 - 0.04, 'deco-cabdoor') + quad(0.51, 0.975, bx.z0 + 0.07, bx.z1 - 0.04, 'deco-cabdoor') +
          `<path class="deco-handle" d="${line(0.45, bx.z1 - 0.2, 0.45, bx.z1 - 0.32)}${line(0.55, bx.z1 - 0.2, 0.55, bx.z1 - 0.32)}"/>`;
        case 'fridge': { const m = bx.z0 + (bx.z1 - bx.z0) * 0.32; return `<path class="deco-vent" d="${line(0.04, m, 0.96, m)}${line(0.3, bx.z0 + 0.06, 0.3, m - 0.04)}${line(0.3, m + 0.04, 0.3, bx.z1 - 0.06)}"/>`; }
        case 'washerdoor': { const cz = (bx.z0 + bx.z1) / 2 + (bx.z1 - bx.z0) * 0.05, r3 = (bx.z1 - bx.z0) * 0.28, q = [], q2 = [];
          for (let i = 0; i < 24; i++) { const th = i / 24 * Math.PI * 2; q.push(face.pt(0.5 + r3 / L * Math.cos(th), cz + r3 * Math.sin(th)).replace(' ', ',')); q2.push(face.pt(0.5 + r3 * 0.7 / L * Math.cos(th), cz + r3 * 0.7 * Math.sin(th)).replace(' ', ',')); }
          return `<polygon class="deco-porthole" points="${q.join(' ')}"/><polygon class="deco-porthole-in" points="${q2.join(' ')}"/>` + quad(0.12, 0.88, bx.z1 - 0.12, bx.z1 - 0.06, 'deco-vent'); }
        case 'dryerdoor': { const cz = (bx.z0 + bx.z1) / 2 + (bx.z1 - bx.z0) * 0.05, r3 = (bx.z1 - bx.z0) * 0.26, q = [];
          for (let i = 0; i < 24; i++) { const th = i / 24 * Math.PI * 2; q.push(face.pt(0.5 + r3 / L * Math.cos(th), cz + r3 * Math.sin(th)).replace(' ', ',')); }
          return `<polygon class="deco-porthole" points="${q.join(' ')}"/>` + quad(0.12, 0.88, bx.z1 - 0.1, bx.z1 - 0.05, 'deco-vent'); }
        case 'gauge': {
          // the dial face as a properly projected ellipse (a circle on the wall, sampled through the face's own skew), not a screen circle
          const zc = (bx.z0 + bx.z1) / 2 + (bx.z1 - bx.z0) * 0.15, r3 = (bx.z1 - bx.z0) * 0.1125;
          const ring = []; for (let i = 0; i < 24; i++) { const th = i / 24 * Math.PI * 2; ring.push(face.pt(0.5 + r3 * Math.cos(th) / L, zc + r3 * Math.sin(th)).replace(' ', ',')); }
          const [gx, gy] = face.pt(0.5, zc).split(' ').map(Number), [nx, ny] = face.pt(0.5 + r3 * 0.6 / L, zc + r3 * 0.4).split(' ').map(Number);
          return `<polygon class="deco-gauge" points="${ring.join(' ')}"/><path class="deco-needle" d="M${gx} ${gy}L${nx.toFixed(1)} ${ny.toFixed(1)}"/>`;
        }
        case 'pump': return quad(0.1, 0.9, bx.z0 + 0.03, bx.z1 - 0.03, 'deco-vent');
        case 'oven': { const H = bx.z1 - bx.z0;
          return quad(0.1, 0.9, bx.z0 + H * 0.08, bx.z0 + H * 0.62, 'deco-ovenwin') + quad(0.08, 0.92, bx.z0 + H * 0.64, bx.z0 + H * 0.68, 'deco-vent') +
            [0.3, 0.5, 0.7].map(u => { const [cx, cy] = face.pt(u, bx.z0 + H * 0.82).split(' ').map(Number); return `<circle class="deco-knob" cx="${cx}" cy="${cy}" r="1.1"/>`; }).join('');
        }
        case 'spine': return quad(0.15, 0.85, bx.z1 - 0.06, bx.z1 - 0.04, 'deco-spine') + quad(0.15, 0.85, bx.z0 + 0.03, bx.z0 + 0.045, 'deco-spine');
        case 'mirror': return quad(0.06, 0.94, bx.z0 + 0.05, bx.z1 - 0.05, 'deco-mirror') + `<path class="deco-shine" d="${line(0.2, bx.z1 - 0.12, 0.42, bx.z0 + 0.15)}"/>`;
        case 'acwindow': { let d = ''; for (let u = 0.12; u < 0.98; u += 0.1) d += line(u, bx.z0 + 0.05, u, bx.z1 - 0.05); return `<path class="deco-vent" d="${d}"/>` + `<circle class="deco-led" cx="${face.pt(0.88, bx.z1 - 0.08).split(' ')[0]}" cy="${face.pt(0.88, bx.z1 - 0.08).split(' ')[1]}" r="1.3"/>`; }
        case 'acsplit': { let d = ''; for (let z = bx.z0 + 0.03; z < bx.z1 - 0.02; z += 0.025) d += line(0.05, z, 0.95, z); return `<path class="deco-vent" d="${d}"/>` + `<circle class="deco-led" cx="${face.pt(0.9, bx.z1 - 0.04).split(' ')[0]}" cy="${face.pt(0.9, bx.z1 - 0.04).split(' ')[1]}" r="1.1"/>`; }
        case 'fan': {
          // the fan ring and each blade's outer tip as points on the same projected ellipse, not a screen circle
          const zc = (bx.z0 + bx.z1) / 2, r2 = (bx.z1 - bx.z0) * 0.4;
          const pOn = (k, th) => face.pt(0.5 + k * r2 * Math.cos(th) / L, zc + k * r2 * Math.sin(th));
          const ring = []; for (let i = 0; i < 24; i++) { const th = i / 24 * Math.PI * 2; ring.push(pOn(1, th).replace(' ', ',')); }
          const [fx, fy] = face.pt(0.5, zc).split(' ').map(Number);
          const blades = [0, 1, 2].map(i => {
            const th = i * Math.PI * 2 / 3, [tx, ty] = pOn(0.8, th).split(' ').map(Number), [mx, my] = pOn(0.8, th + 1).split(' ').map(Number);
            return `<path class="deco-fanblade" d="M${fx} ${fy}L${tx.toFixed(1)} ${ty.toFixed(1)}Q${((tx + mx) / 2 + (fx - (tx + mx) / 2) * 0.3).toFixed(1)} ${((ty + my) / 2 + (fy - (ty + my) / 2) * 0.3).toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}Z"/>`;
          }).join('');
          return `<polygon class="deco-fanring" points="${ring.join(' ')}"/>` + blades;
        }
        case 'radiator': { let d = ''; for (let u = 0.08; u < 0.97; u += 0.085) d += line(u, bx.z0 + 0.04, u, bx.z1 - 0.04); return `<path class="deco-vent" d="${d}"/>`; }
        case 'dresser': {
          // three rows of drawers, two side by side in each, with a knob on each
          const H = bx.z1 - bx.z0, rows = 3; let o = '', d = '';
          for (let i = 0; i < rows; i++) {
            const za = bx.z0 + 0.04 + i * (H - 0.08) / rows, zb = bx.z0 + 0.04 + (i + 1) * (H - 0.08) / rows - 0.02, zm = (za + zb) / 2;
            o += quad(0.04, 0.495, za, zb, 'deco-cabdoor') + quad(0.505, 0.96, za, zb, 'deco-cabdoor');
            d += line(0.25, zm, 0.29, zm) + line(0.71, zm, 0.75, zm);
          }
          return o + `<path class="deco-handle" d="${d}"/>`;
        }
        case 'wardrobe': return quad(0.03, 0.495, bx.z0 + 0.04, bx.z1 - 0.05, 'deco-cabdoor') + quad(0.505, 0.97, bx.z0 + 0.04, bx.z1 - 0.05, 'deco-cabdoor') +
          `<path class="deco-handle" d="${line(0.46, bx.z0 + 0.95, 0.46, bx.z0 + 1.15)}${line(0.54, bx.z0 + 0.95, 0.54, bx.z0 + 1.15)}"/>`;
        case 'drawers': {
          const m = (bx.z0 + bx.z1) / 2;
          return quad(0.06, 0.94, bx.z0 + 0.05, m - 0.015, 'deco-cabdoor') + quad(0.06, 0.94, m + 0.015, bx.z1 - 0.04, 'deco-cabdoor') +
            `<path class="deco-handle" d="${line(0.42, (bx.z0 + m) / 2, 0.58, (bx.z0 + m) / 2)}${line(0.42, (m + bx.z1) / 2, 0.58, (m + bx.z1) / 2)}"/>`;
        }
        case 'ps2': { const H = bx.z1 - bx.z0; return quad(0.04, 0.96, bx.z0 + H * 0.5, bx.z0 + H * 0.56, 'deco-groove') + quad(0.82, 0.86, bx.z0 + H * 0.2, bx.z0 + H * 0.36, 'deco-btn') + quad(0.89, 0.93, bx.z0 + H * 0.2, bx.z0 + H * 0.36, 'deco-btn'); }
        case 'stereo': { const H = bx.z1 - bx.z0; return quad(0.12, 0.62, bx.z0 + H * 0.55, bx.z0 + H * 0.8, 'deco-display') + quad(0.7, 0.88, bx.z0 + H * 0.25, bx.z0 + H * 0.75, 'deco-knob'); }
        case 'speaker': {
          const H = bx.z1 - bx.z0, cone = (zc, r) => { const q = []; for (let i = 0; i < 20; i++) { const th = i / 20 * Math.PI * 2; q.push(face.pt(0.5 + r * Math.cos(th) / L, zc + r * Math.sin(th)).replace(' ', ',')); } return `<polygon class="deco-cone" points="${q.join(' ')}"/>`; };
          return cone(bx.z0 + H * 0.72, 0.035) + cone(bx.z0 + H * 0.33, 0.055);
        }
        case 'lcd': return quad(0.04, 0.96, bx.z0 + 0.03, bx.z1 - 0.015, 'deco-screen');
        case 'tower': { const H = bx.z1 - bx.z0; return quad(0.12, 0.88, bx.z1 - 0.09, bx.z1 - 0.065, 'deco-groove') + quad(0.12, 0.88, bx.z1 - 0.13, bx.z1 - 0.105, 'deco-groove') + quad(0.42, 0.58, bx.z0 + H * 0.35, bx.z0 + H * 0.4, 'deco-btn'); }
        case 'mullion': return `<path class="deco-frame" d="${line(0.5, bx.z0, 0.5, bx.z1)}"/>`;
        case 'transom': return `<path class="deco-frame" d="${line(0, bx.z1 - 0.35, 1, bx.z1 - 0.35)}"/>`;
        case 'halfglass': return quad(0.18, 0.82, rel(1.05), rel(1.9), 'deco-glass');
        case 'fullglass': return quad(0.15, 0.85, rel(0.25), rel(1.9), 'deco-glass');
        case 'louvered': {
          let d = '';
          for (let z = 0.2; z < 1.92 && rel(z) < bx.z1 - 0.04; z += 0.07) d += line(0.12, rel(z), 0.88, rel(z));
          return `<path class="deco-louver" d="${d}"/>`;
        }
  
        case 'lattice': case 'chain': {
          const sp = kind === 'lattice' ? 0.16 : 0.07, H = bx.z1 - bx.z0;
          let d = '';
          const seg = (s0, h0, s1, h1) => { d += line(s0 / L, bx.z0 + h0, s1 / L, bx.z0 + h1); };
          for (let c = -H; c < L; c += sp) {
            let h0 = Math.max(0, -c), h1 = Math.min(H, L - c); if (h1 > h0) seg(c + h0, h0, c + h1, h1);   // s = c + h
          }
          for (let c = 0; c < L + H; c += sp) {
            let h0 = Math.max(0, c - L), h1 = Math.min(H, c); if (h1 > h0) seg(c - h0, h0, c - h1, h1);    // s = c − h
          }
          return `<path class="${kind === 'lattice' ? 'deco-latt' : 'deco-chain'}" d="${d}"/>`;
        }
      }
      return '';
    }
    /* Floor finishes, drawn on a slab square's top in world coordinates so
       boards and tiles run on from square to square. */
    function floorPatternSVG(mat, bx) {
      let d = '';
      const ln = (x0, y0, x1, y1) => { d += `M${W(x0, y0, bx.z1)}L${W(x1, y1, bx.z1)}`; };
      const E = 0.004;
      if (mat === 'fwood') {
        const pw = 0.16, run = 1.2;
        for (let j = Math.floor(bx.y0 / pw); j * pw < bx.y1; j++) {
          const y = j * pw, ya = Math.max(y, bx.y0), yb = Math.min(y + pw, bx.y1);
          if (y > bx.y0 + E) ln(bx.x0, y, bx.x1, y);
          const off = (((j * 7) % 3) + 3) % 3 * 0.4;
          for (let x = Math.ceil((bx.x0 - off + E) / run) * run + off; x < bx.x1 - E; x += run) ln(x, ya, x, yb);
        }
      } else if (mat === 'burners') {
        // four burner rings: a circle on the top seen in 2:1 dimetric is an axis-aligned ellipse
        let o = '';
        const rr = 0.085, rx = Math.SQRT2 * rr * HW, ry = Math.SQRT2 * rr * HH;
        [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]].forEach(([fx, fy]) => {
          const [sx, sy] = scr(bx.x0 + fx * (bx.x1 - bx.x0), bx.y0 + fy * (bx.y1 - bx.y0), bx.z1);
          o += `<ellipse class="burner-in" cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" rx="${(rx * 0.55).toFixed(2)}" ry="${(ry * 0.55).toFixed(2)}"/><ellipse class="burner" cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}"/>`;
        });
        return o;
      } else if (mat === 'freezerlid') {
          const ix = 0.04, iy = 0.04, q = [[bx.x0 + ix, bx.y0 + iy], [bx.x1 - ix, bx.y0 + iy], [bx.x1 - ix, bx.y1 - iy], [bx.x0 + ix, bx.y1 - iy]];
          return `<polygon class="deco-cabdoor" style="fill:none" points="${q.map(([x, y]) => W(x, y, bx.z1).replace(' ', ',')).join(' ')}"/>`;
        } else if (mat === 'tanktop') {
          const cx2 = (bx.x0 + bx.x1) / 2, cy2 = (bx.y0 + bx.y1) / 2, hx = (bx.x1 - bx.x0) / 2, hy = (bx.y1 - bx.y0) / 2, q = [];
          for (let i = 0; i < 24; i++) { const th = i / 24 * Math.PI * 2; q.push(W(cx2 + Math.cos(th) * hx * 0.82, cy2 + Math.sin(th) * hy * 0.82, bx.z1).replace(' ', ',')); }
          return `<polygon class="deco-cabdoor" style="fill:none" points="${q.join(' ')}"/>`;
      } else if (mat === 'toilet' || mat === 'tub') {
        // an oval seat (or tub) opening fitted to the top, in world axes so it suits any turn
        const cx = (bx.x0 + bx.x1) / 2, cy = (bx.y0 + bx.y1) / 2, hx = (bx.x1 - bx.x0) / 2, hy = (bx.y1 - bx.y0) / 2;
        const oval = (k2, cls) => { const q = []; for (let i = 0; i < 28; i++) { const th = i / 28 * Math.PI * 2; q.push(W(cx + Math.cos(th) * hx * k2, cy + Math.sin(th) * hy * k2, bx.z1).replace(' ', ',')); } return `<polygon class="${cls}" points="${q.join(' ')}"/>`; };
        return mat === 'toilet' ? oval(0.9, 'seat') + oval(0.58, 'seat-in') : oval(0.86, 'tubin');
      } else if (mat === 'keys' || mat === 'rug' || mat === 'ps2' || mat === 'controller' || mat === 'toaster' || mat === 'cushion') {
        const inset = (mx, my) => [[bx.x0 + mx, bx.y0 + my], [bx.x1 - mx, bx.y0 + my], [bx.x1 - mx, bx.y1 - my], [bx.x0 + mx, bx.y1 - my]].map(([x, y]) => W(x, y, bx.z1).replace(' ', ',')).join(' ');
        const wx = bx.x1 - bx.x0, wy = bx.y1 - bx.y0;
        if (mat === 'keys') return `<polygon class="deco-keys" points="${inset(wx * 0.1, wy * 0.15)}"/>`;
        if (mat === 'rug') return `<polygon class="rug-border" points="${inset(0.1, 0.1)}"/><polygon class="rug-mid" points="${inset(wx * 0.32, wy * 0.32)}"/>`;
        if (mat === 'toaster') {
          const slot = (v0, v1) => [[bx.x0 + 0.15 * wx, bx.y0 + v0 * wy], [bx.x1 - 0.15 * wx, bx.y0 + v0 * wy], [bx.x1 - 0.15 * wx, bx.y0 + v1 * wy], [bx.x0 + 0.15 * wx, bx.y0 + v1 * wy]].map(([x, y]) => W(x, y, bx.z1).replace(' ', ',')).join(' ');
          return `<polygon class="deco-cabdoor" style="fill:#1c2024" points="${slot(0.15, 0.42)}"/><polygon class="deco-cabdoor" style="fill:#1c2024" points="${slot(0.58, 0.85)}"/>`;
        }
        if (mat === 'cushion') {
          const cx2 = (bx.x0 + bx.x1) / 2, cy2 = (bx.y0 + bx.y1) / 2;
          const seg = (u0, v0, u1, v1) => `M${W(bx.x0 + u0 * wx, bx.y0 + v0 * wy, bx.z1)}L${W(cx2, cy2, bx.z1)}L${W(bx.x0 + u1 * wx, bx.y0 + v1 * wy, bx.z1)}`;
          return `<path class="deco-fold" d="${seg(0.12, 0.12, 0.88, 0.12)}${seg(0.88, 0.12, 0.88, 0.88)}${seg(0.88, 0.88, 0.12, 0.88)}${seg(0.12, 0.88, 0.12, 0.12)}"/>` +
            `<circle class="deco-knob" cx="${W(cx2, cy2, bx.z1).split(' ')[0]}" cy="${W(cx2, cy2, bx.z1).split(' ')[1]}" r="1.3"/>`;
        }
        if (mat === 'controller') {
          // a small gamepad: body outline, two thumbstick nubs, a D-pad cross
          const cx2 = bx.x0 + wx * 0.5, cy2 = bx.y0 + wy * 0.5;
          const nub = (u, v, r4) => { const [x, y] = [cx2 + u * wx, cy2 + v * wy]; return `<circle class="deco-knob" cx="${W(x, y, bx.z1).split(' ')[0]}" cy="${W(x, y, bx.z1).split(' ')[1]}" r="${r4}"/>`; };
          return `<polygon class="deco-cabdoor" style="fill:#1b1d20" points="${inset(0.04, 0.1)}"/>` + nub(-0.22, 0, 1) + nub(0.22, 0, 1) + nub(0, -0.2, 0.7);
        }
        // PS2: ribs across half the top
        let o2 = '';
        const along = wx >= wy;
        for (let i = 1; i < 7; i++) {
          const t = i / 14;
          const a = along ? [bx.x0 + t * wx, bx.y0 + 0.01] : [bx.x0 + 0.01, bx.y0 + t * wy], b = along ? [bx.x0 + t * wx, bx.y1 - 0.01] : [bx.x1 - 0.01, bx.y0 + t * wy];
          o2 += `M${W(a[0], a[1], bx.z1)}L${W(b[0], b[1], bx.z1)}`;
        }
        return `<path class="pat-board" d="${o2}"/>`;
      } else if (mat === 'basin') {
        const ix = 0.07, iy = 0.08, q = [[bx.x0 + ix, bx.y0 + iy], [bx.x1 - ix, bx.y0 + iy], [bx.x1 - ix, bx.y1 - iy], [bx.x0 + ix, bx.y1 - iy]];
        return `<polygon class="basin" points="${q.map(([x, y]) => W(x, y, bx.z1).replace(' ', ',')).join(' ')}"/>`;
      } else if (mat === 'water') {
        // a few glints on the water, two per square
        const c = Math.floor(bx.x0 + 1e-6), r = Math.floor(bx.y0 + 1e-6);
        ln(c + 0.18, r + 0.32, c + 0.42, r + 0.32); ln(c + 0.58, r + 0.72, c + 0.84, r + 0.72);
      } else if (mat === 'ftile') {
        for (let x = Math.ceil((bx.x0 + E) / 0.5) * 0.5; x < bx.x1 - E; x += 0.5) if (Math.abs(x - Math.round(x)) > E) ln(x, bx.y0, x, bx.y1);
        for (let y = Math.ceil((bx.y0 + E) / 0.5) * 0.5; y < bx.y1 - E; y += 0.5) if (Math.abs(y - Math.round(y)) > E) ln(bx.x0, y, bx.x1, y);
      } else return '';
      return d ? `<path class="pat-${mat}" d="${d}"/>` : '';
    }
    /* A full round window is a real hole: the wall face (and its texture) is
       clipped with the circle cut out, so whatever was drawn behind the wall
       shows through, and a pane of see-through glass goes in the opening. */
    let clipSeq = 0;
    function holed(faceSVG, quad, len, pt, bx) {
      if (!bx.hole || len < 0.6) return faceSVG;
      const r = 0.36, zc = bx.decoZ, circ = [];
      for (let i = 0; i < 32; i++) { const th = i / 32 * Math.PI * 2; circ.push(pt(0.5 + r * Math.cos(th) / len, zc + r * Math.sin(th))); }
      const toD = q => 'M' + q.map(([x, y]) => x.toFixed(2) + ' ' + y.toFixed(2)).join('L') + 'Z';
      const id = 'rwin' + (++clipSeq);
      return `<clipPath id="${id}"><path clip-rule="evenodd" d="${toD(quad.map(v => P(...v)))}${toD(circ)}"/></clipPath><g clip-path="url(#${id})">${faceSVG}</g>` +
             `<polygon class="deco-roundglass" points="${circ.map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ')}"/>`;
    }
    // round column: a shaded body and an elliptical top (a circle seen in 2:1 dimetric)
    // same as cylSVG, but a plain flat-shaded cylinder in a given material (not a column)
    function cylMatSVG(bx) {
      const cx = (bx.x0 + bx.x1) / 2, cy = (bx.y0 + bx.y1) / 2, R2 = (bx.x1 - bx.x0) / 2;
      const [a, b] = rotPt(cx, cy), [sx, st] = P(a, b, bx.z1), sb = P(a, b, bx.z0)[1];
      const rx = Math.SQRT2 * R2 * HW, ry = Math.SQRT2 * R2 * HH;
      return `<path class="m-${bx.m} fr" d="M${(sx - rx).toFixed(2)} ${st.toFixed(2)}V${sb.toFixed(2)}A${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 0 ${(sx + rx).toFixed(2)} ${sb.toFixed(2)}V${st.toFixed(2)}Z"/>` +
             `<ellipse class="m-${bx.m} ft" cx="${sx.toFixed(2)}" cy="${st.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}"/>`;
    }
    // a leafy house plant: pointed leaves fanning up and out from the soil, drawn
    // in screen space (a leaf is a curve, not a box), back leaves darker
    const PLANT_LEAVES = [
      // [angle from upright (deg), length 0–1, half-width 0–1, face]
      [-60, 0.82, 0.3, 'fr'], [-22, 0.98, 0.28, 'fr'], [20, 0.94, 0.28, 'fr'], [58, 0.84, 0.3, 'fr'],
      [-84, 0.66, 0.32, 'fl'], [-42, 0.88, 0.3, 'fl'], [-2, 1.0, 0.27, 'ft'], [38, 0.86, 0.3, 'fl'], [82, 0.64, 0.32, 'ft']
    ];
    function plantSVG(bx) {
      const cx = (bx.x0 + bx.x1) / 2, cy = (bx.y0 + bx.y1) / 2;
      const [a, b] = rotPt(cx, cy), [sx, sy] = P(a, b, bx.z0);
      const H = (bx.z1 - bx.z0) * ZS, W = Math.SQRT2 * (bx.x1 - bx.x0) / 2 * HW;
      return PLANT_LEAVES.map(([deg, len, hw, face]) => {
        const t = deg * Math.PI / 180;
        const tx = sx + Math.sin(t) * W * len, ty = sy - Math.cos(t) * H * len;     // tip
        const dx = tx - sx, dy = ty - sy, L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L * L * hw, ny = dx / L * L * hw;                          // across the leaf
        const mx = sx + dx * 0.45, my = sy + dy * 0.45;                             // widest point
        const f = v => v.toFixed(2);
        return `<path class="m-${bx.m} ${face}" d="M${f(sx)} ${f(sy)}Q${f(mx + nx)} ${f(my + ny)} ${f(tx)} ${f(ty)}Q${f(mx - nx)} ${f(my - ny)} ${f(sx)} ${f(sy)}Z"/>` +
               `<path class="plant-vein" d="M${f(sx)} ${f(sy)}L${f(sx + dx * 0.8)} ${f(sy + dy * 0.8)}"/>`;
      }).join('');
    }
    function cylSVG(bx) {
      const cx = (bx.x0 + bx.x1) / 2, cy = (bx.y0 + bx.y1) / 2, R = (bx.x1 - bx.x0) / 2;
      const [a, b] = rotPt(cx, cy), [sx, st] = P(a, b, bx.z1), sb = P(a, b, bx.z0)[1];
      const rx = Math.SQRT2 * R * HW, ry = Math.SQRT2 * R * HH;
      return `<path class="cylbody" fill="url(#colGrad)" d="M${(sx - rx).toFixed(2)} ${st.toFixed(2)}V${sb.toFixed(2)}A${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 0 ${(sx + rx).toFixed(2)} ${sb.toFixed(2)}V${st.toFixed(2)}Z"/>` +
             `<ellipse class="m-col ft" cx="${sx.toFixed(2)}" cy="${st.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}"/>`;
    }
  
    // The three faces a box shows from this camera: the +b face (screen
    // left), the +a face (screen right), then the top. Optional extras:
    //   bx.mt   a different material for the top face
    //   bx.fm   materials per world side ({ xm, xp, ym, yp }) — wall finishes
    //   bx.deco a decoration for the long visible face
    //   bx.cyl  draw as a round column instead of a box
    function boxSVG(bx) {
      if (bx.plant) return plantSVG(bx);
      if (bx.cyl === 'mat') return cylMatSVG(bx);
      if (bx.cyl) return cylSVG(bx);
      const { a0, a1, b0, b1 } = rotBox(bx), z0 = bx.z0, z1 = bx.z1, mt = 'm-' + (bx.mt || bx.m);
      let s = '';
      if (!bx.topOnly) {
        const sb = worldSide('b'), sa = worldSide('a');
        const mb = (bx.fm && bx.fm[sb]) || bx.m, ma = (bx.fm && bx.fm[sa]) || bx.m;
        const flQ = [[a0, b1, z0], [a1, b1, z0], [a1, b1, z1], [a0, b1, z1]], frQ = [[a1, b0, z0], [a1, b1, z0], [a1, b1, z1], [a1, b0, z1]];
        const ptFl = (u, z) => P(a0 + u * (a1 - a0), b1, z), ptFr = (u, z) => P(a1, b0 + u * (b1 - b0), z);
        s += holed(`<polygon class="m-${mb} fl" points="${pts(flQ)}"/>` + textureSVG(mb, bx, sb), flQ, a1 - a0, ptFl, bx);
        if (bx.deco && a1 - a0 > 0.3) s += decoSVG(bx.deco, { len: a1 - a0, pt: (u, z) => { const [x, y] = P(a0 + u * (a1 - a0), b1, z); return x.toFixed(2) + ' ' + y.toFixed(2); } }, bx);
        s += holed(`<polygon class="m-${ma} fr" points="${pts(frQ)}"/>` + textureSVG(ma, bx, sa), frQ, b1 - b0, ptFr, bx);
        if (bx.deco && b1 - b0 > 0.3) s += decoSVG(bx.deco, { len: b1 - b0, pt: (u, z) => { const [x, y] = P(a1, b0 + u * (b1 - b0), z); return x.toFixed(2) + ' ' + y.toFixed(2); } }, bx);
        // front-only decorations (a screen, a microwave door, cabinet doors): only on the face that
        // is the front, and turned so the viewer's left is the front's left
        if (bx.fdeco) {
          const dA = [[1, 0], [0, -1], [-1, 0], [0, 1]][state.rot], dB = [[0, 1], [1, 0], [0, -1], [-1, 0]][state.rot];
          const deco = (len, ptf, n, uDir) => { const flip = uDir[0] * n[1] - uDir[1] * n[0] < 0; return decoSVG(bx.fdeco, { len, pt: (u, z) => ptf(flip ? 1 - u : u, z) }, bx); };
          if (sb === bx.front) s += deco(a1 - a0, (u, z) => { const [x, y] = P(a0 + u * (a1 - a0), b1, z); return x.toFixed(2) + ' ' + y.toFixed(2); }, dB, dA);
          if (sa === bx.front) s += deco(b1 - b0, (u, z) => { const [x, y] = P(a1, b0 + u * (b1 - b0), z); return x.toFixed(2) + ' ' + y.toFixed(2); }, dA, dB);
        }
      }
      if (!bx.sidesOnly) s += `<polygon class="${mt} ft" points="${pts([[a0, b0, z1], [a1, b0, z1], [a1, b1, z1], [a0, b1, z1]])}"/>` + (bx.tp ? floorPatternSVG(bx.tp, bx) : '');
      return s;
    }
  
    /* A staircase as drawables: one per tread or landing (solid blocks, or
       thin floating treads for cantilever), each carrying its handrail
       balusters, plus the stretch of sloping rail from it to the next one.
       Rails run along every open side; a side against a wall gets none. */
    /* The rails near the top of a flight rise above the floor of the storey
       above. That storey's floor is drawn after this whole storey, so those
       parts would be covered by it; instead, whatever is above that floor
       (split, in this storey's own heights) is handed to the storey above
       (stairUpper) and sorted with its things. */
    let stairUpper = {};
    function stairItems(s, cls, rise, L, box, si) {
      const riser = rise / RISERS, scale = rise / LEVEL_H, F = state.floors[L], lay = stairLayout(s), items = [];
      const split = L < state.level ? LEVEL_H : null, up = stairUpper[L + 1] || (stairUpper[L + 1] = []);
      const zL = baseZ(L);
      // a sloping rail stretch from (x1, y1, za) to (x2, y2, zb), local heights; the part above the split goes upstairs
      const railSeg = (x1, y1, za, x2, y2, zb) => {
        const seg = (ax, ay, a, bx2, by2, b) => { const [p1x, p1y] = scr(ax, ay, zL + a), [p2x, p2y] = scr(bx2, by2, zL + b); return `<path class="stair-rail" d="M${p1x.toFixed(2)} ${p1y.toFixed(2)}L${p2x.toFixed(2)} ${p2y.toFixed(2)}"/>`; };
        const upItem = (ax, ay, a, bx2, by2, b) => {
          const fp = { x0: Math.min(ax, bx2) - 0.01, x1: Math.max(ax, bx2) + 0.01, y0: Math.min(ay, by2) - 0.01, y1: Math.max(ay, by2) + 0.01 };
          const svg = seg(ax, ay, a, bx2, by2, b);
          up.push({ fp, cls, boxes: [{ ...fp, z0: zL + Math.min(a, b), z1: zL + Math.max(a, b) }], svg: () => svg });
        };
        if (split == null || Math.max(za, zb) <= split) return seg(x1, y1, za, x2, y2, zb);
        if (Math.min(za, zb) >= split) { upItem(x1, y1, za, x2, y2, zb); return ''; }
        const t = (split - za) / (zb - za), mx = x1 + (x2 - x1) * t, my = y1 + (y2 - y1) * t;
        if (za < zb) { upItem(mx, my, split, x2, y2, zb); return seg(x1, y1, za, mx, my, split); }
        upItem(x1, y1, za, mx, my, split); return seg(mx, my, split, x2, y2, zb);
      };
      // is there a wall (not a fence) on the grid line through these lane points? (on this staircase's own floor)
      const wallAlong = (pts) => pts.some(([u, v]) => {
        const [x, y] = lanePt(s, u, v), dh = Math.abs(y - Math.round(y)), dv = Math.abs(x - Math.round(x));
        const k = dh < dv ? key('h', Math.round(y), Math.floor(x)) : key('v', Math.floor(y), Math.round(x)), e2 = F.edges.get(k);
        return e2 && e2.type !== 'fence';
      });
      // which sides of each flight get a rail (a0 / a1 side), checked at the middle of every square it passes
      const railSides = lay.flights.map(fl => {
        const lo = Math.min(fl.from, fl.to), hi = Math.max(fl.from, fl.to), sq = [];
        for (let t = Math.floor(lo) + 0.5; t < hi; t += 1) sq.push(t);
        const at = a => sq.map(t => fl.axis === 'u' ? [t, a] : [a, t]);
        return { a0: !wallAlong(at(fl.a0 - SI)), a1: !wallAlong(at(fl.a1 + SI)) };
      });
      const z = baseZ(L);
      stairTreads(s).forEach(t => {
        const top = t.riser * riser, z0 = isCantilever(s) ? top - (t.landing ? 0.1 : TREAD_T) * Math.max(scale, 0.3) : 0;
        const boxes = [box(t.rect, Math.max(0, z0), top, 'stair')];
        let extra = '';
        const post = (u, v) => {
          const [x, y] = lanePt(s, u, v), b = { x0: x - 0.015, x1: x + 0.015, y0: y - 0.015, y1: y + 0.015 }, zt = top + RAIL_H * scale;
          if (split == null || zt <= split) boxes.push(box(b, top, zt, 'appdark'));
          else {
            if (top < split) boxes.push(box(b, top, split, 'appdark'));
            up.push({ fp: b, cls, boxes: [box(b, Math.max(top, split), zt, 'appdark')] });
          }
          return [x, y];
        };
        if (!t.landing) {
          const fl = lay.flights[t.flight], mid = (t.t0 + t.t1) / 2, nextMid = mid + (t.t1 - t.t0), rs = railSides[t.flight];
          [['a0', fl.a0 + 0.03], ['a1', fl.a1 - 0.03]].forEach(([sd, a]) => {
            if (!rs[sd]) return;
            const P1 = post(...(fl.axis === 'u' ? [mid, a] : [a, mid]));
            const lastStep = t.k === fl.n - 1;
            const endT = lastStep ? t.t1 : nextMid, endZ = lastStep ? top : top + riser;
            const [x2, y2] = lanePt(s, ...(fl.axis === 'u' ? [endT, a] : [a, endT]));
            extra += railSeg(P1[0], P1[1], top + RAIL_H * scale, x2, y2, endZ + RAIL_H * scale);
          });
        } else {
          // landing: rails along its open outer sides, unless a wall is there
          const ld = t.landing, sides = { u1: [[ld.u1 - 0.03, ld.v0 + 0.03], [ld.u1 - 0.03, ld.v1 - 0.03], [[ld.u1 + SI, (ld.v0 + ld.v1) / 2]]],
                                           v0: [[ld.u0 + 0.03, ld.v0 + 0.03], [ld.u1 - 0.03, ld.v0 + 0.03], [[(ld.u0 + ld.u1) / 2, ld.v0 - SI]]],
                                           v1: [[ld.u0 + 0.03, ld.v1 - 0.03], [ld.u1 - 0.03, ld.v1 - 0.03], [[(ld.u0 + ld.u1) / 2, ld.v1 + SI]]] };
          ld.open.forEach(([sd]) => {
            const [p1, p2, probe] = sides[sd];
            if (wallAlong(probe)) return;
            const A = post(...p1), B = post(...p2);
            extra += railSeg(A[0], A[1], top + RAIL_H * scale, B[0], B[1], top + RAIL_H * scale);
          });
        }
        items.push({ fp: t.rect, cls, src: L === state.level ? 'stair:' + si : null, boxes, extra });
      });
      return items;
    }
    // Every drawable is { fp, cls, boxes:[{x0,x1,y0,y1,z0,z1,m}] }; its boxes
    // share one footprint (or sit inside it) and are listed bottom to top.
    // src ties it to what the Style tool can select.
    /* ✂️ Cutout. The idea is a diagonal sweep across the whole grid, from the
       corner farthest from the camera towards it, keeping full height only
       the first wall section met. Done literally that is a march over every
       square; instead, look at it in the rotated frame: every wall piece is
       one unit long along a or b, so it covers exactly one unit-wide band of
       a − b (a "diagonal" running away from the camera), and how far along
       the sweep it is met is the a + b of its middle. So: one pass over the
       walls, keep the smallest a + b in each band — O(walls), whatever the
       grid size. Fences don't count (they never block the view). */
    /* (moved to S) */           // share of the wall height kept (slider)
    const cutH = () => Math.max(0.05, WALL_H * state.keepAmount);
    function cutoutFull(st) {
      const best = new Map();   // band (a − b) → { d: a + b, k }
      st.edges.forEach((v, k) => {
        if (v.type === 'fence') return;
        const e = parseKey(k), [[x0, y0], [x1, y1]] = edgeEnds(e.o, e.r, e.c);
        const [a0, b0] = rotPt(x0, y0), [a1, b1] = rotPt(x1, y1);
        const band = Math.min(a0 - b0, a1 - b1), d = a0 + b0 + a1 + b1;
        const cur_ = best.get(band);
        if (!cur_ || d < cur_.d) best.set(band, { d, k });
      });
      return new Set([...best.values()].map(o => o.k));
    }
    function buildDrawables(st, L) {
      const baseH = (state.wallsDown && L === state.level) ? cutH() : WALL_H;   // walls down: every wall at the cut height
      const full = (state.cutout && !state.wallsDown && L === state.level) ? cutoutFull(st) : null;
      const CUT_H = cutH();
      const edgeH = k => full && !full.has(k) ? CUT_H : baseH;
      // a corner stays full height if a full-height wall meets it
      const vertexH = (x, y) => !full || [key('h', y, x), key('h', y, x - 1), key('v', y, x), key('v', y - 1, x)].some(k => full.has(k)) ? baseH : CUT_H;
      const H = baseH;
      const z = baseZ(L);
      const items = [];
      const box = (fp, z0, z1, m, extra) => ({ ...fp, z0: z + z0, z1: z + z1, m, ...(extra || {}) });
      // a fence panel (any style, short or tall) along a run fp, which runs along x ('h') or y ('v')
      const fencePanel = (fp, o, fs) => {
        const base = fenceBase(fs), FH = fenceHeight(fs);
        if (base === 'picket') {
          // bottom rail, pickets (back to front for this view), top rail
          const len = o === 'h' ? fp.x1 - fp.x0 : fp.y1 - fp.y0;
          const n = Math.max(2, Math.round(len / 0.17)), bw = 0.035, thin = thinAcross(fp, o, 0.035), bal = [];
          for (let i = 0; i < n; i++) {
            const m = (i + 0.5) / n;
            const b = o === 'h' ? { ...thin, x0: fp.x0 + m * len - bw / 2, x1: fp.x0 + m * len + bw / 2 } : { ...thin, y0: fp.y0 + m * len - bw / 2, y1: fp.y0 + m * len + bw / 2 };
            const rb = rotBox(b); bal.push({ d: rb.a0 + rb.b0, b: box(b, 0.1, FH - 0.06, 'rail') });
          }
          bal.sort((p, q) => p.d - q.d);
          return [box(thinAcross(fp, o, 0.05), 0.05, 0.1, 'rail'), ...bal.map(x => x.b), box(fp, FH - 0.06, FH, 'rail')];
        }
        if (base === 'board') return [box(thinAcross(fp, o, 0.03), 0.03, FH - 0.05, 'board'), box(fp, FH - 0.05, FH, 'board')];
        if (base === 'lattice') return [box(fp, 0.04, 0.1, 'latt'), box(thinAcross(fp, o, 0.02), 0.1, FH - 0.06, 'none', { deco: 'lattice' }), box(fp, FH - 0.06, FH, 'latt')];
        return [box(thinAcross(fp, o, 0.01), 0.03, FH - 0.05, 'mesh', { deco: 'chain' }), box(thinAcross(fp, o, 0.05), FH - 0.05, FH, 'metal')];
      };
      const add = (k, v, cls) => {
        const H = edgeH(k);
        const e = parseKey(k), fp = segFootprint(e.o, e.r, e.c, st, v.type === 'fence');
        const fm = sidesFm(e.o, v);
        if (v.type === 'wall') {
          items.push({ fp, cls, src: k, boxes: [box(fp, 0, H, 'wall', { fm })] });
        } else if (v.type === 'fence') {
          const fs = styleOf(v, 'fence');
          if (v.gate) {
            const gg = gateGeom(e.o, e.r, e.c, v.swing | 0, st), FH = fenceHeight(fs);
            if (v.open) {
              // open: the leaf stands out at right angles from its hinge post; the opening is clear
              items.push({ fp: gg.leaf, cls, src: k, boxes: fencePanel(gg.leaf, gg.leafO, fs) });
            } else {
              // closed: a panel a little short of each post, with a dark latch at the free end
              const inset = e.o === 'h' ? { ...fp, x0: fp.x0 + 0.015, x1: fp.x1 - 0.015 } : { ...fp, y0: fp.y0 + 0.015, y1: fp.y1 - 0.015 };
              const free = (v.swing | 0) & 1 ? 0 : 1, lt = thinAcross(inset, e.o, 0.07);
              const latch = e.o === 'h' ? { ...lt, x0: free ? inset.x1 - 0.07 : inset.x0 + 0.02, x1: free ? inset.x1 - 0.02 : inset.x0 + 0.07 }
                                        : { ...lt, y0: free ? inset.y1 - 0.07 : inset.y0 + 0.02, y1: free ? inset.y1 - 0.02 : inset.y0 + 0.07 };
              items.push({ fp, cls, src: k, boxes: [...fencePanel(inset, e.o, fs), box(latch, FH * 0.55, FH * 0.55 + 0.06, 'appdark')] });
            }
            return;
          }
          items.push({ fp, cls, src: k, boxes: fencePanel(fp, e.o, fs) });
        } else if (v.type === 'window') {
          const ws = styleOf(v, 'window');
          if (ws === 'round') {
            if (H < 1.5 + 0.4) items.push({ fp, cls, src: k, boxes: [box(fp, 0, H, 'winlow', { fm })] });
            else items.push({ fp, cls, src: k, boxes: [box(fp, 0, H, 'wall', { fm, hole: true, decoZ: z + 1.5 })] });
          } else {
            const [s0, s1] = { casement: [SILL_H, WIN_TOP], clerestory: [1.75, 2.25], fullheight: [0.05, 2.3] }[ws];
            if (H < s0 + 0.2) items.push({ fp, cls, src: k, boxes: [box(fp, 0, H, 'winlow', { fm })] });
            else {
              const top = Math.min(s1, H);
              const boxes = [box(fp, 0, s0, s0 > 0.1 ? 'wall' : 'sill', { fm: s0 > 0.1 ? fm : null }),
                box(thinAcross(fp, e.o, 0.05), s0, top, 'glass', { deco: ws === 'casement' ? 'mullion' : ws === 'fullheight' ? 'transom' : null })];
              if (H > s1) boxes.push(box(fp, s1, H, 'wall', { fm }));
              items.push({ fp, cls, src: k, boxes });
            }
          }
        } else if (v.type === 'door') {
          const ds = styleOf(v, 'door'), deco = ds === 'flush' ? null : ds;
          const boxes = [box(thinAcross(fp, e.o, T * 0.8), 0, 0.025, 'sill')];
          // closed: the leaf fills the opening, inside the door's own footprint
          if (v.closed) boxes.push(box(thinAcross(fp, e.o, 0.05), 0.02, Math.min(H, DOOR_H - 0.02), 'door', { deco }));
          if (H > DOOR_H) boxes.push(box(fp, DOOR_H, H, 'wall', { fm }));
          items.push({ fp, cls, src: k, boxes });
          if (!v.closed) {
            const lf = leafFootprint(doorGeom(e.o, e.r, e.c, v.swing | 0, st));
            items.push({ fp: lf, cls, src: k, boxes: [box(lf, 0.02, Math.min(H, DOOR_H - 0.04), 'door', { deco })] });
          }
        }
      };
      st.edges.forEach((v, k) => add(k, v, st.ghost && st.ghost.has(k) ? 'ghost' : ''));
      if (st.gone) st.gone.forEach((v, k) => add(k, v, 'gone'));
      // Corner posts take the finish of the walls they join, face by face,
      // so a brick corner stays brick all the way round.
      const edgeAt = k => st.edges.get(k) || (st.gone && st.gone.get(k)) || null;
      const posts = postList(st);
      posts.forEach((kind, pk) => {
        const [x, y] = pk.split(',').map(Number);
        const fence = posts.fenceOnly.has(pk), hw = (fence ? FPOST : T) / 2;
        const fp = { x0: x - hw, x1: x + hw, y0: y - hw, y1: y + hw };
        const pcls = kind === 'solid' ? '' : kind;
        if (fence) {
          // a fence post is as tall as the tallest fence it holds, in that fence's material
          const fl = [key('h', y, x), key('h', y, x - 1), key('v', y, x), key('v', y - 1, x)].map(edgeAt).filter(v => v && v.type === 'fence');
          const fs = fl.map(v => styleOf(v, 'fence')).sort((a, b) => fenceHeight(b) - fenceHeight(a))[0] || 'picket';
          items.push({ fp, cls: pcls, boxes: [box(fp, 0, fenceHeight(fs) + 0.06, FENCE_MAT[fenceBase(fs)])] });
          return;
        }
        const wallish = v => v && v.type !== 'fence' ? v : null;
        const hh = wallish(edgeAt(key('h', y, x))) || wallish(edgeAt(key('h', y, x - 1)));
        const vv = wallish(edgeAt(key('v', y, x))) || wallish(edgeAt(key('v', y - 1, x)));
        const fm = { ...(hh ? sidesFm('h', hh) : {}), ...(vv ? sidesFm('v', vv) : {}) };
        items.push({ fp, cls: pcls, boxes: [box(fp, 0, vertexH(x, y), 'post', { fm })] });
      });
      (st.columns || []).forEach(({ k, cls }) => {
        const fp = colFootprint(k), round = (st.colStyles && st.colStyles.get(k)) === 'round';
        const [CX, CY] = colXY(k), ch = CX % 2 ? (full ? CUT_H : baseH) : vertexH(CX / 2, CY / 2);
        items.push({ fp, cls, src: 'col:' + k, boxes: [box(fp, 0, ch, 'col', { cyl: round })] });
      });
      // basement: the pool's concrete basin fills the top of the storey under it —
      // but only over squares where a basement room actually exists there, or the
      // basin would float outside the basement's own walls (a pool is often beside
      // the house, not above it, and deeper basements are blocked too either way:
      // the basin itself only ever needs to reach B1F)
      if (L === -1 && state.floors[-1].edges.size) {
        const rm = computeRooms(state.floors[-1].edges, isIndoorEdge);
        state.floors[0].pools.forEach(q => {
          for (let r = q.r0; r < q.r1; r++) for (let c = q.c0; c < q.c1; c++) {
            if (!rm.inRoom(r, c)) continue;
            const fp = { x0: c, x1: c + 1, y0: r, y1: r + 1 };
            items.push({ fp, cls: '', boxes: [box(fp, LEVEL_H - FLOOR_T - POOL_DEPTH, LEVEL_H - FLOOR_T, 'conc')] });
          }
        });
      }
      // furniture
      // (with whatever appliances sit on it, as parts of the same drawable)
      (st.furniture || []).forEach(({ f, cls }) => {
        let raw = [...furnParts(f), ...itemParts(f)];
        // something hung on a wall is cut with its wall (walls down / cutout): nothing floats above it
        if (hung(f) && L === state.level) {
          const wh = edgeH(f.ek);
          raw = raw.filter(pt => pt.z0 < wh - 0.01).map(pt => ({ ...pt, z1: Math.min(pt.z1, wh) }));
          if (!raw.length) return;
        }
        const parts = paintOrder(raw.map(pt => ({ fp: pt.rect, cls: '', boxes: [box(pt.rect, pt.z0, pt.z1, pt.m, pt.x)] })));
        items.push({ fp: furnRect(f), cls, boxes: parts.map(o => o.boxes[0]) });
      });
      // appliances on the floor
      (st.appliances || []).forEach(({ a, cls }, ai) => {
        if (a.type === 'rug') return;        // rugs are drawn with the floor (see rugSVG)
        const parts = paintOrder(applParts(a.type, applFrame(a), 0, a.color).map(pt => ({ fp: pt.rect, cls: '', boxes: [box(pt.rect, pt.z0, pt.z1, pt.m, pt.x)] })));
        items.push({ fp: applRect(a), cls, src: L === state.level ? 'appl:' + ai : null, boxes: parts.map(o => o.boxes[0]) });
      });
      // stairs: one drawable per step, each a solid block from the floor up to its tread
      // (with the walls down they shrink to a low model, like everything else)
      // and in cutout they are squashed by the same share as the cut walls
      const rise = ((state.wallsDown && L === state.level) || full) ? LEVEL_H * cutH() / WALL_H : LEVEL_H;
      st.stairs.forEach(({ s, cls }, si) => stairItems(s, cls, rise, L, box, si).forEach(it => items.push(it)));
      // Style tool: light up what is selected (and what the mouse is over)
      if (L === state.level && state.currentTool === 'style') {
        const sk = hooks.selKeys(state.selection), hk = hooks.selKeys(state.hoverTarget);
        items.forEach(it => { if (!it.src) return; if (sk.has(it.src)) it.cls += ' sel'; else if (hk.has(it.src)) it.cls += ' hsel'; });
      }
      return items;
    }
  
    /* ═══════════════ ROOFS ═══════════════
       A roof is { X0, Y0, X1, Y1, type, mat, dir } in half-metre units (the
       same spots columns use), sitting on top of the walls of its storey.
         flat   a 25 cm deck
         gable  dir 0: ridge runs east–west, dir 1: north–south; open gable
                ends (the triangles) are filled in like a wall
         shed   one slope; dir is the LOW side (0 N, 1 E, 2 S, 3 W)
       Every shape is a convex solid, so back-face culling is all the depth
       sorting needed inside one roof. */
    const roofRect = r => ({ x0: r.X0 / 2, x1: r.X1 / 2, y0: r.Y0 / 2, y1: r.Y1 / 2 });
    function roofRise(r) {
      const R_ = roofRect(r);
      if (r.type === 'flat') return 0.25;
      if (isGable(r.type)) return (r.dir ? R_.x1 - R_.x0 : R_.y1 - R_.y0) / 2 * 0.55;
      return (r.dir % 2 ? R_.x1 - R_.x0 : R_.y1 - R_.y0) * 0.3;
    }
    function roofSolid(r, ze) {
      const { x0, x1, y0, y1 } = roofRect(r), h = roofRise(r), zr = ze + h;
      let faces = [];   // { p: [[x,y,z]…], kind: 'slope' | 'end' | 'top', o, u, v }
      const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const slope = (p, o, uEnd, vEnd) => ({ p, kind: 'slope', o, u: sub(uEnd, o), v: sub(vEnd, o) });
      if (r.type === 'flat') {
        const A = [x0, y0, ze], B = [x1, y0, ze], C = [x1, y1, ze], D = [x0, y1, ze];
        const At = [x0, y0, zr], Bt = [x1, y0, zr], Ct = [x1, y1, zr], Dt = [x0, y1, zr];
        faces = [slope([At, Bt, Ct, Dt], At, Bt, Dt), { p: [A, B, Bt, At], kind: 'side' }, { p: [B, C, Ct, Bt], kind: 'side' },
                 { p: [C, D, Dt, Ct], kind: 'side' }, { p: [D, A, At, Dt], kind: 'side' }, { p: [A, D, C, B], kind: 'bottom' }];
        faces[0].kind = 'top';
      } else if (isGable(r.type)) {
        const A = [x0, y0, ze], B = [x1, y0, ze], C = [x1, y1, ze], D = [x0, y1, ze];
        if (!r.dir) {
          const ym = (y0 + y1) / 2, E = [x0, ym, zr], F = [x1, ym, zr];
          faces = [slope([A, B, F, E], A, B, E), slope([D, C, F, E], D, C, E), { p: [A, E, D], kind: 'end' }, { p: [B, F, C], kind: 'end' }, { p: [A, B, C, D], kind: 'bottom' }];
        } else {
          const xm = (x0 + x1) / 2, E = [xm, y0, zr], F = [xm, y1, zr];
          faces = [slope([A, D, F, E], A, D, E), slope([B, C, F, E], B, C, E), { p: [A, B, E], kind: 'end' }, { p: [D, C, F], kind: 'end' }, { p: [A, B, C, D], kind: 'bottom' }];
        }
      } else {   // shed (box or open)
        const lowHigh = [
          [[x0, y0], [x1, y0], [x0, y1], [x1, y1]],
          [[x1, y0], [x1, y1], [x0, y0], [x0, y1]],
          [[x0, y1], [x1, y1], [x0, y0], [x1, y0]],
          [[x0, y0], [x0, y1], [x1, y0], [x1, y1]]][r.dir % 4];
        const l0 = [...lowHigh[0], ze], l1 = [...lowHigh[1], ze], h0 = [...lowHigh[2], ze], h1 = [...lowHigh[3], ze];
        const h0t = [h0[0], h0[1], zr], h1t = [h1[0], h1[1], zr];
        faces = [slope([l0, l1, h1t, h0t], l0, l1, h0t), { p: [h0, h1, h1t, h0t], kind: 'end' }, { p: [l0, h0, h0t], kind: 'end' },
                 { p: [l1, h1, h1t], kind: 'end' }, { p: [l0, l1, h1, h0], kind: 'bottom' }];
      }
      // turn every face so its points run counter-clockwise seen from outside
      const all = faces.flatMap(f => f.p), cen = [0, 1, 2].map(i => all.reduce((sum, q) => sum + q[i], 0) / all.length);
      faces.forEach(f => {
        let n = [0, 0, 0];
        f.p.forEach((q, i) => { const w2 = f.p[(i + 1) % f.p.length]; n[0] += (q[1] - w2[1]) * (q[2] + w2[2]); n[1] += (q[2] - w2[2]) * (q[0] + w2[0]); n[2] += (q[0] - w2[0]) * (q[1] + w2[1]); });
        const fc = [0, 1, 2].map(i => f.p.reduce((sum, q) => sum + q[i], 0) / f.p.length);
        if (n[0] * (fc[0] - cen[0]) + n[1] * (fc[1] - cen[1]) + n[2] * (fc[2] - cen[2]) < 0) { f.p = f.p.slice().reverse(); n = n.map(x => -x); }
        const len = Math.hypot(...n) || 1; f.n = n.map(x => x / len);
      });
      return { faces, h };
    }
    const scr = (x, y, z) => { const [a, b] = rotPt(x, y); return P(a, b, z); };
    const signedArea = q => { let s2 = 0; q.forEach((p1, i) => { const p2 = q[(i + 1) % q.length]; s2 += p1[0] * p2[1] - p2[0] * p1[1]; }); return s2 / 2; };
    // faces pointing at the camera have the same winding on screen as a floor seen from above
    const facingSign = () => Math.sign(signedArea([[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map(q => scr(...q))));
    function roofPattern(mat, f) {
      const Lu = Math.hypot(...f.u), Lv = Math.hypot(...f.v);
      const pt = (s2, t) => W(f.o[0] + s2 * f.u[0] + t * f.v[0], f.o[1] + s2 * f.u[1] + t * f.v[1], f.o[2] + s2 * f.u[2] + t * f.v[2]);
      let d = '';
      const ln = (s0, t0, s1, t1) => { d += `M${pt(s0, t0)}L${pt(s1, t1)}`; };
      if (mat === 'metal') {
        const n = Math.max(2, Math.round(Lu / 0.1));
        for (let i = 1; i < n; i++) ln(i / n, 0, i / n, 1);
      } else {
        const row = mat === 'clay' ? 0.22 : 0.3, bl = mat === 'clay' ? 0.28 : 0.4;
        const rows = Math.max(1, Math.round(Lv / row));
        for (let j = 0; j < rows; j++) {
          const t0 = j / rows, t1 = (j + 1) / rows;
          if (j) ln(0, t0, 1, t0);
          for (let x = (j % 2 ? bl / 2 : 0) + bl; x < Lu - 0.03; x += bl) ln(x / Lu, t0, x / Lu, t1);
        }
      }
      return `<path class="${{ clay: 'pat-rclay', concrete: 'pat-rconc', metal: 'pat-rmetal' }[mat]}" d="${d}"/>`;
    }
    // light the face from the upper left of the screen, like the boxes
    function faceTone(n) {
      if (n[2] > 0.97) return 'ft';
      const [na, nb] = [[n[0], n[1]], [-n[1], n[0]], [-n[0], -n[1]], [n[1], -n[0]]][state.rot];
      return nb > na ? 'fl' : 'fr';
    }
    /* Height of a roof's top surface at world point (x, y). */
    function roofZ(r, ze, x, y) {
      const { x0, x1, y0, y1 } = roofRect(r), h = roofRise(r);
      if (isGable(r.type)) {
        if (r.dir) { const m = (x0 + x1) / 2, hs = (x1 - x0) / 2; return ze + h * (1 - Math.abs(x - m) / hs); }
        const m = (y0 + y1) / 2, hs = (y1 - y0) / 2; return ze + h * (1 - Math.abs(y - m) / hs);
      }
      if (isShed(r.type)) {
        switch (r.dir % 4) {
          case 0: return ze + h * (y - y0) / (y1 - y0);
          case 1: return ze + h * (x1 - x) / (x1 - x0);
          case 2: return ze + h * (y1 - y) / (y1 - y0);
          default: return ze + h * (x - x0) / (x1 - x0);
        }
      }
      return ze;
    }
    /* Open gable / open shed: every outside wall of this storey that lies
       under the roof is carried up to the roof's underside — a gable end
       becomes a triangle (or a five-sided piece where the ridge crosses it),
       a side wall a thin strip up to where the roof crosses it. Each 1 m
       piece is a convex solid (a wall section with a sloping top), so, like
       the roof, back-face culling sorts its own faces. Pieces along north–south
       lines take the corner squares, east–west pieces stop short of them, so
       no two pieces overlap. They keep the wall's finish, side by side. */
    function wallRaise(r, ze, st, L) {
      const R_ = roofRect(r), E = 1e-6, rooms = computeRooms(st.edges, isIndoorEdge);
      const inside = (x, y) => x >= R_.x0 - E && x <= R_.x1 + E && y >= R_.y0 - E && y <= R_.y1 + E;
      const isWallish = k => { const v = st.edges.get(k); return v && v.type !== 'fence'; };
      const raised = new Map();
      st.edges.forEach((v, k) => {
        if (v.type === 'fence') return;
        const e = parseKey(k), [[ax, ay], [bx, by]] = edgeEnds(e.o, e.r, e.c);
        if (!inside(ax, ay) || !inside(bx, by)) return;
        const mOut = !(e.o === 'h' ? rooms.inRoom(e.r - 1, e.c) : rooms.inRoom(e.r, e.c - 1)), pOut = !rooms.inRoom(e.r, e.c);
        if (mOut || pOut) raised.set(k, v);       // outside walls only
      });
      const pieces = [];
      raised.forEach((v, k) => {
        const e = parseKey(k), fm = sidesFm(e.o, v);
        let t0, t1, fixed;
        if (e.o === 'v') {
          fixed = e.c;
          const prevV = raised.has(key('v', e.r - 1, e.c)), nextV = raised.has(key('v', e.r + 1, e.c));
          t0 = e.r - (prevV ? 0 : T / 2); t1 = e.r + 1 + (nextV ? 0 : T / 2);
        } else {
          fixed = e.r;
          const vAt = x => raised.has(key('v', e.r - 1, x)) || raised.has(key('v', e.r, x));
          t0 = e.c + (vAt(e.c) ? T / 2 : 0); t1 = e.c + 1 - (vAt(e.c + 1) ? T / 2 : 0);
        }
        const P = t => e.o === 'h' ? [t, fixed] : [fixed, t];
        const top = t => roofZ(r, ze, ...P(t));
        // the roof profile along the piece, with the ridge as a corner if it crosses it
        const ts = [t0];
        if (isGable(r.type) && ((r.dir && e.o === 'h') || (!r.dir && e.o === 'v'))) {
          const m = r.dir ? (R_.x0 + R_.x1) / 2 : (R_.y0 + R_.y1) / 2;
          if (m > t0 + E && m < t1 - E) ts.push(m);
        }
        ts.push(t1);
        if (Math.max(...ts.map(top)) - ze < 0.01) return;
        // an end that shows at a corner carries on the finish of the wall it turns into
        const endMat = (vx, vy, side) => {
          const cands = e.o === 'v' ? [key('h', vy, vx - 1), key('h', vy, vx)] : [key('v', vy - 1, vx), key('v', vy, vx)];
          const nb = cands.map(k2 => raised.get(k2)).find(Boolean);
          return nb ? sidesFm(e.o === 'v' ? 'h' : 'v', nb)[side] : 'wall';
        };
        const endFm = e.o === 'v' ? [endMat(e.c, e.r, 'ym'), endMat(e.c, e.r + 1, 'yp')] : [endMat(e.c, e.r, 'xm'), endMat(e.c + 1, e.r, 'xp')];
        pieces.push({ e, fm, ts, top, fixed, t0, t1, endFm });
      });
      return pieces;
    }
    function wallRaiseSVG(piece, ze) {
      const { e, fm, ts, top, fixed, t0, t1, endFm } = piece, half = T / 2;
      // the solid: two side faces (one each side of the wall line), the sloping top, the two ends
      const W3 = (t, off, z) => e.o === 'h' ? [t, fixed + off, z] : [fixed + off, t, z];
      const side = off => [W3(t0, off, ze), W3(t1, off, ze), ...ts.slice().reverse().map(t => W3(t, off, top(t)))];
      const faces = [{ p: side(-half), side: e.o === 'h' ? 'ym' : 'xm' }, { p: side(half), side: e.o === 'h' ? 'yp' : 'xp' },
                     { p: [W3(t0, -half, ze), W3(t0, half, ze), W3(t0, half, top(t0)), W3(t0, -half, top(t0))], side: null, mat: endFm[0] },
                     { p: [W3(t1, -half, ze), W3(t1, half, ze), W3(t1, half, top(t1)), W3(t1, -half, top(t1))], side: null, mat: endFm[1] }];
      for (let i = 0; i + 1 < ts.length; i++) faces.push({ p: [W3(ts[i], -half, top(ts[i])), W3(ts[i + 1], -half, top(ts[i + 1])), W3(ts[i + 1], half, top(ts[i + 1])), W3(ts[i], half, top(ts[i]))], side: 'top' });
      const all = faces.flatMap(f => f.p), cen = [0, 1, 2].map(i => all.reduce((a, q) => a + q[i], 0) / all.length);
      const sign = facingSign();
      let out = '';
      faces.forEach(f => {
        let n = [0, 0, 0];
        f.p.forEach((q, i) => { const w2 = f.p[(i + 1) % f.p.length]; n[0] += (q[1] - w2[1]) * (q[2] + w2[2]); n[1] += (q[2] - w2[2]) * (q[0] + w2[0]); n[2] += (q[0] - w2[0]) * (q[1] + w2[1]); });
        const fc = [0, 1, 2].map(i => f.p.reduce((a, q) => a + q[i], 0) / f.p.length);
        let pts3 = f.p;
        if (n[0] * (fc[0] - cen[0]) + n[1] * (fc[1] - cen[1]) + n[2] * (fc[2] - cen[2]) < 0) { pts3 = f.p.slice().reverse(); n = n.map(x => -x); }
        const q = pts3.map(v => scr(...v));
        if (Math.sign(signedArea(q)) !== sign) return;
        const len = Math.hypot(...n) || 1, tone = faceTone(n.map(x => x / len));
        const mat = f.side === 'top' ? 'wall' : f.mat || (f.side && fm[f.side]) || 'wall';
        out += `<polygon class="m-${mat} ${f.side === 'top' ? 'ft' : tone}" points="${q.map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ')}"/>`;
        if (f.side && f.side !== 'top') out += raiseTexture(mat, piece, f.side === 'ym' || f.side === 'xm' ? -half : half, ze);
      });
      return out;
    }
    // wall finish textures on a raised piece, clipped to its sloping top
    function raiseTexture(mat, piece, off, ze) {
      const { e, ts, top, fixed, t0, t1 } = piece, EPS = 0.004;
      const pt = (t, z) => e.o === 'h' ? W(t, fixed + off, z) : W(fixed + off, t, z);
      const zmax = Math.max(...ts.map(top));
      // where along the piece the top is at least z (one stretch, as the profile is a ∧ or a slope)
      const span = z => { let a = Infinity, b = -Infinity; for (let i = 0; i + 1 < ts.length; i++) { const [ta, tb] = [ts[i], ts[i + 1]], za = top(ta), zb = top(tb); if (za >= z) { a = Math.min(a, ta); b = Math.max(b, ta); } if (zb >= z) { a = Math.min(a, tb); b = Math.max(b, tb); } if ((za - z) * (zb - z) < 0) { const tx = ta + (z - za) / (zb - za) * (tb - ta); a = Math.min(a, tx); b = Math.max(b, tx); } } return a < b ? [a, b] : null; };
      let d = '';
      const ln = (ta, za, tb, zb) => { d += `M${pt(ta, za)}L${pt(tb, zb)}`; };
      const hlines = step => { for (let z = Math.ceil((ze + EPS) / step) * step; z < zmax - EPS; z += step) { const sp = span(z); if (sp) ln(sp[0], z, sp[1], z); } };
      const vlines = step => { for (let t = Math.ceil((t0 + EPS) / step) * step; t < t1 - EPS; t += step) if (top(t) > ze + EPS) ln(t, ze, t, top(t)); };
      if (mat === 'lap') hlines(0.2);
      else if (mat === 'vert') vlines(0.15);
      else if (mat === 'ctile') { hlines(0.2); vlines(0.2); }
      else if (mat === 'brick') {
        const h = 0.15, bl = 0.3;
        for (let i = Math.floor(ze / h); i * h < zmax; i++) {
          const zc = i * h;
          if (zc > ze + EPS) { const sp = span(zc); if (sp) ln(sp[0], zc, sp[1], zc); }
          const off2 = ((i % 2) + 2) % 2 ? bl / 2 : 0;
          for (let t = Math.ceil((t0 - off2 + EPS) / bl) * bl + off2; t < t1 - EPS; t += bl) {
            const za = Math.max(zc, ze), zb = Math.min(zc + h, top(t));
            if (zb > za + EPS) ln(t, za, t, zb);
          }
        }
      } else return '';
      return d ? `<path class="pat-${mat}" d="${d}"/>` : '';
    }
    function roofSVG(r, ze, hitIdx, st, L) {
      const { faces } = roofSolid(r, ze), sign = facingSign(), mat = ROOF_MAT[r.mat] || 'clay';
      let s2 = '';
      // open roofs: first the walls carried up under them (they sit inside the
      // roof's solid, so no visible roof face can ever be behind them)
      if (isOpenRoof(r.type) && st) {
        const pieces = wallRaise(r, ze, st, L);
        const items = pieces.map(pc => { const lo = Math.min(pc.t0, pc.t1), hi = Math.max(pc.t0, pc.t1), h2 = T / 2;
          const fp = pc.e.o === 'h' ? { x0: lo, x1: hi, y0: pc.fixed - h2, y1: pc.fixed + h2 } : { x0: pc.fixed - h2, x1: pc.fixed + h2, y0: lo, y1: hi };
          return { fp, cls: '', boxes: [{ ...fp, z0: ze, z1: Math.max(...pc.ts.map(pc.top)) }], pc }; });
        paintOrder(items).forEach(it => { s2 += wallRaiseSVG(it.pc, ze); });
      }
      faces.forEach(f => {
        if (f.kind === 'bottom') return;
        if (f.kind === 'end' && isOpenRoof(r.type)) return;      // open: no end panels
        const q = f.p.map(v => scr(...v));
        if (Math.sign(signedArea(q)) !== sign) return;          // facing away: hidden
        const tone = faceTone(f.n);
        const m = f.kind === 'end' ? 'm-rend' : 'm-' + mat;
        const ptsStr = q.map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ');
        s2 += `<polygon class="${m} ${tone} rf" points="${ptsStr}"/>`;
        if (f.o && f.kind !== 'side') s2 += roofPattern(r.mat, f);
        if (hitIdx >= 0) state.roofHits.push({ idx: hitIdx, pts: q });
      });
      return s2;
    }
    // drawables for a storey's roofs (they sit above its walls)
    function roofItems(st, L) {
      const items = [], cur_ = L === state.level, ze = baseZ(L) + WALL_H;
      (st.roofs || []).forEach(({ r, cls, idx }) => {
        if (!cls && (!state.showRoofs || (cur_ && (state.wallsDown || state.cutout)))) return;   // previews always show
        const fp = roofRect(r), h = roofRise(r);
        let c = cls;
        if (cur_ && state.currentTool === 'style' && idx >= 0) {
          const src = 'roof:' + idx;
          if (src === hooks.selKey(state.selection)) c += ' sel'; else if (src === hooks.selKey(state.hoverTarget)) c += ' hsel';
        }
        items.push({ fp, cls: c, boxes: [{ ...fp, z0: ze, z1: ze + h }], svg: () => roofSVG(r, ze, cur_ && !cls ? idx : -1, st, L) });
      });
      return items;
    }
    function pointInPoly(x, y, q) {
      let inside = false;
      for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
        const [xi, yi] = q[i], [xj, yj] = q[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    // roof under a screen point of the 3D view (the last one drawn is on top)
    function pickRoofScreen(p) {
      if (!p || !state.showRoofs || state.wallsDown || state.cutout) return -1;
      for (let i = state.roofHits.length - 1; i >= 0; i--) if (pointInPoly(p.x, p.y, state.roofHits[i].pts)) return state.roofHits[i].idx;
      return -1;
    }
    function roofAtWorld(w, any) {
      if (!w || (!any && !state.showRoofs)) return -1;
      const list = state.floors[state.level].roofs;
      for (let i = list.length - 1; i >= 0; i--) { const R_ = roofRect(list[i]); if (w.x > R_.x0 && w.x < R_.x1 && w.y > R_.y0 && w.y < R_.y1) return i; }
      return -1;
    }
  
    /* Painter's algorithm, in two layers.
       1. Storeys are drawn one after another, bottom to top, each as
          [its floor slab] then [what stands on it]. The camera looks down,
          so nothing on a lower storey can ever hide something on a higher
          one: drawing storeys in order is exact.
       2. Inside one layer, every drawable stands on the same plane and the
          footprints don't overlap, so "A is behind B" is decided by the
          footprints alone: if A ends before B starts along a (or along b),
          A can never cover B. That relation is only needed between
          drawables whose screen boxes overlap; a topological sort of it
          gives the draw order, with a + b of the footprint centre as the
          tie-break (it also settles the rare touching corners of slabs). */
    /* (3.) A piece of furniture is one drawable whose parts (legs, top,
       mattress…) are put in order by the same rules, footprints first, then
       "wholly below goes first" for parts that sit on other parts. */
    function paintOrder(items) {
      const EPS = 1e-6;
      items.forEach(it => {
        const r = rotBox(it.fp);
        it.a0 = r.a0; it.a1 = r.a1; it.b0 = r.b0; it.b1 = r.b1;
        let z0 = Infinity, z1 = -Infinity;
        it.boxes.forEach(b => { z0 = Math.min(z0, b.z0); z1 = Math.max(z1, b.z1); });
        it.sx0 = (r.a0 - r.b1) * HW; it.sx1 = (r.a1 - r.b0) * HW;
        it.sy0 = (r.a0 + r.b0) * HH - z1 * ZS; it.sy1 = (r.a1 + r.b1) * HH - z0 * ZS;
        it.depth = r.a0 + r.a1 + r.b0 + r.b1;
        it.z0 = z0; it.z1 = z1;
      });
      items.sort((p, q) => p.depth - q.depth);
      const n = items.length;
      const succ = Array.from({ length: n }, () => []);
      const indeg = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        const p = items[i];
        for (let j = i + 1; j < n; j++) {
          const q = items[j];
          if (p.sx1 <= q.sx0 + EPS || q.sx1 <= p.sx0 + EPS || p.sy1 <= q.sy0 + EPS || q.sy1 <= p.sy0 + EPS) continue;
          let pBehind = p.a1 <= q.a0 + EPS || p.b1 <= q.b0 + EPS;
          let qBehind = q.a1 <= p.a0 + EPS || q.b1 <= p.b0 + EPS;
          // footprints overlap: if one is wholly below the other, the lower one
          // goes first (the camera looks down, so it can never cover the upper)
          if (!pBehind && !qBehind) { if (p.z1 <= q.z0 + EPS) pBehind = true; else if (q.z1 <= p.z0 + EPS) qBehind = true; }
          if (pBehind && !qBehind) { succ[i].push(j); indeg[j]++; }
          else if (qBehind && !pBehind) { succ[j].push(i); indeg[i]++; }
        }
      }
      const heap = [];
      const push = v => { heap.push(v); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p] <= heap[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l] < heap[m]) m = l; if (r < heap.length && heap[r] < heap[m]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      for (let i = 0; i < n; i++) if (!indeg[i]) push(i);
      const done = new Uint8Array(n), out = [];
      let scan = 0;
      while (out.length < n) {
        let i;
        if (heap.length) i = pop();
        else { while (done[scan]) scan++; i = scan; }   // cycle guard (shouldn't happen)
        if (done[i]) continue;
        done[i] = 1; out.push(items[i]);
        for (const j of succ[i]) if (--indeg[j] === 0 && !done[j]) push(j);
      }
      return out;
    }
    const drawItems = (out, items) => paintOrder(items).forEach(it => out.push(`<g class="it ${it.cls}">${it.svg ? it.svg() : it.boxes.map(boxSVG).join('') + (it.extra || '')}</g>`));
  
    /* Floor slabs, one box per square.
       L = -1   the ground the basement stands on
       L =  0   the ground (with holes for stairs coming up from the basement)
       L >= 1   a concrete floor under every square that is a room on the
                storey below or on this storey, minus stair holes; squares on
                the outside edge reach out half a wall so the slab caps the
                walls underneath. L = MAX_LEVEL + 1 is the roof. */
    function slabItems(L, rm) {
      const items = [];
      const inRoomL = (rm[L] || EMPTY_ROOMS).inRoom;
      const fencedL = (rm[L] || EMPTY_ROOMS).fenced.inRoom;
      if (L <= 0) {
        const holes = holeSquares(L);
        const z1 = baseZ(L), z0 = L === -1 ? z1 - SLAB : (basementUsed() ? -FLOOR_T : -SLAB);
        // swimming pools (ground floor only): water squares sit a little below
        // the ground; the squares round them get stone coping and tiled sides
        const poolCls = new Map(), solid = new Set();
        if (L === 0) displayState(0).pools.forEach(({ q, cls }) => poolCellsOf(q).forEach(k => { poolCls.set(k, cls); if (cls !== 'gone') solid.add(k); }));
        const isPool = (r, c) => solid.has(r + ',' + c);
        for (let r = 0; r < state.ROWS; r++) for (let c = 0; c < state.COLS; c++) {
          if (holes.has(r + ',' + c)) continue;
          const fp = { x0: c, x1: c + 1, y0: r, y1: r + 1 }, pc = poolCls.get(r + ',' + c);
          if (pc !== undefined) {
            items.push({ fp, cls: pc, boxes: [{ ...fp, z0, z1: z1 - 0.15, m: 'pooltile', mt: 'water', tp: 'water' }] });
            continue;
          }
          const fm = inRoomL(r, c) ? FLOOR_MAT[floorStyleAt(L, r, c)] : null;
          const nearPool = L === 0 && solid.size && [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].some(([dr, dc]) => isPool(r + dr, c + dc));
          const top = fm || (nearPool ? 'coping' : (L === 0 && fencedL(r, c)) ? 'grass' : 'lot');
          const sides = nearPool ? { xm: isPool(r, c - 1) ? 'pooltile' : null, xp: isPool(r, c + 1) ? 'pooltile' : null, ym: isPool(r - 1, c) ? 'pooltile' : null, yp: isPool(r + 1, c) ? 'pooltile' : null } : null;
          items.push({ fp, cls: '', boxes: [{ ...fp, z0, z1, m: 'earth', mt: top, tp: fm, fm: sides }] });
        }
        if (L === 0 && holes.size) items.push(...rimStrips(L, (r, c) => r >= 0 && r < state.ROWS && c >= 0 && c < state.COLS && !holes.has(r + ',' + c), holes, z0, z1, 'earth', 'lot'));
        return items;
      }
      const below = (rm[L - 1] || EMPTY_ROOMS).inRoom;
      const holes = holeSquares(L);
      // a fenced area up here is a balcony: it gets a floor too
      const has = (r, c) => (below(r, c) || inRoomL(r, c) || fencedL(r, c)) && !holes.has(r + ',' + c);
      const z1 = baseZ(L), z0 = z1 - FLOOR_T;
      for (let r = 0; r < state.ROWS; r++) for (let c = 0; c < state.COLS; c++) {
        if (!has(r, c)) continue;
        const fp = {
          x0: c - (has(r, c - 1) ? 0 : T / 2), x1: c + 1 + (has(r, c + 1) ? 0 : T / 2),
          y0: r - (has(r - 1, c) ? 0 : T / 2), y1: r + 1 + (has(r + 1, c) ? 0 : T / 2)
        };
        const fm = inRoomL(r, c) ? FLOOR_MAT[floorStyleAt(L, r, c)] : null;
        items.push({ fp, cls: '', boxes: [{ ...fp, z0, z1, m: 'conc', mt: fm || (fencedL(r, c) ? 'deck' : 'conc'), tp: fm }] });
      }
      if (holes.size) items.push(...rimStrips(L, has, holes, z0, z1, 'conc', 'conc'));
      return items;
    }
    /* A stair hole takes whole squares out of the floor, so a wall running
       along the edge of the hole (below it or on top of it) would lose the
       slab over its top and leave a see-through gap between the storeys.
       Wherever neither square beside such a wall has slab, put back a strip
       of slab half a wall wide on each side of the line. */
    function rimStrips(L, has, holes, z0, z1, m, mt) {
      const out = [], seen = new Set(), hole = (r, c) => holes.has(r + ',' + c);
      [L - 1, L].forEach(l => {
        if (!state.floors[l]) return;
        state.floors[l].edges.forEach((v, k) => {
          if (v.type === 'fence') return;
          const e = parseKey(k), A = e.o === 'h' ? [e.r - 1, e.c] : [e.r, e.c - 1], B = [e.r, e.c];
          if (!(hole(...A) || hole(...B)) || has(...A) || has(...B)) return;
          ['m', 'p'].forEach(sd => {
            if (seen.has(k + sd)) return;
            seen.add(k + sd);
            // Along the line: at an end where floor squares sit next to this one (on either side of
            // the line), their slab already reaches half a wall over this strip's end, so stop short
            // there; only where there is no floor at all reach half a wall past the end, over the
            // corner post. (Overlapping that slab made patches show through at the far corner.)
            const endHas = e.o === 'h' ? cc => has(e.r - 1, cc) || has(e.r, cc) : rr => has(rr, e.c - 1) || has(rr, e.c);
            const lo = e.o === 'h' ? e.c - 1 : e.r - 1, hi = e.o === 'h' ? e.c + 1 : e.r + 1;
            const ext0 = endHas(lo) ? -T / 2 : T / 2, ext1 = endHas(hi) ? -T / 2 : T / 2;
            const fp = e.o === 'h'
              ? { x0: e.c - ext0, x1: e.c + 1 + ext1, y0: sd === 'm' ? e.r - T / 2 : e.r, y1: sd === 'm' ? e.r : e.r + T / 2 }
              : { x0: sd === 'm' ? e.c - T / 2 : e.c, x1: sd === 'm' ? e.c : e.c + T / 2, y0: e.r - ext0, y1: e.r + 1 + ext1 };
            out.push({ fp, cls: '', boxes: [{ ...fp, z0, z1, m, mt }] });
          });
        });
      });
      return out;
    }
  
    // dashed grid on a storey's plane; skip(r, c) hides lines next to a square
    function gridPath(z, skip) {
      let d = '';
      const seg = (x0, y0, x1, y1) => { const p = rotPt(x0, y0), q = rotPt(x1, y1); const [ax, ay] = P(p[0], p[1], z), [bx, by] = P(q[0], q[1], z); d += `M${ax.toFixed(2)} ${ay.toFixed(2)}L${bx.toFixed(2)} ${by.toFixed(2)}`; };
      for (let x = 1; x < state.COLS; x++) for (let y = 0; y < state.ROWS; y++) if (!skip(y, x - 1) && !skip(y, x)) seg(x, y, x, y + 1);
      for (let y = 1; y < state.ROWS; y++) for (let x = 0; x < state.COLS; x++) if (!skip(y - 1, x) && !skip(y, x)) seg(x, y, x + 1, y);
      return d;
    }
    function lotOutline(z) {
      return [[0, 0], [state.COLS, 0], [state.COLS, state.ROWS], [0, state.ROWS]].map(([x, y]) => { const p = rotPt(x, y); return P(p[0], p[1], z).map(v => v.toFixed(2)).join(','); }).join(' ');
    }
  
    function isoBounds() {
      // The frame covers every storey in use (and the one being built on),
      // so switching floors doesn't rescale the picture.
      let top = Math.max(state.level, 0);
      LEVELS.forEach(L => { if (L > top && levelUsed(L)) top = L; });
      let zTop = baseZ(top) + LEVEL_H;
      LEVELS.forEach(L => state.floors[L].roofs.forEach(r => { zTop = Math.max(zTop, baseZ(L) + WALL_H + roofRise(r)); }));
      const zBot = (basementUsed() || state.level === -1) ? -LEVEL_H - SLAB : -SLAB;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      const PAD_M = 0.35;
      [[-PAD_M, -PAD_M], [state.COLS + PAD_M, -PAD_M], [state.COLS + PAD_M, state.ROWS + PAD_M], [-PAD_M, state.ROWS + PAD_M]].forEach(([x, y]) => {
        const [a, b] = rotPt(x, y);
        [zBot, zTop].forEach(z => { const [sx, sy] = P(a, b, z); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); });
      });
      const pad = 14;
      return [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
    }
  
    // rugs: flat on the floor of their storey, before anything that stands on it
    function rugSVG(st, L) {
      let o = '';
      (st.appliances || []).forEach(({ a, cls }) => {
        if (a.type !== 'rug') return;
        const R_ = applRect(a), z = baseZ(L);
        o += `<g class="it ${cls}">${boxSVG({ ...R_, z0: z, z1: z + 0.012, m: 'rug', tp: 'rug', topOnly: true })}</g>`;
      });
      return o;
    }
    // Style tool: selected floor squares (and the selection box while dragging)
    function floorSelSVG(L) {
      if (state.currentTool !== 'style') return '';
      const z = baseZ(L) + 0.005, sq = (r, c, cls) => {
        const q = [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]].map(([x, y]) => W(x, y, z).replace(' ', ','));
        return `<polygon class="${cls}" points="${q.join(' ')}"/>`;
      };
      let o = '';
      const selCells = state.selection && state.selection.kind === 'floor' ? new Set(state.selection.cells) : new Set();
      if (state.hoverTarget && state.hoverTarget.kind === 'floor') state.hoverTarget.cells.forEach(k => { if (!selCells.has(k)) { const [r, c] = k.split(',').map(Number); o += sq(r, c, 'hsel-floor'); } });
      selCells.forEach(k => { const [r, c] = k.split(',').map(Number); o += sq(r, c, 'sel-floor'); });
      if (state.marquee) {
        const { x0, y0, x1, y1 } = state.marquee;
        o += `<polygon class="marquee" points="${[[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => W(x, y, z).replace(' ', ',')).join(' ')}"/>`;
      }
      return o;
    }
    function renderIso(stBy, rmBy) {
      const out = [];
      clipSeq = 0;
      state.roofHits = [];
      stairUpper = {};
      const bUsed = basementUsed();
      const drawn = state.level === -1 ? [-1] : LEVELS.filter(L => L <= state.level && (L >= 0 || bUsed));
      drawn.forEach(L => {
        // the basement, seen from any floor other than itself, is immediately painted over by the
        // earth block below (added a few lines down) — so its own walls, furniture and stairs would
        // never actually show; skip building them rather than computing and discarding that work
        if (L === -1 && state.level !== -1) {
          drawItems(out, slabItems(-1, rmBy));
          out.push(`<path class="lot-line" d="${gridPath(baseZ(-1), (r, c) => rmBy[-1].inRoom(r, c))}"/>`);
          return;
        }
        if (L === -1) {
          drawItems(out, slabItems(-1, rmBy));
          out.push(`<path class="lot-line" d="${gridPath(baseZ(-1), (r, c) => rmBy[-1].inRoom(r, c))}"/>`);
        } else if (L === 0) {
          if (bUsed) {
            // the earth around the basement: just its two outer sides
            out.push(boxSVG({ x0: 0, x1: state.COLS, y0: 0, y1: state.ROWS, z0: -LEVEL_H - SLAB, z1: -FLOOR_T, m: 'earth', sidesOnly: true }));
          }
          drawItems(out, slabItems(0, rmBy));
          const holes = holeSquares(0);
          const ps0 = poolSquares();
          out.push(`<path class="lot-line" d="${gridPath(0, (r, c) => rmBy[0].inRoom(r, c) || rmBy[0].fenced.inRoom(r, c) || holes.has(r + ',' + c) || ps0.has(r + ',' + c))}"/>`);
        } else {
          if (state.showSlabs) drawItems(out, slabItems(L, rmBy));
          if (L === state.level) {
            const z = baseZ(L);
            out.push(`<polygon class="air-edge" points="${lotOutline(z)}"/>`);
            // grid only where there is no floor yet, so it doesn't cover the slab
            const onSlab = (r, c) => state.showSlabs && (rmBy[L].inRoom(r, c) || rmBy[L].fenced.inRoom(r, c) || rmBy[L - 1].inRoom(r, c));
            out.push(`<path class="air-line" d="${gridPath(z, onSlab)}"/>`);
          }
        }
        out.push(rugSVG(stBy[L], L));
        if (L === state.level) out.push(floorSelSVG(L));
        // this storey's pieces, plus the roofs of the storey below: a roof
        // can reach up past this storey's floor, so they are sorted together
        const items = buildDrawables(stBy[L], L);
        if (stairUpper[L]) items.push(...stairUpper[L]);      // rails from the stairs below that reach above this floor
        if (drawn.includes(L - 1)) items.push(...roofItems(stBy[L - 1], L - 1));
        drawItems(out, items);
      });
      if (state.showCeiling && !state.wallsDown && !state.cutout) drawItems(out, slabItems(state.level + 1, rmBy));
      drawItems(out, roofItems(stBy[state.level], state.level));
      // mouse target
      if (state.hover && !state.drag) {
        const z = baseZ(state.level);
        const [[x0, y0], [x1, y1]] = edgeEnds(state.hover.o, state.hover.r, state.hover.c);
        const p = rotPt(x0, y0), q = rotPt(x1, y1);
        const [ax, ay] = P(p[0], p[1], z), [bx, by] = P(q[0], q[1], z);
        out.push(`<line class="hov${state.currentTool === 'erase' ? ' erase' : ''}" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`);
      }
      // roof corner handles (Build tool with 🏠 Roof picked)
      if (hooks.showHandles()) {
        const ze = baseZ(state.level) + WALL_H;
        stBy[state.level].roofs.forEach(({ r, cls }) => {
          if (cls === 'gone') return;
          roofCorners(r).forEach(([X, Y]) => { const [sx, sy] = scr(X / 2, Y / 2, ze); out.push(`<rect class="roof-handle" x="${(sx - 5).toFixed(1)}" y="${(sy - 5).toFixed(1)}" width="10" height="10" rx="2"/>`); });
        });
      }
      hooks.setViewBox('iso', isoBounds());
      // Style tool: mark the side of the wall being styled
      const side = hooks.selectedSide();
      if (side) {
        const e = parseKey(state.selection.k), z = baseZ(state.level) + 0.01, off = (T / 2 + 0.1) * (side === 'p' ? 1 : -1);
        const [[x0, y0], [x1, y1]] = edgeEnds(e.o, e.r, e.c);
        const [dx, dy] = e.o === 'h' ? [0, off] : [off, 0];
        out.push(`<path class="sel-side" d="M${W(x0 + dx + (e.o === 'h' ? 0.12 : 0), y0 + dy + (e.o === 'v' ? 0.12 : 0), z)}L${W(x1 + dx - (e.o === 'h' ? 0.12 : 0), y1 + dy - (e.o === 'v' ? 0.12 : 0), z)}"/>`);
      }
      const defs = `<defs><linearGradient id="colGrad" x1="0" x2="1"><stop offset="0" style="stop-color:var(--col-l)"/><stop offset=".55" style="stop-color:var(--col-l)"/><stop offset="1" style="stop-color:var(--col-r)"/></linearGradient>${texturePatternDefs()}</defs>`;
      return `${defs}<g class="iso-scene">${out.join('')}</g>`;
    }
  
    /* ═══════════════ FLOOR PLAN (blueprint) ═══════════════ */
    function renderPlan(stBy, rmBy) {
      const s = PX, f = v => (v * s).toFixed(2), f_ = f;
      // appliance symbols: a television's screen line, a lamp's round shade, a microwave's door window
      const applPlanSVG = (type, fr) => {
        const { w, d } = APPL[type], R_ = frameRect(fr, -w / 2, w / 2, -d / 2, d / 2);
        const pl = (u0, v0, u1, v1, c2) => { const a = framePt(fr, u0, v0), b = framePt(fr, u1, v1); return `<path class="${c2}" d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}"/>`; };
        if (type === 'lamp') return `<circle class="bp-appl" cx="${f(fr.cx)}" cy="${f(fr.cy)}" r="${f(0.13)}"/>` + pl(-0.08, 0, 0.08, 0, 'bp-furnthin') + pl(0, -0.08, 0, 0.08, 'bp-furnthin');
        const box2 = `<rect class="bp-appl" x="${f(R_.x0)}" y="${f(R_.y0)}" width="${f(R_.x1 - R_.x0)}" height="${f(R_.y1 - R_.y0)}"/>`;
        if (type === 'tv') return box2 + pl(-0.44, 0.02, 0.44, 0.02, 'bp-furnline');
        if (type === 'stove') return box2 + [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.12], [0.15, 0.12]].map(([u, v]) => { const [x, y] = framePt(fr, u, v); return `<circle class="bp-furnthin" cx="${f(x)}" cy="${f(y)}" r="${f(0.075)}"/>`; }).join('');
        if (type === 'sink') { const B_ = frameRect(fr, -0.23, 0.23, -0.17, 0.17); return box2 + `<rect class="bp-furnthin" x="${f(B_.x0)}" y="${f(B_.y0)}" width="${f(B_.x1 - B_.x0)}" height="${f(B_.y1 - B_.y0)}" rx="${f(0.05)}"/>` + pl(0, -0.25, 0, -0.12, 'bp-furnline'); }
        if (type === 'monitor') return box2 + pl(-0.27, 0.0, 0.27, 0.0, 'bp-furnline');
        if (type === 'laptop') return box2 + pl(-0.17, -0.105, 0.17, -0.105, 'bp-furnline');
        if (type === 'console' || type === 'desktop') return box2 + pl(-w / 2 + 0.03, d / 2 - 0.03, w / 2 - 0.03, d / 2 - 0.03, 'bp-furnthin');
        if (type === 'stereo') return [[-0.45, -0.3], [-0.15, 0.15], [0.3, 0.45]].map(([u0, u1]) => { const B_ = frameRect(fr, u0, u1, -0.12, 0.12); return `<rect class="bp-appl" x="${f(B_.x0)}" y="${f(B_.y0)}" width="${f(B_.x1 - B_.x0)}" height="${f(B_.y1 - B_.y0)}"/>`; }).join('');
        if (type === 'rug') { const B_ = frameRect(fr, -0.9, 0.9, -0.6, 0.6); return `<rect class="bp-appl bp-dash" x="${f(R_.x0)}" y="${f(R_.y0)}" width="${f(R_.x1 - R_.x0)}" height="${f(R_.y1 - R_.y0)}"/><rect class="bp-furnthin" x="${f(B_.x0)}" y="${f(B_.y0)}" width="${f(B_.x1 - B_.x0)}" height="${f(B_.y1 - B_.y0)}"/>`; }
        if (type === 'oven') return box2 + pl(0, -0.3, 0, 0.3, 'bp-furnline');
        if (type === 'toaster') return box2 + pl(-0.05, -0.06, -0.05, 0.06, 'bp-furnthin') + pl(0.05, -0.06, 0.05, 0.06, 'bp-furnthin');
        if (type === 'blender') return `<circle class="bp-appl" cx="${f(fr.cx)}" cy="${f(fr.cy)}" r="${f(0.08)}"/>`;
        if (type === 'standlamp') return `<circle class="bp-appl" cx="${f(fr.cx)}" cy="${f(fr.cy)}" r="${f(0.18)}"/>` + pl(-0.12, 0, 0.12, 0, 'bp-furnthin') + pl(0, -0.12, 0, 0.12, 'bp-furnthin');
        if (type === 'cushion') { const B_ = frameRect(fr, -0.15, 0.15, -0.15, 0.15); return `<rect class="bp-appl" x="${f(R_.x0)}" y="${f(R_.y0)}" width="${f(R_.x1 - R_.x0)}" height="${f(R_.y1 - R_.y0)}" rx="${f(0.04)}"/><path class="bp-furnthin" d="M${f(B_.x0)} ${f(B_.y0)}L${f(fr.cx)} ${f(fr.cy)}L${f(B_.x1)} ${f(B_.y0)}M${f(B_.x0)} ${f(B_.y1)}L${f(fr.cx)} ${f(fr.cy)}L${f(B_.x1)} ${f(B_.y1)}"/>`; }
        if (type === 'fridge') return box2 + pl(0, -0.35, 0, 0.35, 'bp-furnline');
        if (type === 'washer' || type === 'dryer') return `<circle class="bp-appl" cx="${f(fr.cx)}" cy="${f(fr.cy)}" r="${f(Math.min(w, d) / 2)}"/>` + box2;
        if (type === 'washdryer') return `<circle class="bp-appl" cx="${f(fr.cx)}" cy="${f(fr.cy)}" r="${f(Math.min(w, d) / 2 - 0.05)}"/>` + box2;
        if (type === 'freezer' || type === 'watertank') return box2;
        if (type === 'planter') return `<circle class="bp-appl" cx="${f(fr.cx)}" cy="${f(fr.cy)}" r="${f(0.13)}"/><circle class="bp-furnthin" cx="${f(fr.cx)}" cy="${f(fr.cy)}" r="${f(0.07)}"/>` + pl(-0.1, 0, 0.1, 0, 'bp-furnthin') + pl(0, -0.1, 0, 0.1, 'bp-furnthin');
        if (type === 'book') return box2 + pl(-0.09, -0.08, -0.09, 0.08, 'bp-furnthin');
        if (type === 'books') return box2 + pl(-0.05, -0.08, -0.05, 0.08, 'bp-furnthin') + pl(0, -0.08, 0, 0.08, 'bp-furnthin') + pl(0.05, -0.08, 0.05, 0.08, 'bp-furnthin');
        const W_ = frameRect(fr, -0.22, 0.08, -0.12, 0.15);
        return box2 + `<rect class="bp-furnthin" x="${f(W_.x0)}" y="${f(W_.y0)}" width="${f(W_.x1 - W_.x0)}" height="${f(W_.y1 - W_.y0)}"/>`;
      };
      const out = [];
      const st = stBy[state.level], rm = rmBy[state.level];
      const vb = [-PM * s, -PM * s, (state.COLS + 2 * PM) * s, (state.ROWS + 2 * PM) * s];
      out.push(`<rect class="bp-bg" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}"/>`);
  
      let d = '';
      for (let x = 1; x < state.COLS; x++) d += `M${f(x)} 0V${f(state.ROWS)}`;
      for (let y = 1; y < state.ROWS; y++) d += `M0 ${f(y)}H${f(state.COLS)}`;
      out.push(`<path class="bp-grid" d="${d}"/>`);
      out.push(`<rect class="bp-lot" x="0" y="0" width="${f(state.COLS)}" height="${f(state.ROWS)}"/>`);
  
      // dimension lines along the top and left edges, one tick per metre
      const step = Math.max(state.COLS, state.ROWS) > 14 ? 2 : 1;
      const fs = (0.27 * s).toFixed(1);
      let dim = `M0 ${f(-0.6)}H${f(state.COLS)}M${f(-0.6)} 0V${f(state.ROWS)}`;
      let txt = '';
      for (let x = 0; x <= state.COLS; x++) {
        dim += `M${f(x)} ${f(-0.72)}V${f(-0.48)}`;
        if (x % step === 0) txt += `<text class="bp-dimtxt" x="${f(x)}" y="${f(-0.86)}" font-size="${fs}" text-anchor="middle">${x}</text>`;
      }
      for (let y = 0; y <= state.ROWS; y++) {
        dim += `M${f(-0.72)} ${f(y)}H${f(-0.48)}`;
        if (y % step === 0) txt += `<text class="bp-dimtxt" x="${f(-0.86)}" y="${f(y)}" font-size="${fs}" text-anchor="end" dominant-baseline="central">${y}</text>`;
      }
      out.push(`<path class="bp-dim" d="${dim}"/>`, txt);
      out.push(`<text class="bp-dimtxt" x="${f(-0.86)}" y="${f(-0.86)}" font-size="${fs}" text-anchor="end">m</text>`);
  
      // north arrow in the top-right margin
      const nx = state.COLS + PM * 0.52, ny = -PM * 0.62;
      out.push(`<path class="bp-dim" d="M${f(nx)} ${f(ny + 0.32)}V${f(ny - 0.3)}M${f(nx - 0.12)} ${f(ny - 0.16)}L${f(nx)} ${f(ny - 0.3)}L${f(nx + 0.12)} ${f(ny - 0.16)}"/>`);
      out.push(`<text class="bp-dimtxt" x="${f(nx)}" y="${f(ny + 0.6)}" font-size="${fs}" text-anchor="middle" font-weight="700">N</text>`);
  
      // rooms on this floor: a light wash and the floor area
      rm.rooms.forEach(room => {
        room.cells.forEach(([r, c]) => out.push(`<rect class="bp-room" x="${f(c)}" y="${f(r)}" width="${s}" height="${s}"/>` +
          `<rect class="bp-fpat" fill="url(#bpF-${floorStyleAt(state.level, r, c)})" x="${f(c)}" y="${f(r)}" width="${s}" height="${s}"/>`));
      });
      // fenced areas: garden on the ground floor, balcony upstairs (just a plain yard in the basement)
      const areaName = state.level === 0 ? 'Garden' : state.level > 0 ? 'Balcony' : '';
      if (areaName) rm.fenced.rooms.forEach(room => {
        room.cells.forEach(([r, c]) => out.push(`<rect class="${state.level === 0 ? 'bp-garden' : 'bp-balcony'}" x="${f(c)}" y="${f(r)}" width="${s}" height="${s}"/>`));
      });
  
      const rect = (fp, cls, grow = 0) => `<rect class="${cls}" x="${f(fp.x0 - grow)}" y="${f(fp.y0 - grow)}" width="${f(fp.x1 - fp.x0 + 2 * grow)}" height="${f(fp.y1 - fp.y0 + 2 * grow)}"/>`;
      const edgeSVG = (k, v, est) => {
        const e = parseKey(k), fp = segFootprint(e.o, e.r, e.c, est, v.type === 'fence');
        const [[x0, y0]] = edgeEnds(e.o, e.r, e.c);
        // a line along the piece, offset across it by `off` metres
        const along = (off, cls, a0 = 0, a1 = 0) => e.o === 'h'
          ? `<path class="${cls}" d="M${f(fp.x0 + a0)} ${f(y0 + off)}H${f(fp.x1 - a1)}"/>`
          : `<path class="${cls}" d="M${f(x0 + off)} ${f(fp.y0 + a0)}V${f(fp.y1 - a1)}"/>`;
        if (v.type === 'wall') {
          // finishes: masonry = hatched band, lap siding = line, vertical siding = dashed line
          let g = rect(fp, 'bp-wall', 0.01);
          const sd = sidesOf(v);
          [['m', -1], ['p', 1]].forEach(([sk, sg]) => {
            const fin = sd[sk], edgeOff = sg * (T / 2 + 0.035);
            if (fin === 'masonry') {
              const band = e.o === 'h' ? { x0: fp.x0, x1: fp.x1, y0: y0 + sg * T / 2 + (sg < 0 ? -0.06 : 0), y1: y0 + sg * T / 2 + (sg < 0 ? 0 : 0.06) }
                                       : { x0: x0 + sg * T / 2 + (sg < 0 ? -0.06 : 0), x1: x0 + sg * T / 2 + (sg < 0 ? 0 : 0.06), y0: fp.y0, y1: fp.y1 };
              g += rect(band, 'bp-brick');
            } else if (fin === 'lap') g += along(edgeOff, 'bp-lap');
            else if (fin === 'tile') g += along(edgeOff, 'bp-ctile');
            else if (fin === 'vertical') g += along(edgeOff, 'bp-vert');
          });
          return g;
        }
        if (v.type === 'fence' && v.gate) {
          // a gate: like a door — its swing arc, and the leaf either open (at right angles) or shut along the line
          const gg = gateGeom(e.o, e.r, e.c, v.swing | 0, est), [hx, hy] = gg.hinge, [tx, ty] = gg.tip, [sx, sy] = gg.shut;
          const cross = (tx - hx) * (sy - hy) - (ty - hy) * (sx - hx);
          const arc = `<path class="bp-swing" d="M${f(tx)} ${f(ty)}A${f(gg.w)} ${f(gg.w)} 0 0 ${cross > 0 ? 1 : 0} ${f(sx)} ${f(sy)}"/>`;
          const leafLine = v.open ? `<path class="bp-leaf" style="stroke-width:1.6" d="M${f(hx)} ${f(hy)}L${f(tx)} ${f(ty)}"/>` : `<path class="bp-leaf" style="stroke-width:1.6" d="M${f(hx)} ${f(hy)}L${f(sx)} ${f(sy)}"/>`;
          return arc + leafLine;
        }
        if (v.type === 'fence') {
          const fs = fenceBase(styleOf(v, 'fence'));
          if (fs === 'board') return rect(fp, 'bp-fboard');
          if (fs === 'chain') return along(0, 'bp-chain');
          if (fs === 'lattice') {
            const n = Math.max(2, Math.round((e.o === 'h' ? fp.x1 - fp.x0 : fp.y1 - fp.y0) / 0.16));
            let d = '';
            for (let i = 0; i <= n; i++) {
              const t = i / n, w = (i % 2 ? 1 : -1) * FENCE_T / 2;
              const px = e.o === 'h' ? fp.x0 + t * (fp.x1 - fp.x0) : x0 + w, py = e.o === 'h' ? y0 + w : fp.y0 + t * (fp.y1 - fp.y0);
              d += (i ? 'L' : 'M') + f(px) + ' ' + f(py);
            }
            return rect(fp, 'bp-fence') + `<path class="bp-latt" d="${d}"/>`;
          }
          return rect(fp, 'bp-fence');
        }
        if (v.type === 'window') {
          const ws = styleOf(v, 'window');
          let g = rect(fp, 'bp-win');
          if (ws === 'round') {
            const cx = e.o === 'h' ? (fp.x0 + fp.x1) / 2 : x0, cy = e.o === 'h' ? y0 : (fp.y0 + fp.y1) / 2;
            return g + along(0, 'bp-glass', 0.2, 0.2) + `<circle class="bp-glass" cx="${f(cx)}" cy="${f(cy)}" r="${f(0.2)}"/>`;
          }
          if (ws === 'clerestory') return g + along(0, 'bp-glass bp-dash');
          if (ws === 'fullheight') return g + along(-0.025, 'bp-glass') + along(0.025, 'bp-glass');
          const mid = e.o === 'h' ? `M${f((fp.x0 + fp.x1) / 2)} ${f(y0 - T / 2)}V${f(y0 + T / 2)}` : `M${f(x0 - T / 2)} ${f((fp.y0 + fp.y1) / 2)}H${f(x0 + T / 2)}`;
          return g + along(0, 'bp-glass') + `<path class="bp-win" d="${mid}"/>`;
        }
        if (v.closed) return rect(thinAcross(fp, e.o, 0.07), 'bp-closed');
        const dg = doorGeom(e.o, e.r, e.c, v.swing | 0, est);
        const [hx, hy] = dg.hinge, [tx, ty] = dg.tip, [sx, sy] = dg.shut;
        const cross = (tx - hx) * (sy - hy) - (ty - hy) * (sx - hx);
        return `<path class="bp-leaf" d="M${f(hx)} ${f(hy)}L${f(tx)} ${f(ty)}"/>` +
               `<path class="bp-swing" d="M${f(tx)} ${f(ty)}A${f(dg.w)} ${f(dg.w)} 0 0 ${cross > 0 ? 1 : 0} ${f(sx)} ${f(sy)}"/>`;
      };
      // column: a solid square with a cross, the usual plan symbol
      const colSVG = (k, styles) => {
        const fp = colFootprint(k), [X, Y] = colXY(k);
        if (styles && styles.get(k) === 'round')
          return `<circle class="bp-col" cx="${f(X / 2)}" cy="${f(Y / 2)}" r="${f(COL_W / 2)}"/><path class="bp-colx" d="M${f(X / 2 - 0.08)} ${f(Y / 2 - 0.08)}L${f(X / 2 + 0.08)} ${f(Y / 2 + 0.08)}M${f(X / 2 + 0.08)} ${f(Y / 2 - 0.08)}L${f(X / 2 - 0.08)} ${f(Y / 2 + 0.08)}"/>`;
        return rect(fp, 'bp-col') + `<path class="bp-colx" d="M${f(fp.x0 + 0.05)} ${f(fp.y0 + 0.05)}L${f(fp.x1 - 0.05)} ${f(fp.y1 - 0.05)}M${f(fp.x1 - 0.05)} ${f(fp.y0 + 0.05)}L${f(fp.x0 + 0.05)} ${f(fp.y1 - 0.05)}"/>`;
      };
      const postSVG = (pk, fence) => {
        const [x, y] = pk.split(',').map(Number), hw = (fence ? FPOST : T) / 2;
        return rect({ x0: x - hw, x1: x + hw, y0: y - hw, y1: y + hw }, fence ? 'bp-fpost' : 'bp-wall', fence ? 0 : 0.01);
      };
      const pt = (st, u, v) => lanePt(st, u, v).map(f).join(' ');
      // an arrow along a path of lane points, with a label at its start
      const arrowPath = (st, path, label) => {
        const n = path.length, [ux, uy] = path[n - 1], [px, py] = path[n - 2], len = Math.hypot(ux - px, uy - py) || 1, dx = (ux - px) / len, dy = (uy - py) / len;
        const tip = [ux, uy], back = [ux - dx * 0.3, uy - dy * 0.3], sideA = [back[0] - dy * 0.16, back[1] + dx * 0.16], sideB = [back[0] + dy * 0.16, back[1] - dx * 0.16];
        const line = path.slice(0, -1).map(q => pt(st, ...q)).concat([pt(st, ux - dx * 0.12, uy - dy * 0.12)]);
        const [lx, ly] = lanePt(st, path[0][0] - (path[1][0] - path[0][0] ? Math.sign(path[1][0] - path[0][0]) * 0.27 : 0), path[0][1] - (path[1][1] - path[0][1] ? Math.sign(path[1][1] - path[0][1]) * 0.27 : 0));
        return `<path class="bp-arrow" d="M${line.join('L')}"/><path class="bp-arrowhead" d="M${pt(st, ...tip)}L${pt(st, ...sideA)}L${pt(st, ...sideB)}Z"/>` +
               `<text class="bp-stairtxt" x="${f(lx)}" y="${f(ly)}" font-size="${(0.24 * s).toFixed(1)}" text-anchor="middle" dominant-baseline="central">${label}</text>`;
      };
      const stairSVG = st => {
        const lay = stairLayout(st);
        let g = '', tr = '';
        lay.flights.forEach(fl => {
          g += rect(flightRect(st, fl, fl.from, fl.to), 'bp-stair');
          for (let k = 1; k < fl.n; k++) {
            const t = fl.from + (fl.to - fl.from) * k / fl.n;
            tr += fl.axis === 'u' ? `M${pt(st, t, fl.a0)}L${pt(st, t, fl.a1)}` : `M${pt(st, fl.a0, t)}L${pt(st, fl.a1, t)}`;
          }
        });
        lay.landings.forEach(ld => { g += rect(laneRect(st, ld.u0, ld.u1, ld.v0, ld.v1), 'bp-stair'); });
        if (isCantilever(st)) g = g.replace(/class="bp-stair"/g, 'class="bp-stair bp-dash"');
        return g + `<path class="bp-tread" d="${tr}"/>` + arrowPath(st, lay.path, 'UP');
      };
  
      // the storey below, faintly, as a guide for lining up walls
      if (state.level - 1 >= MIN_LEVEL) {
        let g = '';
        const below = state.floors[state.level - 1], bst = { edges: below.edges, colSet: below.columns };
        below.edges.forEach((v, k) => { g += edgeSVG(k, v, bst); });
        const bposts = postList(bst);
        bposts.forEach((kind, pk) => { g += postSVG(pk, bposts.fenceOnly.has(pk)); });
        below.columns.forEach(k => { g += colSVG(k, below.colStyles); });
        out.push(`<g class="bp below">${g}</g>`);
        // stair holes: flights coming up from below
        state.floors[state.level - 1].stairs.forEach(st => {
          const holes = stairCellRects(st).map(r2 => rect(r2, 'bp-hole')).join('');
          out.push(`<g class="bp">${holes}${arrowPath(st, stairLayout(st).path.slice().reverse(), 'DN')}</g>`);
        });
      }
  
      const labelled = [...rm.rooms.map(room => [room, '']), ...(areaName ? rm.fenced.rooms.map(room => [room, areaName]) : [])];
      labelled.forEach(([room, name]) => {
        // keep the area label off a column standing in the middle of a square, and off furniture
        let [lr, lc] = room.label;
        const blocked = (r, c) => st.colSet.has(colKey(2 * c + 1, 2 * r + 1)) ||
          st.furniture.some(({ f: fu }) => rectsOverlap(furnRect(fu), { x0: c + 0.1, x1: c + 0.9, y0: r + 0.25, y1: r + 0.75 }));
        if (blocked(lr, lc)) {
          const free = room.cells.filter(([r, c]) => !blocked(r, c));
          if (free.length) [lr, lc] = free.reduce((best, cell) =>
            ((cell[0] - lr) ** 2 + (cell[1] - lc) ** 2 < (best[0] - lr) ** 2 + (best[1] - lc) ** 2 ? cell : best));
        }
        const area = `<text class="bp-area" x="${f(lc + 0.5)}" y="${f(lr + (name ? 0.68 : 0.5))}" font-size="${(0.34 * s).toFixed(1)}" text-anchor="middle" dominant-baseline="central">${room.cells.length} m²</text>`;
        out.push(name ? `<text class="bp-areaname" x="${f(lc + 0.5)}" y="${f(lr + 0.3)}" font-size="${(0.26 * s).toFixed(1)}" text-anchor="middle" dominant-baseline="central">${name}</text>` + area : area);
      });
  
      st.edges.forEach((v, k) => out.push(`<g class="bp ${st.ghost && st.ghost.has(k) ? 'ghost' : ''}">${edgeSVG(k, v, st)}</g>`));
      if (st.gone) st.gone.forEach((v, k) => out.push(`<g class="bp gone">${edgeSVG(k, v, st)}</g>`));
      const posts = postList(st);
      posts.forEach((kind, pk) => out.push(`<g class="bp ${kind === 'solid' ? '' : kind}">${postSVG(pk, posts.fenceOnly.has(pk))}</g>`));
      st.columns.forEach(({ k, cls }) => out.push(`<g class="bp ${cls}">${colSVG(k, st.colStyles)}</g>`));
      // pools: water on the ground floor, a hatched no-build area in the basement
      if (state.level === 0) st.pools.forEach(({ q, cls }) => {
        const R_ = { x0: q.c0, x1: q.c1, y0: q.r0, y1: q.r1 };
        let wv = '';
        for (let y = q.r0 + 0.5; y < q.r1; y += 1) for (let x = q.c0 + 0.25; x < q.c1 - 0.2; x += 1)
          wv += `M${f(x)} ${f(y)}q${f(0.125)} ${f(-0.08)} ${f(0.25)} 0t${f(0.25)} 0`;
        out.push(`<g class="bp ${cls}">${rect(R_, 'bp-pool')}${rect({ x0: R_.x0 + 0.12, x1: R_.x1 - 0.12, y0: R_.y0 + 0.12, y1: R_.y1 - 0.12 }, 'bp-poolin')}<path class="bp-wave" d="${wv}"/>` +
          `<text class="bp-areaname" x="${f((R_.x0 + R_.x1) / 2)}" y="${f(R_.y0 + 0.3)}" font-size="${(0.26 * s).toFixed(1)}" text-anchor="middle" dominant-baseline="central">Pool</text>` +
          `<text class="bp-area" x="${f((R_.x0 + R_.x1) / 2)}" y="${f(R_.y0 + 0.68)}" font-size="${(0.3 * s).toFixed(1)}" text-anchor="middle" dominant-baseline="central">${(q.c1 - q.c0) * (q.r1 - q.r0)} m²</text></g>`);
      });
      if (state.level < 0) state.floors[0].pools.forEach(q => {
        const R_ = { x0: q.c0, x1: q.c1, y0: q.r0, y1: q.r1 };
        out.push(rect(R_, 'bp-blocked') + `<text class="bp-areaname" x="${f((R_.x0 + R_.x1) / 2)}" y="${f((R_.y0 + R_.y1) / 2)}" font-size="${(0.26 * s).toFixed(1)}" text-anchor="middle" dominant-baseline="central">Pool above</text>`);
      });
      st.appliances.forEach(({ a, cls }) => { if (a.type === 'rug') out.push(`<g class="bp ${cls}">${applPlanSVG(a.type, applFrame(a))}</g>`); });
      // furniture: outlines, a chair's back, a bed's pillows and duvet fold
      st.furniture.forEach(({ f, cls }) => {
        const R_ = furnRect(f), ln = (u0, v0, u1, v1, c2) => { const a = furnPt(f, u0, v0), b = furnPt(f, u1, v1); return `<path class="${c2}" d="M${f_(a[0])} ${f_(a[1])}L${f_(b[0])} ${f_(b[1])}"/>`; };
        let g = rect(R_, 'bp-furn');
        if (f.type === 'chair') g += ln(-0.2, -0.205, 0.2, -0.205, 'bp-furnline');
        else if (isSofa(f.type)) {
          const { w, d, seats } = FURN[f.type], hw = w / 2, hd = d / 2, a = 0.16, bd = 0.2, cw = (w - 2 * a) / seats;
          g += ln(-hw + 0.04, -hd + 0.1, hw - 0.04, -hd + 0.1, 'bp-furnline');
          g += rect(furnLocal(f, -hw, -hw + a, -hd + bd, hd), 'bp-furnthin') + rect(furnLocal(f, hw - a, hw, -hd + bd, hd), 'bp-furnthin');
          for (let i = 1; i < seats; i++) g += ln(-hw + a + i * cw, -hd + bd, -hw + a + i * cw, hd, 'bp-furnthin');
        }
        else if (f.type === 'bed') {
          g += ln(-0.7, -0.97, 0.7, -0.97, 'bp-furnline') + ln(-0.7, -0.35, 0.7, -0.35, 'bp-furnthin');
          g += rect(furnLocal(f, -0.62, -0.06, -0.9, -0.6), 'bp-furnthin') + rect(furnLocal(f, 0.06, 0.62, -0.9, -0.6), 'bp-furnthin');
        } else if (f.type === 'bookshelf') {
          g += ln(-0.42, -0.19, 0.42, -0.19, 'bp-furnline') + ln(-0.3, -0.12, -0.3, 0.17, 'bp-furnthin') + ln(0, -0.12, 0, 0.17, 'bp-furnthin') + ln(0.3, -0.12, 0.3, 0.17, 'bp-furnthin');
        } else if (f.type === 'officechair') {
          g = `<circle class="bp-furn" cx="${f_(furnPt(f, 0, 0)[0])}" cy="${f_(furnPt(f, 0, 0)[1])}" r="${f_(0.27)}"/>` + ln(-0.2, -0.25, 0.2, -0.25, 'bp-furnline');
        } else if (f.type === 'tvstand') {
          g += ln(-0.56, -0.17, 0.56, -0.17, 'bp-furnthin');
        } else if (f.type === 'dresser') {
          g += ln(-0.48, 0.22, 0.48, 0.22, 'bp-furnthin') + ln(0, 0.22, 0, 0.25, 'bp-furnthin');
        } else if (f.type === 'wardrobe') {
          // a hanging rail along the middle, with a few hangers across it
          g += ln(-0.45, 0, 0.45, 0, 'bp-furnthin') + [-0.3, -0.1, 0.1, 0.3].map(u => ln(u - 0.05, -0.2, u + 0.05, 0.2, 'bp-furnthin')).join('');
        } else if (f.type === 'sidetable') {
          g += [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const [lx, ly] = furnPt(f, a * 0.21, b * 0.21); return `<circle class="bp-furnthin" cx="${f_(lx)}" cy="${f_(ly)}" r="${f_(0.03)}"/>`; }).join('');
        } else if (f.type === 'nightstand') {
          const [kx, ky] = furnPt(f, 0, 0.16);
          g += `<circle class="bp-furnthin" cx="${f_(kx)}" cy="${f_(ky)}" r="${f_(0.025)}"/>`;
        } else if (f.type === 'mirrorcab') {
          g = `<rect class="bp-furn bp-dash" x="${f_(R_.x0)}" y="${f_(R_.y0)}" width="${f_(R_.x1 - R_.x0)}" height="${f_(R_.y1 - R_.y0)}"/>`;
        } else if (f.type === 'acwindow' || f.type === 'acsplit' || f.type === 'accondenser' || f.type === 'exhaustfan' || f.type === 'radiator' || f.type === 'waterheater' || f.type === 'wallcabinet') {
          g = `<rect class="bp-furn bp-dash" x="${f_(R_.x0)}" y="${f_(R_.y0)}" width="${f_(R_.x1 - R_.x0)}" height="${f_(R_.y1 - R_.y0)}"/>`;
        } else if (f.type === 'toilet') {
          const B_ = furnLocal(f, -0.17, 0.17, -0.15, 0.33);
          g = rect(furnLocal(f, -0.2, 0.2, -0.35, -0.17), 'bp-furn') + `<ellipse class="bp-furn" cx="${f_((B_.x0 + B_.x1) / 2)}" cy="${f_((B_.y0 + B_.y1) / 2)}" rx="${f_((B_.x1 - B_.x0) / 2)}" ry="${f_((B_.y1 - B_.y0) / 2)}"/>`;
        } else if (f.type === 'washbasin' || f.type === 'bathtub') {
          const B_ = f.type === 'bathtub' ? furnLocal(f, -0.3, 0.3, -0.75, 0.78) : furnLocal(f, -0.21, 0.21, -0.15, 0.18);
          g += `<rect class="bp-furnthin" x="${f_(B_.x0)}" y="${f_(B_.y0)}" width="${f_(B_.x1 - B_.x0)}" height="${f_(B_.y1 - B_.y0)}" rx="${f_(0.1)}"/>`;
          const [dx, dy] = furnPt(f, 0, f.type === 'bathtub' ? -0.6 : -0.06);
          g += `<circle class="bp-furnthin" cx="${f_(dx)}" cy="${f_(dy)}" r="${f_(0.03)}"/>`;
        } else if (f.type === 'shower') {
          // a shower head (circle with a cross) and the hot and cold valves on the wall
          const [hx, hy] = furnPt(f, 0, 0.05), [vx1, vy1] = furnPt(f, -0.125, -0.12), [vx2, vy2] = furnPt(f, 0.125, -0.12);
          g = `<circle class="bp-furn" cx="${f_(hx)}" cy="${f_(hy)}" r="${f_(0.09)}"/>` + ln(-0.06, 0.05, 0.06, 0.05, 'bp-furnthin') + ln(0, -0.01, 0, 0.11, 'bp-furnthin') +
              `<circle class="bp-fpost" cx="${f_(vx1)}" cy="${f_(vy1)}" r="${f_(0.035)}"/><circle class="bp-fpost" cx="${f_(vx2)}" cy="${f_(vy2)}" r="${f_(0.035)}"/>`;
        } else if (f.type === 'wallshelf') {
          g = `<rect class="bp-furn bp-dash" x="${f_(R_.x0)}" y="${f_(R_.y0)}" width="${f_(R_.x1 - R_.x0)}" height="${f_(R_.y1 - R_.y0)}"/>`;
        } else if (f.type === 'countertop') {
          const hw = furnDims(f).w / 2;
          g += ln(-hw + 0.02, 0.26, hw - 0.02, 0.26, 'bp-furnthin');
        } else g += rect(furnLocal(f, -0.5, 0.5, -0.3, 0.3), 'bp-furnthin');
        (f.items || []).forEach(it => { g += applPlanSVG(it.type, itemFrame(f, it)); });
        out.push(`<g class="bp ${cls}">${g}</g>`);
      });
      st.appliances.forEach(({ a, cls }) => { if (a.type !== 'rug') out.push(`<g class="bp ${cls}">${applPlanSVG(a.type, applFrame(a))}</g>`); });
      // roofs on this floor: dashed outline, ridge line (gable) or a downhill arrow (shed)
      st.roofs.forEach(({ r, cls }) => {
        if (!cls && !state.showRoofs) return;
        const R_ = roofRect(r);
        let g = rect(R_, 'bp-roof');
        if (isGable(r.type)) {
          g += r.dir ? `<path class="bp-ridge" d="M${f((R_.x0 + R_.x1) / 2)} ${f(R_.y0)}V${f(R_.y1)}"/>` : `<path class="bp-ridge" d="M${f(R_.x0)} ${f((R_.y0 + R_.y1) / 2)}H${f(R_.x1)}"/>`;
        } else if (isShed(r.type)) {
          const cx = (R_.x0 + R_.x1) / 2, cy = (R_.y0 + R_.y1) / 2, [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][r.dir % 4];
          const hl = Math.min(0.9, (dx ? R_.x1 - R_.x0 : R_.y1 - R_.y0) * 0.3);
          const tx = cx + dx * hl, ty = cy + dy * hl, bx = cx - dx * hl, by = cy - dy * hl;
          g += `<path class="bp-ridge" d="M${f(bx)} ${f(by)}L${f(tx - dx * 0.15)} ${f(ty - dy * 0.15)}"/>` +
               `<path class="bp-arrowhead" d="M${f(tx)} ${f(ty)}L${f(tx - dx * 0.3 - dy * 0.14)} ${f(ty - dy * 0.3 + dx * 0.14)}L${f(tx - dx * 0.3 + dy * 0.14)} ${f(ty - dy * 0.3 - dx * 0.14)}Z"/>`;
        } else {
          g += `<text class="bp-rooftxt" x="${f((R_.x0 + R_.x1) / 2)}" y="${f(R_.y1 - 0.3)}" font-size="${(0.24 * s).toFixed(1)}" text-anchor="middle">flat roof</text>`;
        }
        out.push(`<g class="bp ${cls}">${g}</g>`);
      });
      if (hooks.showHandles()) st.roofs.forEach(({ r, cls }) => {
        if (cls === 'gone') return;
        roofCorners(r).forEach(([X, Y]) => out.push(`<rect class="bp-handle" x="${f(X / 2 - 0.13)}" y="${f(Y / 2 - 0.13)}" width="${f(0.26)}" height="${f(0.26)}" rx="2"/>`));
      });
      // Style tool: what is selected (and under the mouse)
      if (state.currentTool === 'style') {
        const mark = (t, cls) => {
          if (!t) return;
          if (t.kind === 'stair') { const st = state.floors[state.level].stairs[t.k]; if (st) stairCellRects(st).forEach(r2 => out.push(rect({ x0: r2.x0 + 0.05, x1: r2.x1 - 0.05, y0: r2.y0 + 0.05, y1: r2.y1 - 0.05 }, cls === 'bp-sel' ? 'bp-selring' : 'bp-selring bp-dash'))); return; }
          if (t.kind === 'appl') { const a = state.floors[state.level].appliances[t.k]; if (a) { const R_ = applRect(a); out.push(rect({ x0: R_.x0 - 0.06, x1: R_.x1 + 0.06, y0: R_.y0 - 0.06, y1: R_.y1 + 0.06 }, cls === 'bp-sel' ? 'bp-selring' : 'bp-selring bp-dash')); } return; }
          if (t.kind === 'roof') { const r = state.floors[state.level].roofs[t.k]; if (r) { const R_ = roofRect(r); out.push(rect({ x0: R_.x0 - 0.1, x1: R_.x1 + 0.1, y0: R_.y0 - 0.1, y1: R_.y1 + 0.1 }, cls === 'bp-sel' ? 'bp-selring' : 'bp-selring bp-dash')); } return; }
          if (t.kind === 'col') { const fp = colFootprint(t.k); out.push(rect({ x0: fp.x0 - 0.08, x1: fp.x1 + 0.08, y0: fp.y0 - 0.08, y1: fp.y1 + 0.08 }, cls === 'bp-sel' ? 'bp-selring' : 'bp-selring bp-dash')); return; }
          if (t.kind === 'floor') {
            t.cells.forEach(k => { const [r, c] = k.split(',').map(Number); out.push(`<rect class="${cls === 'bp-sel' ? 'bp-selfloor' : 'bp-hselfloor'}" x="${f(c)}" y="${f(r)}" width="${s}" height="${s}"/>`); });
            return;
          }
          [...hooks.selKeys(t)].forEach(k => {
            const e = parseKey(k), [[x0, y0], [x1, y1]] = edgeEnds(e.o, e.r, e.c);
            out.push(`<line class="${cls}" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}"/>`);
          });
        };
        if (state.hoverTarget && hooks.selKey(state.hoverTarget) !== hooks.selKey(state.selection)) mark(state.hoverTarget, 'bp-hsel');
        if (state.selection && state.selection.L === state.level) mark(state.selection, 'bp-sel');
        if (state.marquee) out.push(rect(state.marquee, 'bp-marquee'));
        const side = hooks.selectedSide();
        if (side) {
          const e = parseKey(state.selection.k), [[x0, y0], [x1, y1]] = edgeEnds(e.o, e.r, e.c), sg = side === 'p' ? 1 : -1;
          const band = e.o === 'h'
            ? { x0: x0 + 0.1, x1: x1 - 0.1, y0: y0 + sg * (T / 2 + 0.05) - 0.04, y1: y0 + sg * (T / 2 + 0.05) + 0.04 }
            : { x0: x0 + sg * (T / 2 + 0.05) - 0.04, x1: x0 + sg * (T / 2 + 0.05) + 0.04, y0: y0 + 0.1, y1: y1 - 0.1 };
          out.push(rect(band, 'bp-selside'));
        }
      }
      st.stairs.forEach(({ s, cls }) => out.push(`<g class="bp ${cls}">${stairSVG(s)}</g>`));
  
      if (state.hover && !state.drag) {
        const [[x0, y0], [x1, y1]] = edgeEnds(state.hover.o, state.hover.r, state.hover.c);
        out.push(`<line class="bp-hov${state.currentTool === 'erase' ? ' erase' : ''}" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}"/>`);
      }
  
      // with both views showing, mark the corner the 3D camera looks from
      if (state.viewMode === 'both') {
        const A = state.rot % 2 ? state.ROWS : state.COLS, B = state.rot % 2 ? state.COLS : state.ROWS;
        const cnr = unrot(A, B);
        const dx = cnr.x > state.COLS / 2 ? 1 : -1, dy = cnr.y > state.ROWS / 2 ? 1 : -1;
        const ex = cnr.x + dx * 0.62, ey = cnr.y + dy * 0.62;
        const ang = Math.atan2(-dy, -dx), w = 0.42;
        const ax = ex + Math.cos(ang - w) * 0.5, ay = ey + Math.sin(ang - w) * 0.5;
        const bx = ex + Math.cos(ang + w) * 0.5, by = ey + Math.sin(ang + w) * 0.5;
        out.push(`<path class="bp-mark" d="M${f(ax)} ${f(ay)}L${f(ex)} ${f(ey)}L${f(bx)} ${f(by)}"/><circle class="bp-markfill" cx="${f(ex)}" cy="${f(ey)}" r="${(0.1 * s).toFixed(1)}"><title>The 3D view looks from here</title></circle>`);
      }
  
      hooks.setViewBox('plan', vb);
      const defs = '<defs>' +
        '<pattern id="bpF-hardwood" width="40" height="6.4" patternUnits="userSpaceOnUse"><path d="M0 6.4H40M14 0V6.4" style="stroke:var(--bp-ink);stroke-width:.6;opacity:.22"/></pattern>' +
        '<pattern id="bpF-tile" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M0 0H20M0 0V20" style="stroke:var(--bp-ink);stroke-width:.8;opacity:.3"/></pattern>' +
        '<pattern id="bpF-carpet" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" style="fill:var(--bp-ink);opacity:.3"/><circle cx="5.5" cy="5.5" r=".8" style="fill:var(--bp-ink);opacity:.3"/></pattern>' +
        '<pattern id="bpHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" style="stroke:var(--bp-ink);stroke-width:1.2"/></pattern>' + '</defs>';
      return defs + out.join('');
    }
    const roofCorners = r => [[r.X0, r.Y0], [r.X1, r.Y0], [r.X1, r.Y1], [r.X0, r.Y1]];
    // move everything on every floor by (dc, dr) squares into a grid of newCols × newRows;
    // whatever ends up outside is dropped
    function shiftContent(dc, dr, newCols, newRows) {
      LEVELS.forEach(L => {
        const m = new Map();
        state.floors[L].edges.forEach((v, k) => {
          const e = parseKey(k), r = e.r + dr, c = e.c + dc;
          if (validEdge(e.o, r, c, newCols, newRows)) m.set(key(e.o, r, c), v);
        });
        const stairs = state.floors[L].stairs.map(s => ({ ...s, r: s.r + dr, c: s.c + dc }))
          .filter(s => stairCells(s).every(([r, c]) => r >= 0 && r < newRows && c >= 0 && c < newCols));
        const columns = new Set([...state.floors[L].columns].map(colXY).map(([X, Y]) => [X + 2 * dc, Y + 2 * dr])
          .filter(([X, Y]) => X >= 0 && Y >= 0 && X <= 2 * newCols && Y <= 2 * newRows).map(([X, Y]) => colKey(X, Y)));
        const colStyles = new Map();
        state.floors[L].colStyles.forEach((v, k) => { const [X, Y] = colXY(k), nk = colKey(X + 2 * dc, Y + 2 * dr); if (columns.has(nk)) colStyles.set(nk, v); });
        const roofs = state.floors[L].roofs.map(r => ({ ...r, X0: r.X0 + 2 * dc, X1: r.X1 + 2 * dc, Y0: r.Y0 + 2 * dr, Y1: r.Y1 + 2 * dr }))
          .filter(r => r.X0 >= 0 && r.Y0 >= 0 && r.X1 <= 2 * newCols && r.Y1 <= 2 * newRows);
        const floorStyles = new Map();
        state.floors[L].floorStyles.forEach((v, k) => { const [r, c] = k.split(',').map(Number), nr = r + dr, nc = c + dc; if (nr >= 0 && nr < newRows && nc >= 0 && nc < newCols) floorStyles.set(nr + ',' + nc, v); });
        const pools = state.floors[L].pools.map(q => ({ c0: q.c0 + dc, c1: q.c1 + dc, r0: q.r0 + dr, r1: q.r1 + dr }))
          .filter(q => q.c0 >= 0 && q.r0 >= 0 && q.c1 <= newCols && q.r1 <= newRows);
        const inNew = R_ => R_.x0 >= -0.001 && R_.y0 >= -0.001 && R_.x1 <= newCols + 0.001 && R_.y1 <= newRows + 0.001;
        const furniture = state.floors[L].furniture.map(o => {
          if (!onLine(o)) return { ...o, X: o.X + 2 * dc, Y: o.Y + 2 * dr };
          const e = parseKey(o.ek); return { ...o, ek: key(e.o, e.r + dr, e.c + dc) };
        }).filter(o => hung(o) ? m.has(o.ek) : o.type === 'countertop' ? (() => { const e = parseKey(o.ek); return validEdge(e.o, e.r, e.c, newCols, newRows) && inNew(furnRect(o)); })() : inNew(furnRect(o)));
        const appliances = state.floors[L].appliances.map(a => ({ ...a, X: a.X + 2 * dc, Y: a.Y + 2 * dr })).filter(a => inNew(applRect(a)));
        state.floors[L] = { edges: m, stairs, columns, colStyles, roofs, floorStyles, pools, furniture, appliances };
      });
    }
  
    /* ═══════════════ SAVE / OPEN (JSON file) ═══════════════ */
    // File format, version 10:
    // { app: "house-builder", version: 2, cols, rows,
    //   floors: [{ level: -1…2,
    //              edges:  [{ o: "h" | "v", r, c, type: wall|door|window|fence, swing?, closed?,
    //                          style?, sides?: { m, p } }],   (style for doors/windows/fences, sides = wall finish)
    //              stairs: [{ r, c, dir: 0 N | 1 E | 2 S | 3 W, type: straight|quarter|half, hand: 0 right | 1 left, style: solid|cantilever }],
    //              columns: [{ x, y, style? }],      (metres; whole = corner, .5 = middle of a square)
    //              roofs: [{ x0, y0, x1, y1, type: flat|gable|opengable|shed|openshed, material: clay|concrete|metal, dir }],
    //              floorStyles: [{ r, c, style: tile|carpet }],   (squares not listed are hardwood)
    //              pools: [{ x0, y0, x1, y1 }],   (ground floor only, whole squares)
    //              furniture: [{ type, x, y, dir, items? }      (centre in metres, on a column spot)
    //                        | { type: "wallshelf" | "shower", edge: { o, r, c }, side: "m"|"p", items? }
    //                        | { type: "countertop", edge: { o, r, c }, side, insets: [start, end], items? }],
    //                 items: [{ type: tv|lamp|microwave, level, slot: "C"|"L"|"R", dir }]   (appliances on the piece)
    //              appliances: [{ type, x, y, dir }] }] }   (appliances on the floor)
    // Version 1 files (one floor, no stairs) open as the ground floor;
    // version 2 files simply have no columns, version 3 no fences, version 4 no styles, version 5 no roofs, version 6 no floor styles, version 7 no pools, version 8 no furniture, version 9 no appliances or shelves, version 10 no gates (fence edges may carry gate, swing and open), version 11 only straight solid stairs (stairs now carry type, hand and style).
    const SAVE_APP = 'house-builder', SAVE_VERSION = 12;
    const TYPES = ['wall', 'door', 'window', 'fence'];
  
    function serializeHouse() {
      return {
        app: SAVE_APP, version: SAVE_VERSION, savedAt: new Date().toISOString(),
        cols: state.COLS, rows: state.ROWS,
        floors: LEVELS.map(L => ({
          level: L,
          edges: [...state.floors[L].edges].map(([k, v]) => {
            const e = parseKey(k), o = { o: e.o, r: e.r, c: e.c, type: v.type };
            if (v.type === 'door') { o.swing = v.swing | 0; if (v.closed) o.closed = true; }
            if (v.type === 'fence' && v.gate) { o.gate = true; o.swing = v.swing | 0; if (v.open) o.open = true; }
            if (v.style) o.style = v.style;
            if (v.sides) o.sides = { ...v.sides };
            return o;
          }),
          stairs: state.floors[L].stairs.map(st => ({ r: st.r, c: st.c, dir: st.dir, type: sType(st), hand: st.hand | 0, style: st.style || 'solid' })),
          furniture: state.floors[L].furniture.map(o => {
            const items = (o.items || []).map(it => ({ type: it.type, level: it.lvl, slot: it.slot, dir: it.rdir }));
            if (hung(o)) { const e = parseKey(o.ek); return { type: o.type, edge: { o: e.o, r: e.r, c: e.c }, side: o.side, items }; }
            if (o.type === 'countertop') { const e = parseKey(o.ek); return { type: o.type, edge: { o: e.o, r: e.r, c: e.c }, side: o.side, insets: [o.i0 || 0, o.i1 || 0], items }; }
            return items.length ? { type: o.type, x: o.X / 2, y: o.Y / 2, dir: o.dir, items } : { type: o.type, x: o.X / 2, y: o.Y / 2, dir: o.dir };
          }),
          appliances: state.floors[L].appliances.map(a => a.color ? { type: a.type, x: a.X / 2, y: a.Y / 2, dir: a.dir, color: a.color } : { type: a.type, x: a.X / 2, y: a.Y / 2, dir: a.dir }),
          pools: state.floors[L].pools.map(q => ({ x0: q.c0, y0: q.r0, x1: q.c1, y1: q.r1 })),
          floorStyles: [...state.floors[L].floorStyles].map(([k, v]) => { const [r, c] = k.split(',').map(Number); return { r, c, style: v }; }),
          roofs: state.floors[L].roofs.map(r => ({ x0: r.X0 / 2, y0: r.Y0 / 2, x1: r.X1 / 2, y1: r.Y1 / 2, type: r.type, material: r.mat, dir: r.dir })),
          columns: [...state.floors[L].columns].map(k => { const [X, Y] = colXY(k), c = { x: X / 2, y: Y / 2 }; if (state.floors[L].colStyles.has(k)) c.style = state.floors[L].colStyles.get(k); return c; })
        }))
      };
    }
    function validateHouse(data) {
      if (!data || typeof data !== 'object' || data.app !== SAVE_APP) throw new Error("This isn't a House Builder file.");
      if (typeof data.version !== 'number' || data.version > SAVE_VERSION) throw new Error('This file was made by a newer version of the House Builder.');
      const cols = Math.round(Number(data.cols)), rows = Math.round(Number(data.rows));
      if (!(cols >= MIN_SIZE && cols <= MAX_SIZE && rows >= MIN_SIZE && rows <= MAX_SIZE)) throw new Error('The grid size in this file is not valid.');
      const out = {};
      LEVELS.forEach(L => { out[L] = emptyLevel(); });
      (Array.isArray(data.floors) ? data.floors : []).forEach((fl, i) => {
        if (!fl) return;
        const L = Number.isInteger(fl.level) ? fl.level : i;
        if (!LEVELS.includes(L)) return;
        (Array.isArray(fl.edges) ? fl.edges : []).forEach(x => {
          if (!x || !validEdge(x.o, x.r, x.c, cols, rows) || !TYPES.includes(x.type)) return;
          const v = { type: x.type };
          if (x.type === 'door') { v.swing = [0, 1, 2, 3].includes(x.swing) ? x.swing : 0; if (x.closed === true) v.closed = true; }
          if (x.type === 'fence' && x.gate === true) { v.gate = true; v.swing = [0, 1, 2, 3].includes(x.swing) ? x.swing : 0; if (x.open === true) v.open = true; }
          if (x.type !== 'wall' && styleOK(x.type, x.style)) v.style = x.style;
          if (x.type !== 'fence' && x.sides && typeof x.sides === 'object') {
            const sd = {}; ['m', 'p'].forEach(sk => { if (styleOK('wall', x.sides[sk])) sd[sk] = x.sides[sk]; });
            if (sd.m || sd.p) v.sides = sd;
          }
          out[L].edges.set(key(x.o, x.r, x.c), v);
        });
        (Array.isArray(fl.columns) ? fl.columns : []).forEach(x => {
          if (!x) return;
          const X = Number(x.x) * 2, Y = Number(x.y) * 2;
          if (!Number.isInteger(X) || !Number.isInteger(Y) || X < 0 || Y < 0 || X > 2 * cols || Y > 2 * rows || (X % 2) !== (Y % 2)) return;
          out[L].columns.add(colKey(X, Y));
          if (styleOK('column', x.style) && x.style !== 'square') out[L].colStyles.set(colKey(X, Y), x.style);
        });
        (Array.isArray(fl.furniture) ? fl.furniture : []).forEach(x => {
          if (!x || !FURN[x.type]) return;
          let o;
          if (FURN[x.type].wall) {
            const e = x.edge || {};
            if (!validEdge(e.o, e.r, e.c, cols, rows) || !['m', 'p'].includes(x.side)) return;
            const k = key(e.o, e.r, e.c);
            if ((out[L].edges.get(k) || {}).type !== 'wall') return;
            o = { type: x.type, ek: k, side: x.side };
          } else if (x.type === 'countertop' && x.edge) {
            const e = x.edge;
            if (!validEdge(e.o, e.r, e.c, cols, rows) || !['m', 'p'].includes(x.side)) return;
            const ins = Array.isArray(x.insets) ? x.insets.map(Number) : [0, 0];
            const okIns = v => [0, T / 2, COL_W / 2].some(a => Math.abs(a - v) < 1e-6);
            o = { type: 'countertop', ek: key(e.o, e.r, e.c), side: x.side, i0: okIns(ins[0]) ? ins[0] : 0, i1: okIns(ins[1]) ? ins[1] : 0 };
          } else if (x.type === 'countertop') {
            // a version-10 countertop stood on a spot: put it on the grid line behind it
            const X = Number(x.x), Y = Number(x.y), dir = x.dir | 0, [fx, fy] = FDIR[dir];
            const bx = X - fx * 0.3, by = Y - fy * 0.3;
            const o2 = dir % 2 ? 'v' : 'h', r = dir % 2 ? Math.floor(by) : Math.round(by), c = dir % 2 ? Math.round(bx) : Math.floor(bx);
            if (!validEdge(o2, r, c, cols, rows)) return;
            o = { type: 'countertop', ek: key(o2, r, c), side: (dir % 2 ? fx > 0 : fy > 0) ? 'p' : 'm', i0: 0, i1: 0 };
          } else {
            const X = Number(x.x) * 2, Y = Number(x.y) * 2;
            if (!Number.isInteger(X) || !Number.isInteger(Y) || (X % 2) !== (Y % 2) || ![0, 1, 2, 3].includes(x.dir)) return;
            o = { X, Y, type: x.type, dir: x.dir };
            const R_ = furnRect(o);
            if (R_.x0 < -0.001 || R_.y0 < -0.001 || R_.x1 > cols + 0.001 || R_.y1 > rows + 0.001) return;
          }
          const lv = FURN[x.type].levels || [];
          o.items = [];
          (Array.isArray(x.items) ? x.items : []).forEach(it => {
            if (!it || !APPL[it.type] || !Number.isInteger(it.level) || !lv[it.level] || !['C', 'L', 'R'].includes(it.slot) || ![0, 1, 2, 3].includes(it.dir)) return;
            if (!slotFree(o, it.level, it.slot) || !slotFits(o, it.level, it.slot, it.type, it.dir)) return;
            o.items.push({ type: it.type, lvl: it.level, slot: it.slot, rdir: it.dir });
          });
          out[L].furniture.push(o);
        });
        (Array.isArray(fl.appliances) ? fl.appliances : []).forEach(x => {
          if (!x || !APPL[x.type]) return;
          const X = Number(x.x) * 2, Y = Number(x.y) * 2;
          if (!Number.isInteger(X) || !Number.isInteger(Y) || (X % 2) !== (Y % 2) || ![0, 1, 2, 3].includes(x.dir)) return;
          const a = { type: x.type, X, Y, dir: x.dir }, R_ = applRect(a);
          if (R_.x0 < -0.001 || R_.y0 < -0.001 || R_.x1 > cols + 0.001 || R_.y1 > rows + 0.001) return;
          if (STYLABLE_APPL.has(x.type) && x.color === 'black') a.color = 'black';
          out[L].appliances.push(a);
        });
        if (L === 0) (Array.isArray(fl.pools) ? fl.pools : []).forEach(x => {
          if (!x || ![x.x0, x.y0, x.x1, x.y1].every(Number.isInteger)) return;
          const q = { c0: x.x0, r0: x.y0, c1: x.x1, r1: x.y1 };
          if (q.c0 < 0 || q.r0 < 0 || q.c1 > cols || q.r1 > rows || q.c1 <= q.c0 || q.r1 <= q.r0) return;
          const mine = new Set(poolCellsOf(q));
          if (out[0].pools.some(o => poolCellsOf(o).some(k => mine.has(k)))) return;
          out[0].pools.push(q);
        });
        (Array.isArray(fl.floorStyles) ? fl.floorStyles : []).forEach(x => {
          if (x && Number.isInteger(x.r) && Number.isInteger(x.c) && x.r >= 0 && x.r < rows && x.c >= 0 && x.c < cols && styleOK('floor', x.style) && x.style !== 'hardwood')
            out[L].floorStyles.set(x.r + ',' + x.c, x.style);
        });
        (Array.isArray(fl.roofs) ? fl.roofs : []).forEach(x => {
          if (!x) return;
          const [X0, Y0, X1, Y1] = [x.x0, x.y0, x.x1, x.y1].map(v => Number(v) * 2);
          if (![X0, Y0, X1, Y1].every(Number.isInteger) || X0 < 0 || Y0 < 0 || X1 > 2 * cols || Y1 > 2 * rows || X1 - X0 < 2 || Y1 - Y0 < 2) return;
          const type = styleOK('roof', x.type) ? x.type : 'gable', mat = styleOK('roofmat', x.material) ? x.material : 'clay';
          const dir = Number.isInteger(x.dir) ? ((x.dir % 4) + 4) % 4 : 0;
          out[L].roofs.push({ X0, Y0, X1, Y1, type, mat, dir: isGable(type) ? dir % 2 : dir });
        });
        if (L >= MAX_LEVEL) return;
        const taken = new Set();
        (Array.isArray(fl.stairs) ? fl.stairs : []).forEach(x => {
          if (!x || !Number.isInteger(x.r) || !Number.isInteger(x.c) || ![0, 1, 2, 3].includes(x.dir)) return;
          const s = { r: x.r, c: x.c, dir: x.dir, type: STAIR_CELLS[x.type] ? x.type : 'straight', hand: x.hand === 1 ? 1 : 0, style: x.style === 'cantilever' ? 'cantilever' : 'solid' }, cells = stairCells(s);
          if (cells.some(([r, c]) => r < 0 || r >= rows || c < 0 || c >= cols || taken.has(r + ',' + c))) return;
          cells.forEach(([r, c]) => taken.add(r + ',' + c));
          out[L].stairs.push(s);
        });
      });
      return { cols, rows, floors: out };
    }

    return {
      state, hooks,
      APPL, APPL_ORDER, COL_W, FURN, FURN_ORDER, HH, HW, LEVELS, LEVEL_INFO, MAX_LEVEL, MAX_SIZE, MIN_LEVEL, MIN_SIZE, PIECES, PIECE_ORDER, PX, STAIR_PIECE, STAIR_TYPES, STYLABLE_APPL, STYLE_SETS, SWATCH, T, WALL_H, ZS, applFrame, applRect, applValid, baseZ, blockedEdges, colKey, colValid, colXY, computeAreas, computeRooms, cur, cutH, defaultSwing, displayState, edgeEnds, emptyLevel, frameRect, furnIndexAt, furnPt, furnRect, furnValid, hung, isGable, isIndoorEdge, isShed, isSofa, itemFrame, key, levelUsed, nearestColSpot, onLine, parseKey, pickRoofScreen, poolIndexAt, poolValid, renderIso, renderPlan, roofAtWorld, roofCorners, sType, scr, serializeHouse, shiftContent, sidesOf, slotFits, slotFree, slotU, stairIndexAt, stairValid, styleOf, unrot, validEdge, validateHouse
    };
  }

  global.HouseEngine = { create };

  /* ══════════════════════════════════════════════════════════════════════════
     HOUSE PICTURE — draw a house (the builder's own save format) as a picture.
     Lesson pages use this: every picture is a real house built and rendered
     by the same engine as the builder, so a room in a lesson looks exactly
     like the room a student builds.

       HousePicture.draw(el, house, opts)   // renders into el, returns the <svg>
       HousePicture.svg(house, opts)        // the markup, as a string

     house: a saved House Builder file (JSON object), or HousePicture.room(…)
     opts (all optional):
       rot     0–3      which corner the camera looks from (quarter turns)
       level   -1…2     the floor to show (floors below it are drawn too)
       walls   'cutout' back walls full height, front walls low (default)
               'down'   every wall low     'full'  every wall full height
       keep    0…1      how much of a cut wall is kept (default 0.12)
       roofs   false    draw the roofs
       labels  [{x, y, text, z}]  words written on the floor (metres) — or z metres
                        above it, e.g. on top of a piece of furniture; num: true writes it
                        bigger, for numbered pictures ("match the numbers")
       focus   true (or metres)  close-up: crop to the furniture plus that much floor
                        round it (0.6 m by default)
       aspect  width / height of the frame, e.g. 4/3 (default: whatever fits)
       alt     text for screen readers
     The picture follows the page's light/dark theme on its own.

     Anything the engine would refuse (a sofa through a wall, a lamp that
     doesn't fit on its table) is dropped from the picture — and reported
     on the console, with data-dropped on the <svg>, because a lesson
     picture that quietly lost its lamp would teach the wrong thing.
     ══════════════════════════════════════════════════════════════════════════ */
  const PIC_STYLE_ID = 'house-picture-styles';
  const PIC_CSS = `
.house-pic{ display:block; width:100%; height:auto; background:var(--iso-bg); border-radius:var(--border-radius-lg, 12px); }
.house-pic .lot-line, .house-pic .air-line, .house-pic .air-edge{ display:none; }
.house-pic.pic-things .lot, .house-pic.pic-things .m-lot, .house-pic.pic-things .m-earth{ display:none; }   /* a word card: just the thing, no ground */
.house-pic .pic-label{ font-family:var(--font-sans, sans-serif); font-weight:700; font-size:13px; fill:var(--color-text-primary, #1a1a1a);
  paint-order:stroke; stroke:var(--iso-bg); stroke-width:4px; stroke-linejoin:round; text-anchor:middle; dominant-baseline:central; }
.house-pic .pic-label.pic-num{ font-size:17px; stroke-width:5px; }
`;
  function injectPicStyles() {
    if (typeof document === 'undefined' || document.getElementById(PIC_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = PIC_STYLE_ID;
    style.textContent = PIC_CSS;
    document.head.appendChild(style);
  }

  let picSeq = 0;
  const countItems = h => {
    let n = 0;
    (h.floors || []).forEach(fl => {
      n += (fl.appliances || []).length;
      (fl.furniture || []).forEach(f => { n += 1 + (f.items || []).length; });
    });
    return n;
  };
  const countLoaded = floors => {
    let n = 0;
    Object.keys(floors).forEach(L => {
      n += floors[L].appliances.length;
      floors[L].furniture.forEach(f => { n += 1 + (f.items || []).length; });
    });
    return n;
  };

  function pictureSvg(house, opts) {
    opts = opts || {};
    let box = null;
    const eng = create({ setViewBox: (v, b) => { if (v === 'iso') box = b; } });
    injectPicStyles();
    const st = eng.state;
    const h = eng.validateHouse(Object.assign({ app: 'house-builder', version: 12 }, house));
    st.COLS = h.cols; st.ROWS = h.rows; st.floors = h.floors;
    st.level = opts.level || 0;
    st.rot = ((opts.rot || 0) % 4 + 4) % 4;
    st.showRoofs = !!opts.roofs;
    st.showCeiling = false;
    st.showSlabs = true;
    const walls = opts.walls || 'cutout';
    st.wallsDown = walls === 'down';
    st.cutout = walls === 'cutout';
    st.keepAmount = opts.keep != null ? opts.keep : 0.12;
    st.currentTool = 'picture';
    st.viewMode = 'iso';
    const stBy = {}, rmBy = {};
    eng.LEVELS.forEach(L => { stBy[L] = eng.displayState(L); rmBy[L] = eng.computeAreas(stBy[L].edges); });
    let markup = eng.renderIso(stBy, rmBy);

    // words on the floor, drawn last so nothing covers them
    const z = eng.baseZ(st.level) + 0.02;
    (opts.labels || []).forEach(l => {
      const [sx, sy] = eng.scr(l.x, l.y, z + (l.z || 0));
      markup += `<text class="pic-label${l.num ? ' pic-num' : ''}" x="${sx.toFixed(1)}" y="${sy.toFixed(1)}">${String(l.text).replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;')}</text>`;
    });

    // ids are per picture, so pictures turned different ways (or with round
    // windows) can share a page without borrowing each other's patterns
    const ns = 'hp' + (++picSeq) + '-';
    markup = markup.replace(/id="([^"]+)"/g, (m, id) => `id="${ns}${id}"`)
                   .replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${ns}${id})`);

    const dropped = countItems(house) - countLoaded(h.floors);
    if (dropped > 0) console.warn('HousePicture: ' + dropped + ' piece(s) did not fit and were left out of the picture', house);
    // the builder's own placement rules: a piece the builder wouldn't let you put there
    // (through a wall, on top of another piece) is drawn, but flagged
    let clashes = 0;
    eng.LEVELS.forEach(L => {
      const F = st.floors[L], prev = st.level; st.level = L;
      F.furniture.forEach((f, i) => { if (!eng.furnValid(f, L, i)) clashes++; });
      F.appliances.forEach((a, i) => { if (!eng.applValid(a, L, i)) clashes++; });
      st.level = prev;
    });
    if (clashes > 0) console.warn('HousePicture: ' + clashes + " piece(s) are somewhere the builder wouldn't allow", house);
    // a picture frames just its own floor: from under the slab up to the top of
    // the tallest thing it shows — full walls, or the tallest furniture when
    // the walls are down — rather than the builder's whole-house frame
    const FL = st.level >= 0 ? st.floors[st.level] : null;
    let things = false;
    const zf = st.level >= 0 ? eng.baseZ(st.level) : 0;
    // the screen box round some floor rectangles, each from the floor up to its own top
    const screenBox = rects => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      rects.forEach(([r, lo, hi]) => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]].forEach(([cx, cy]) => [lo, hi].forEach(zz => {
        const [sx, sy] = eng.scr(cx, cy, zf + zz);
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      })));
      return [x0, y0, x1, y1];
    };
    // every piece on the floor shown, with the top of whatever stands on it
    const pieces = () => {
      const rects = [];
      FL.furniture.forEach(f => {
        let top = eng.FURN[f.type].h;
        if (eng.FURN[f.type].wall) top = eng.FURN[f.type].hangZ + eng.FURN[f.type].h / 2;
        (f.items || []).forEach(it => { top = Math.max(top, eng.FURN[f.type].levels[it.lvl].z + eng.APPL[it.type].h); });
        rects.push([eng.furnRect(f), 0, top]);
      });
      FL.appliances.forEach(a => rects.push([eng.applRect(a), 0, eng.APPL[a.type].h]));
      return rects;
    };
    const hasPieces = FL && (FL.furniture.length || FL.appliances.length);
    if (FL && !opts.roofs && !FL.edges.size && hasPieces) {
      // no walls at all: a picture of just the things (a word card) — framed tight round them
      const [x0, y0, x1, y1] = screenBox(pieces());
      // square, so a row of word cards lines up — and never so tight that a book
      // comes out as big as a sofa: small things keep some of their smallness
      const pad = 6, side = Math.max(x1 - x0, y1 - y0, opts.minSize || 40) + 2 * pad;
      box = [(x0 + x1) / 2 - side / 2, (y0 + y1) / 2 - side / 2, side, side];
      things = true;
    } else if (FL && !opts.roofs && opts.focus && hasPieces) {
      // focus: a close-up of the furniture and a little floor round it, cropped
      // out of the room like a photo — for small pictures where the room itself
      // would only shrink the things the sentence is about
      const m = opts.focus === true ? 0.6 : Number(opts.focus);
      const rs = pieces();
      const u = rs.reduce((a, [r]) => ({ x0: Math.min(a.x0, r.x0), y0: Math.min(a.y0, r.y0), x1: Math.max(a.x1, r.x1), y1: Math.max(a.y1, r.y1) }),
        { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
      const floor = { x0: Math.max(0, u.x0 - m), y0: Math.max(0, u.y0 - m), x1: Math.min(st.COLS, u.x1 + m), y1: Math.min(st.ROWS, u.y1 + m) };
      const [x0, y0, x1, y1] = screenBox(rs.concat([[floor, 0, 0]]));
      const pad = 8;
      box = [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
    } else if (FL && !opts.roofs) {
      // the whole floor: from under the slab to the top of the walls — or, with
      // the walls down, to the top of the tallest thing in the room
      let zTop = walls === 'down' ? 0.6 : eng.WALL_H;
      pieces().forEach(([, , top]) => { zTop = Math.max(zTop, top); });
      const [x0, y0, x1, y1] = screenBox([[{ x0: 0, y0: 0, x1: st.COLS, y1: st.ROWS }, -0.3, zTop + 0.05]]);
      const pad = 12;
      box = [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
    }
    // a fixed shape (width / height), so a row of pictures lines up: widen or
    // heighten the frame round its middle — never crop
    if (box && opts.aspect) {
      const [bx, by, bw, bh] = box;
      box = bw / bh < opts.aspect
        ? [bx + bw / 2 - bh * opts.aspect / 2, by, bh * opts.aspect, bh]
        : [bx, by + bh / 2 - bw / opts.aspect / 2, bw, bw / opts.aspect];
    }
    const [x, y, w, hh] = box || [0, 0, 100, 100];
    const alt = opts.alt ? String(opts.alt).replace(/"/g, '&quot;') : 'A picture of a room';
    return `<svg class="house-pic${things ? ' pic-things' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${hh.toFixed(1)}" role="img" aria-label="${alt}"${dropped > 0 ? ` data-dropped="${dropped}"` : ''}${clashes > 0 ? ` data-clashes="${clashes}"` : ''}>${markup}</svg>`;
  }

  function pictureDraw(el, house, opts) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return null;
    el.innerHTML = pictureSvg(house, opts);
    return el.firstElementChild;
  }

  /* HousePicture.room(spec) — the quick way to write a room or a small house
     for a lesson. It returns an ordinary saved House Builder file.

       HousePicture.room({
         cols: 5, rows: 4,                 // size in metres (grid squares)
         wall: 'drywall', floor: 'hardwood',
         lines: [[3, 0, 3, 4]],            // inside walls: x0,y0 → x1,y1 (straight)
         openings: [['h', 0, 2, 'window'], ['v', 1, 3, 'door']],   // o, r, c, type
                                           // type 'gap' leaves a doorway in a wall (lines or outside)
         floors: { '2,1': 'tile' },        // floor finish per square 'r,c' (optional)
         furniture: [ … ],                 // as in a saved file: {type, x, y, dir, items}
         appliances: [ … ]                 // {type, x, y, dir}
       });

     The walls go all the way round the room, so it has a floor; the default
     'cutout' picture then keeps the two back walls high and the front ones
     low, like a doll's house. Furniture coordinates are metres from the
     back-left corner: corners are whole numbers, the middle of a square is .5. */
  function room(spec) {
    const cols = spec.cols, rows = spec.rows;
    const wall = spec.wall || 'drywall';
    const edges = new Map();
    const put = (o, r, c, type) => edges.set(o + ':' + r + ':' + c, { o, r, c, type: type || 'wall', sides: { m: wall, p: wall } });
    for (let c = 0; c < cols; c++) { put('h', 0, c); put('h', rows, c); }
    for (let r = 0; r < rows; r++) { put('v', r, 0); put('v', r, cols); }
    (spec.lines || []).forEach(([x0, y0, x1, y1]) => {
      if (y0 === y1) for (let c = Math.min(x0, x1); c < Math.max(x0, x1); c++) put('h', y0, c);
      else for (let r = Math.min(y0, y1); r < Math.max(y0, y1); r++) put('v', r, x0);
    });
    (spec.openings || []).forEach(([o, r, c, type, extra]) => {
      if (type === 'gap') { edges.delete(o + ':' + r + ':' + c); return; }   // a doorway with no door
      const e = Object.assign({ o, r, c, type, sides: { m: wall, p: wall } }, extra || {});
      if (type === 'door' && e.swing == null) e.swing = 0;
      edges.set(o + ':' + r + ':' + c, e);
    });
    const floorStyle = spec.floor || 'hardwood';
    const floorStyles = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const sty = (spec.floors && spec.floors[r + ',' + c]) || floorStyle;
      if (sty !== 'hardwood') floorStyles.push({ r, c, style: sty });
    }
    return {
      app: 'house-builder', version: 12, cols, rows,
      floors: [{ level: 0, edges: [...edges.values()], floorStyles, furniture: spec.furniture || [], appliances: spec.appliances || [] }]
    };
  }

  /* HousePicture.thing(type, opts) — one piece on its own, for a word card:
     no walls, no floor, framed tight and square.

       HousePicture.thing('armchair')
       HousePicture.thing('sidetable', { items: [{ type: 'lamp', level: 0, slot: 'C', dir: 0 }] })
       HousePicture.thing('fridge', { dir: 1, color: 'black' })

     dir is the way it faces (default 2: towards you). */
  let catalog = null;
  function thing(type, o) {
    o = o || {};
    catalog = catalog || create();
    const p = { type, x: 1.5, y: 1.5, dir: o.dir == null ? 2 : o.dir };
    if (o.items) p.items = o.items;
    if (o.color) p.color = o.color;
    const isF = !!catalog.FURN[type];
    return { app: 'house-builder', version: 12, cols: 3, rows: 3,
      floors: [{ level: 0, edges: [], furniture: isF ? [p] : [], appliances: isF ? [] : [p] }] };
  }

  /* ══════════════════════════════════════════════════════════════════════════
     HOUSE PICTURE CHOICE — match a sentence and a picture.
     Two kinds of question, mixed freely in one list:

       { sentence: 'The lamp is on the side table.',      // one sentence…
         pictures: [houseA, houseB, houseC], correct: 0 }  // …three pictures

       { picture: house, options: ['…', '…', '…'],        // one picture…
         correct: 1 }                                      // …three sentences

     `correct` is the index in the list as written; the options are shown in
     a random order. Answering locks the question, marks the choice, and
     shows the right one if the choice was wrong — the same feel as the
     reading questions. Each item may carry `opts` (passed to the pictures)
     and `prompt` (a line above it).

       HousePictureChoice.build({ container: 'pcItems', items: PC_ITEMS,
                                  scoreEl: 'pcScore', totalEl: 'pcTotal' });
     ══════════════════════════════════════════════════════════════════════════ */
  const PC_STYLE_ID = 'house-picture-choice-styles';
  const PC_CSS = `
.pc-item{ border:.5px solid var(--color-border-tertiary); border-radius:var(--border-radius-lg); background:var(--surface-2); padding:12px 14px; margin-bottom:14px; }
.pc-prompt{ font-size:.8333rem; color:var(--text-muted); font-style:italic; margin-bottom:8px; }
.pc-sentence{ font-size:1.0333rem; font-weight:600; color:var(--text-primary); margin-bottom:10px; }
.pc-picture{ max-width:420px; margin:0 auto 10px; }
.pc-picture:has(.pic-things){ max-width:220px; }
.pc-pics:has(.pic-things){ max-width:500px; margin:0 auto; }
.pc-opts{ display:flex; flex-direction:column; gap:6px; }
.pc-opt{ display:block; width:100%; text-align:left; border-radius:var(--border-radius-md); font-size:.9333rem; font-weight:400; padding:9px 12px; line-height:1.4; background:var(--surface-2); }
.pc-pics{ display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; }
.pc-pic{ display:block; padding:4px; border-radius:var(--border-radius-lg); border:2px solid var(--color-border-secondary); background:var(--surface-2); cursor:pointer; position:relative; }
.pc-pic .house-pic{ border-radius:9px; }
.pc-pic .pc-letter{ position:absolute; top:6px; left:9px; font-size:.8rem; font-weight:700; color:var(--text-secondary); }
.pc-opt:disabled, .pc-pic:disabled{ cursor:default; opacity:1; }
.pc-opt.correct{ border-color:var(--good); background:var(--good-bg); color:var(--good); font-weight:600; }
.pc-opt.incorrect{ border-color:var(--bad); background:var(--bad-bg); color:var(--bad); }
.pc-pic.correct{ border-color:var(--good); box-shadow:0 0 0 2px var(--good); }
.pc-pic.incorrect{ border-color:var(--bad); box-shadow:0 0 0 2px var(--bad); }
.pc-pic.correct .pc-letter{ color:var(--good); } .pc-pic.incorrect .pc-letter{ color:var(--bad); }
.pc-feedback{ font-size:.8667rem; min-height:17px; margin-top:7px; color:var(--text-secondary); }
.pc-feedback.correct{ color:var(--good); } .pc-feedback.incorrect{ color:var(--bad); }
@media (max-width:520px){ .pc-pics{ grid-template-columns:1fr; max-width:340px; margin:0 auto; } }
`;
  function shuffled(n) {
    const a = [...Array(n).keys()];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function choiceBuild(o) {
    const host = typeof o.container === 'string' ? document.getElementById(o.container) : o.container;
    if (!host) return;
    if (!document.getElementById(PC_STYLE_ID)) {
      const s = document.createElement('style'); s.id = PC_STYLE_ID; s.textContent = PC_CSS; document.head.appendChild(s);
    }
    const items = o.items || [];
    const scoreEl = o.scoreEl ? document.getElementById(o.scoreEl) : null;
    const totalEl = o.totalEl ? document.getElementById(o.totalEl) : null;
    if (totalEl) totalEl.textContent = items.length;
    let score = 0;
    items.forEach((item, qi) => {
      const card = document.createElement('div');
      card.className = 'pc-item';
      if (item.prompt) card.insertAdjacentHTML('beforeend', `<div class="pc-prompt">${item.prompt}</div>`);
      const fb = document.createElement('div');
      fb.className = 'pc-feedback';
      const choices = [];
      const answer = (btn, idx) => {
        choices.forEach(b => { b.disabled = true; });
        if (idx === item.correct) {
          btn.classList.add('correct');
          fb.textContent = '✓ Correct!'; fb.className = 'pc-feedback correct';
          score++; if (scoreEl) scoreEl.textContent = score;
        } else {
          btn.classList.add('incorrect');
          choices.find(b => Number(b.dataset.idx) === item.correct).classList.add('correct');
          fb.textContent = '✗ Not quite — the correct answer is green.'; fb.className = 'pc-feedback incorrect';
        }
      };
      if (item.pictures) {
        card.insertAdjacentHTML('beforeend', `<div class="pc-sentence">${item.sentence}</div>`);
        const row = document.createElement('div');
        row.className = 'pc-pics';
        shuffled(item.pictures.length).forEach((idx, pos) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'pc-pic'; b.dataset.idx = idx;
          b.setAttribute('aria-label', 'Picture ' + 'ABC'[pos]);
          b.innerHTML = pictureSvg(item.pictures[idx], Object.assign({}, item.opts, { alt: 'Picture ' + 'ABC'[pos] })) + `<span class="pc-letter">${'ABC'[pos]}</span>`;
          b.addEventListener('click', () => answer(b, idx));
          choices.push(b); row.appendChild(b);
        });
        card.appendChild(row);
      } else {
        const pic = document.createElement('div');
        pic.className = 'pc-picture';
        pic.innerHTML = pictureSvg(item.picture, item.opts);
        card.appendChild(pic);
        const list = document.createElement('div');
        list.className = 'pc-opts';
        shuffled(item.options.length).forEach(idx => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'pc-opt'; b.dataset.idx = idx;
          b.textContent = item.options[idx];
          b.addEventListener('click', () => answer(b, idx));
          choices.push(b); list.appendChild(b);
        });
        card.appendChild(list);
      }
      card.appendChild(fb);
      host.appendChild(card);
    });
  }

  global.HousePicture = { svg: pictureSvg, draw: pictureDraw, room, thing };
  global.HousePictureChoice = { build: choiceBuild };
})(window);
