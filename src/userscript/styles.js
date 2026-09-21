export const styles = `
:host { all: initial; --mel-bg:#111513; --mel-panel:#1a211e; --mel-line:#34423c; --mel-text:#f2f6f3; --mel-muted:#9cafA6; --mel-green:#8ee6a8; --mel-gold:#f2ce72; color:var(--mel-text); font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif }
* { box-sizing:border-box }
button,input,select { font:inherit }
#toggle { position:fixed; z-index:2147483646; right:14px; bottom:18px; width:52px; height:52px; border:1px solid var(--mel-line); border-radius:50%; background:var(--mel-bg); color:var(--mel-green); font-weight:900; cursor:pointer; box-shadow:0 8px 28px #0008 }
#panel { position:fixed; z-index:2147483645; right:14px; bottom:82px; width:min(430px,calc(100vw - 28px)); height:min(720px,calc(100vh - 110px)); display:grid; grid-template-rows:auto auto 1fr; background:var(--mel-bg); border:1px solid var(--mel-line); border-radius:14px; box-shadow:0 20px 60px #000b; overflow:hidden }
#panel[hidden] { display:none }
header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:15px 16px; border-bottom:1px solid var(--mel-line) }
header strong { display:block; font-size:16px } header span,.muted { color:var(--mel-muted); font-size:12px }
nav { display:grid; grid-template-columns:repeat(3,1fr); border-bottom:1px solid var(--mel-line) }
nav button { border:0; border-right:1px solid var(--mel-line); background:var(--mel-panel); color:var(--mel-muted); padding:10px; cursor:pointer }
nav button.active { color:var(--mel-green); box-shadow:inset 0 -2px var(--mel-green) }
main { overflow:auto; padding:14px }
.controls { display:grid; grid-template-columns:minmax(0,1fr) 120px; gap:8px; margin-bottom:12px }
.controls.commander { grid-template-columns:1fr 1fr }
.controls.commander .query { grid-column:1/-1 }
input,select { width:100%; border:1px solid var(--mel-line); border-radius:7px; background:var(--mel-panel); color:var(--mel-text); padding:8px }
.stack { display:grid; gap:9px }
.card { padding:12px; border:1px solid var(--mel-line); border-radius:9px; background:var(--mel-panel) }
.card h3 { margin:0 0 5px; font-size:14px } .card p { margin:6px 0; color:#d8e1dc }
.meta,.chips { display:flex; flex-wrap:wrap; gap:5px; align-items:center }
.chip { border:1px solid var(--mel-line); border-radius:999px; padding:2px 7px; color:var(--mel-muted); font-size:11px }
.score { color:var(--mel-gold); font-weight:800 }
a { color:var(--mel-green); text-decoration:none } a:hover { text-decoration:underline }
.why { margin-top:7px; padding-left:18px; color:var(--mel-muted); font-size:12px }
.empty { padding:25px 8px; text-align:center; color:var(--mel-muted) }
.notice { padding:8px 12px; background:#4c361f; color:#ffdba3; font-size:12px }
@media (max-width:560px) { #panel { right:0; bottom:0; width:100vw; height:100vh; border-radius:0 } #toggle { right:10px; bottom:10px } }
`;
