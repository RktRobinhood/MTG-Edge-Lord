export const styles = `
:host { all: initial; --mel-bg:#111513; --mel-panel:#1a211e; --mel-line:#34423c; --mel-text:#f2f6f3; --mel-muted:#9cafa6; --mel-green:#8ee6a8; --mel-gold:#f2ce72; color:var(--mel-text); font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif }
* { box-sizing:border-box }
button,input,select { font:inherit }

/* The opener rides in EDHREC's navbar, so it is sized to the search input it
   sits beside rather than to us. When there is no navbar to ride in it floats,
   which is the only reason the fixed variant still exists. */
:host(#mtg-edge-lord-button) { display:inline-flex; align-items:center; margin-left:6px }
#toggle { display:inline-flex; align-items:center; height:38px; padding:0 13px; border:1px solid var(--mel-line); border-radius:7px; background:var(--mel-panel); color:var(--mel-green); font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap }
#toggle:hover { border-color:var(--mel-green) }
#toggle.on { background:var(--mel-green); border-color:var(--mel-green); color:#0d130f }
:host(.floating) #toggle { position:fixed; z-index:2147483646; right:14px; bottom:18px; box-shadow:0 8px 28px #0008 }

/* The panel falls from the button rather than rising from the corner:
   --mel-top and --mel-right are written inline when it opens, and the
   narrow-screen rule below overrides the properties they feed, not the
   properties themselves, so it still wins. */
#panel { position:fixed; z-index:2147483645; top:var(--mel-top,56px); right:var(--mel-right,14px); width:min(430px,calc(100vw - 28px)); height:min(760px,calc(100vh - var(--mel-top,56px) - 16px)); display:grid; grid-template-rows:auto auto 1fr; background:var(--mel-bg); border:1px solid var(--mel-line); border-radius:14px; box-shadow:0 20px 60px #000b; overflow:hidden; animation:mel-drop .16s ease-out }
#panel[hidden] { display:none }
@keyframes mel-drop { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:none } }
@media (prefers-reduced-motion:reduce) { #panel { animation:none } }
header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:15px 16px; border-bottom:1px solid var(--mel-line) }
header strong { display:block; font-size:16px } header span,.muted { color:var(--mel-muted); font-size:12px }
nav { display:grid; grid-template-columns:repeat(4,1fr); border-bottom:1px solid var(--mel-line) }
nav button { border:0; border-right:1px solid var(--mel-line); background:var(--mel-panel); color:var(--mel-muted); padding:10px; cursor:pointer }
nav button.active { color:var(--mel-green); box-shadow:inset 0 -2px var(--mel-green) }
main { overflow:auto; padding:14px }

.controls { display:grid; gap:7px; margin-bottom:10px }
.controls .row { display:flex; flex-wrap:wrap; align-items:center; gap:6px }
.controls .row > select { flex:1 1 120px; min-width:0 }
.controls .colors { flex-wrap:nowrap }
.controls .colors > select { flex:0 1 108px }
.controls .row > input[type=number] { flex:0 0 74px }
.controls .row > input[type=date] { flex:1 1 130px; min-width:0 }
.label { color:var(--mel-muted); font-size:11px; text-transform:uppercase; letter-spacing:.04em }
.to { color:var(--mel-muted); font-size:11px }
.check { display:flex; align-items:center; gap:5px; color:var(--mel-muted); font-size:12px; white-space:nowrap }
.check input { width:auto }
input,select { width:100%; border:1px solid var(--mel-line); border-radius:7px; background:var(--mel-panel); color:var(--mel-text); padding:7px 8px }
.query { font-size:15px; padding:9px 10px }
.pip { width:28px; height:28px; border-radius:50%; border:1px solid var(--mel-line); background:var(--mel-panel); color:var(--mel-muted); font-weight:800; cursor:pointer; padding:0 }
.pip.on { background:var(--mel-green); color:#0d130f; border-color:var(--mel-green) }
.reset { border:1px solid var(--mel-line); border-radius:7px; background:transparent; color:var(--mel-muted); padding:7px 10px; cursor:pointer }
.summary { color:var(--mel-muted); font-size:12px; margin-bottom:8px }
.summary strong { color:var(--mel-text) }

.stack { display:grid; gap:9px }
.card { display:block; padding:12px; border:1px solid var(--mel-line); border-radius:9px; background:var(--mel-panel); color:inherit }
.card h3 { margin:0 0 5px; font-size:14px } .card p { margin:6px 0; color:#d8e1dc }
.meta,.chips { display:flex; flex-wrap:wrap; gap:5px; align-items:center }
.chip { display:inline-block; border:1px solid var(--mel-line); border-radius:999px; padding:2px 7px; color:var(--mel-muted); font-size:11px }
.chip.quality { border-color:#4a6b57; color:#bfe6cd }
.score { color:var(--mel-gold); font-weight:800; font-size:16px }
.score.none { color:var(--mel-muted); font-weight:600 }
.score.cohort { color:#9fd6ff }
.score small { font-size:9px; text-transform:uppercase; letter-spacing:.08em; margin-left:3px; opacity:.8 }
.cohort-note { color:#9fd6ff; font-size:12px }
.tier { border-radius:999px; padding:2px 8px; font-size:11px; text-transform:uppercase; letter-spacing:.05em; border:1px solid var(--mel-line); color:var(--mel-muted) }
.tier.edge { border-color:var(--mel-green); color:var(--mel-green) }
.tier.rare { border-color:var(--mel-gold); color:var(--mel-gold) }
.insufficient { color:var(--mel-muted); font-size:12px; font-style:italic }
a { color:var(--mel-green); text-decoration:none } a:hover { text-decoration:underline }
.why { margin:7px 0 0; padding-left:18px; color:var(--mel-muted); font-size:12px }
.detail { margin-top:10px; padding-top:9px; border-top:1px solid var(--mel-line) }
.detail .label { display:block; margin:8px 0 4px }
.more-detail { margin-top:8px }
.more-detail .label { display:block; margin:8px 0 4px }

/* A card is a link. Nothing on it needs to say so a second time. */
[data-open] { cursor:pointer }
[data-open]:hover { border-color:#4d6b5c; background:#1f2925 }
.card .head { display:flex; align-items:flex-start; justify-content:space-between; gap:8px }
.card .head h3 { flex:1 1 auto; margin:0 }
.card .line { display:flex; flex-wrap:wrap; align-items:center; gap:7px; margin-top:5px }
.card .foot { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:8px }
.card .foot .chips { flex:1 1 auto }

/* The question mark is the whole of the "why" affordance: small, out of the
   way, and the only thing on the card that does not open EDHREC. */
.why-toggle { flex:0 0 auto; width:22px; height:22px; border-radius:50%; border:1px solid var(--mel-line); background:transparent; color:var(--mel-muted); font-size:12px; font-weight:700; line-height:1; cursor:pointer; padding:0 }
.why-toggle:hover { border-color:var(--mel-green); color:var(--mel-green) }
.why-toggle.on { background:var(--mel-green); border-color:var(--mel-green); color:#0d130f }

/* Mana symbols are drawn, never fetched: mana.js explains why. The disc
   colour is written inline per pip, so only the shape lives here. */
.mana { display:inline-flex; gap:2px; flex:0 0 auto; white-space:nowrap }
.pip-mana { display:inline-flex; align-items:center; justify-content:center; width:17px; height:17px; border-radius:50%; color:#17130f; font-size:11px; font-weight:800; font-style:normal; letter-spacing:-.02em; box-shadow:inset 0 -1px 1px #0003 }
.pip-split { align-self:center; color:var(--mel-muted); font-style:normal; font-size:10px; margin:0 1px }
.more { width:100%; border:1px dashed var(--mel-line); border-radius:9px; background:transparent; color:var(--mel-muted); padding:10px; cursor:pointer }
.sources { font-size:12px }

/* A finding is a digest: the source sits above the summary and the whole card
   is the link out. Nothing here may grow into a replacement for the original. */
.card.digest { cursor:pointer; border-left:3px solid var(--mel-green) }
.card.digest:hover { background:#1f2925 }
.card.digest h3 { color:var(--mel-text) }
.credit { display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:6px }
.source { color:var(--mel-green); font-weight:700; font-size:13px }
.clamp { display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden }
.readon { display:block; margin-top:8px; color:var(--mel-green); font-size:12px; font-weight:600 }

/* The same verdict as the panel's card, on EDHREC's own commander page —
   read at the moment it is being acted on. A banner between EDHREC's header
   and its content, never a thing that floats over what you came to read. */
:host(#mtg-edge-lord-insight) { display:block }
#insight article { max-width:1080px; margin:12px auto; padding:11px 14px; border:1px solid var(--mel-line); border-left:3px solid var(--mel-green); border-radius:10px; background:var(--mel-panel); box-shadow:0 6px 24px #0004 }
#insight .head { display:flex; align-items:center; justify-content:space-between }
#insight .brand { color:var(--mel-green); font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.09em }
#insight #dismiss { border:0; background:none; color:var(--mel-muted); font-size:18px; line-height:1; cursor:pointer; padding:0 2px }
#insight #dismiss:hover { color:var(--mel-text) }
#insight .line { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:4px }
#insight .why { columns:2; column-gap:22px; margin-top:6px }
@media (max-width:720px) { #insight .why { columns:1 } }

.empty { padding:25px 8px; text-align:center; color:var(--mel-muted) }
.notice { padding:8px 12px; margin-bottom:10px; border-radius:7px; background:#4c361f; color:#ffdba3; font-size:12px }
@media (max-width:560px) { #panel { top:0; right:0; width:100vw; height:100vh; border-radius:0 } :host(.floating) #toggle { right:10px; bottom:10px } }
`;
