// ==UserScript==
// @name         MTG Edge Lord — EDHREC Discovery
// @namespace    https://github.com/RktRobinhood/MTG-Edge-Lord
// @version      1.3.0
// @description  Advanced off-meta Commander search, recent finds, and card-first discovery on EDHREC.
// @match        https://edhrec.com/*
// @connect      rktrobinhood.github.io
// @connect      raw.githubusercontent.com
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/mtg-edge-lord.user.js
// @downloadURL  https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/mtg-edge-lord.user.js
// ==/UserScript==
(()=>{var Pe="edge-v2",Ue=Object.freeze({bracketFit:.4,archetypeDepth:.4,retention:.2}),Ge=Object.freeze([0,0,1,1,.6]),G=30,y=Object.freeze({zeroAt:500,peakFrom:1e3,peakTo:3e3}),$=3e3,Ve=Object.freeze([{tier:"meta",maxRank:500},{tier:"rare",maxRank:1e3},{tier:"edge",maxRank:3e3},{tier:"uncharted",maxRank:1/0}]),We=e=>Math.round(e*10)/10,T=e=>Math.round(e*1e3)/1e3,pe=e=>Math.max(0,Math.min(1,Number(e)||0));function S(e){return!Number.isFinite(e)||e<=0?"uncharted":Ve.find(t=>e<=t.maxRank).tier}function fe(e){return!Number.isFinite(e)||e<=y.zeroAt||e>y.peakTo?0:e>=y.peakFrom?1:T((e-y.zeroAt)/(y.peakFrom-y.zeroAt))}function Ke(e){if(!Array.isArray(e)||e.length!==5)return null;let t=e.map(n=>Math.max(0,Number(n)||0)),r=t.reduce((n,i)=>n+i,0);if(r<G)return null;let o=t.reduce((n,i,l)=>n+i*Ge[l],0);return T(o/r)}var P=2,Ye=5,Je=2;function Ze(e){if(!Array.isArray(e)||e.length<4)return null;let t=e.map(g=>Math.max(0,Number(g)||0)),r=Math.max(...t);if(r<Ye)return null;let o=t.slice(-P),n=t.slice(-P*2,-P),i=ue(o),l=ue(n);return Math.max(...o)===r&&i>l*Je?null:T(pe(i/r))}function he(e,t=Ue){let r=e.popularity?.edhrecRank,o=S(r);if(!Number.isFinite(r)||r<=0)return{unscored:!0,reason:"No EDHREC rank yet, so obscurity cannot be judged.",tier:o};if(r>$)return{unscored:!0,reason:`Past EDHREC rank ${$}, where the evidence to say this works does not exist.`,tier:o};let n={bracketFit:Ke(e.bracketCounts),archetypeDepth:e.archetypeDepth===void 0?null:pe(e.archetypeDepth),retention:Ze(e.retentionTrend)};if(n.bracketFit===null)return{unscored:!0,reason:E(e),tier:o,...e.bracketCounts?{bracketCounts:e.bracketCounts}:{}};let i=Object.entries(n).filter(([,m])=>m!==null),l=i.reduce((m,[q])=>m+t[q],0),d=T(i.reduce((m,[q,qe])=>m+qe*t[q],0)/l),g=fe(r);return{tier:o,obscurity:g,worksScore:d,edgeScore:We(g*d*100),quality:Object.fromEntries(i),partial:i.length<Object.keys(n).length,reasons:C(e,{obscurity:g,worksScore:d,tier:o,components:n}),modelVersion:Pe}}function C(e,{obscurity:t,worksScore:r,tier:o,components:n}={}){return t??=e.obscurity??fe(e.popularity?.edhrecRank),r??=e.worksScore??0,o??=e.tier??S(e.popularity?.edhrecRank),n??={bracketFit:e.quality?.bracketFit??null,archetypeDepth:e.quality?.archetypeDepth??null,retention:e.quality?.retention??null},Xe(e,{obscurity:t,worksScore:r,tier:o,components:n})}function E(e){let t=e.popularity?.edhrecRank;if(!Number.isFinite(t)||t<=0)return"No EDHREC rank yet, so obscurity cannot be judged.";if(t>$)return`Past EDHREC rank ${$.toLocaleString()}, where the evidence to say this works does not exist.`;let r=U(e);return r>0?`Only ${r} bracket-tagged deck${r===1?"":"s"}, below the floor of ${G}.`:"No EDHREC page data has been collected for this commander yet."}function Xe(e,{obscurity:t,worksScore:r,tier:o,components:n}){let i=[];if(t>=1?i.push(`Sits at EDHREC rank ${e.popularity.edhrecRank}, squarely in the Edge tier.`):t>0&&i.push(`Rank ${e.popularity.edhrecRank} is on the edge of the Rare tier, so obscurity counts for less.`),n.bracketFit!==null){let l=Math.round(n.bracketFit*100),d=U(e);i.push(`${l}% of its ${d.toLocaleString()} bracket-tagged decks are built at Bracket 3 or above.`)}else e.bracketCounts&&i.push(`Bracket data shown but not scored: only ${U(e)} tagged decks, below the floor of ${G}.`);return n.archetypeDepth!==null&&i.push(n.archetypeDepth>=.35?"A deep pool of high-synergy cards means there is an archetype here, not just goodstuff.":"A shallow high-synergy pool suggests the deck leans on colour-identity staples."),n.retention!==null&&i.push(n.retention>=.5?"Deck saves are holding or climbing rather than fading after release.":"Deck saves are falling away from their earlier level."),r<.3&&i.push("The evidence that this works is weak, so the Edge score stays low however obscure it is."),o==="rare"&&r>=.5&&i.push("Known enough to have a track record, obscure enough to be worth a second look."),i.slice(0,5)}function U(e){return Array.isArray(e.bracketCounts)?e.bracketCounts.reduce((t,r)=>t+(Number(r)||0),0):0}function ue(e){return e.length?e.reduce((t,r)=>t+r,0)/e.length:0}var ir=Object.freeze({cohortPosition:.6,interestToTraction:.4});function A(e){let t=e?.cohort;if(!t)return[];let r=e.popularity?.deckCount??0,o=[`${Qe(t.position)} of ${t.size} new legends in ${String(t.setCode).toUpperCase()}, with ${r.toLocaleString()} deck${r===1?"":"s"} so far.`],n=e.mentionCount;return o.push(Number.isFinite(n)&&n>0?`${n} deck-tech mention${n===1?"":"s"} against ${r.toLocaleString()} build${r===1?"":"s"}.`:"No deck-tech coverage found yet, so this is cohort position alone."),o}function Qe(e){let t=e%100;return t>=11&&t<=13?`${e}th`:`${e}${["th","st","nd","rd"][e%10]??"th"}`}var et=/\{([^}]{1,4})\}/g,L=Object.freeze({W:"#f7f2da",U:"#b3dbf2",B:"#c0b5ad",R:"#f2a687",G:"#a4d5ae",C:"#cfd5d3"}),V="#cbcfcd";function tt(e){let t=[];for(let[,r]of String(e??"").matchAll(et)){let o=rt(r.toUpperCase());o&&t.push(o)}return t}function rt(e){if(e.includes("/")){let t=e.split("/"),r=t.at(-1)==="P",o=(r?t.slice(0,-1):t).filter(i=>L[i]),n=o.length?o.map(i=>L[i]):[V];return r?{glyph:"\u03A6",colors:n}:{glyph:t.map(nt).join(""),colors:n}}return L[e]?{glyph:e,colors:[L[e]]}:/^\d{1,3}$/.test(e)?{glyph:e,colors:[V]}:/^[XYZS]$/.test(e)?{glyph:e,colors:[V]}:null}function nt(e){return/^[WUBRGCXYZS]$|^\d$/.test(e)?e:""}function M(e){let t=String(e??"").split("//").map(tt).filter(n=>n.length);if(!t.length)return"";let r=t.map(n=>n.map(ot).join("")).join('<i class="pip-split">//</i>');return`<span class="mana" aria-label="Mana cost ${t.map(it).join(" or ")}" role="img">${r}</span>`}function ot(e){return`<i class="pip-mana" style="background:${at(e.colors)}">${e.glyph}</i>`}function at(e){return e.length===1?e[0]:`linear-gradient(-45deg, ${e[0]} 0 50%, ${e.at(-1)} 50% 100%)`}function it(e){return e.map(t=>t.glyph==="\u03A6"?"Phyrexian":t.glyph).join(" ")}var R=`
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

/* The same verdict as the panel's card, on EDHREC's own commander page \u2014
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
`;var k=document.createElement("div");k.id="mtg-edge-lord-insight";var Y=k.attachShadow({mode:"open"});Y.innerHTML=`<style>${R}</style><div id="insight"></div>`;var J=null,ge=new Set,W={source:null,bySlug:new Map};function Z(e){let t=ct(location.pathname);if(!t||!e?.length||ge.has(t))return K();let r=st(e).get(t);if(!r)return K();J!==t&&(Y.getElementById("insight").innerHTML=dt(r),Y.querySelector("#dismiss")?.addEventListener("click",()=>{ge.add(t),K()}),J=t),k.isConnected||lt()}function st(e){return W.source!==e&&(W={source:e,bySlug:new Map(e.map(t=>[t.slug,t]))}),W.bySlug}function ct(e){let[,t,r]=String(e).split("/");return t==="commanders"&&r?decodeURIComponent(r):null}function lt(){let e=document.querySelector("main");e?.parentElement?e.parentElement.insertBefore(k,e):document.body.prepend(k)}function K(){k.remove(),J=null}function dt(e){let t=e.popularity?.edhrecRank,r=e.popularity?.deckCount;return`<article>
    <div class="head">
      <span class="brand">MTG Edge Lord</span>
      <button id="dismiss" type="button" aria-label="Hide this">\xD7</button>
    </div>
    <div class="line">
      ${ut(e)}
      ${M(e.manaCost)}
      <span class="muted">#${t?.toLocaleString()??"\u2014"}${r?` \xB7 ${r.toLocaleString()} decks`:""}${e.price!==void 0?` \xB7 $${e.price.toFixed(2)}`:""}</span>
    </div>
    ${pt(e)}
  </article>`}function ut(e){return e.edgeScore!==void 0?`<span class="score">${e.edgeScore}</span><span class="tier ${ft(e.tier??"")}">${O(e.tier??"scored")}</span>`:e.cohortScore!==void 0?`<span class="score cohort">${e.cohortScore}<small>new</small></span>`:'<span class="score none">\u2014</span>'}function pt(e){return e.cohortScore!==void 0?`<ul class="why">${A(e).map(me).join("")}</ul>`:e.edgeScore===void 0?`<p class="insufficient">Not scored \u2014 ${O(E(e))}</p>`:`<ul class="why">${C(e).map(me).join("")}</ul>`}function me(e){return`<li>${O(e)}</li>`}function O(e){let t=document.createElement("span");return t.textContent=String(e),t.innerHTML}function ft(e){return O(e).replaceAll('"',"&quot;")}var X="columnar/1";function xe(e){if(e?.format!==X)throw new Error(`Unsupported columnar format: ${e?.format??"missing"}`);let t=Array.from({length:e.count},()=>({}));for(let[r,o]of Object.entries(e.columns)){let n=ht(o,e.count);for(let i=0;i<e.count;i+=1)n[i]!==null&&gt(t[i],r,n[i])}return t}function ht(e,t){if(e.kind==="raw")return e.values;if(e.kind==="tokens")return e.index.map(r=>r===null?null:r.map(o=>e.vocabulary[o]));if(e.kind==="dict")return e.index.map(r=>r===-1?null:be(e.keys[r]));if(e.kind==="sparse"){let r=Array.from({length:t},()=>be(e.fill));return e.index.forEach((o,n)=>{r[o]=e.values[n]}),r}throw new Error(`Unsupported column kind: ${e.kind}`)}function be(e){return typeof e=="object"&&e!==null?structuredClone(e):e}function gt(e,t,r){let o=t.split("."),n=e;for(let i of o.slice(0,-1))mt(n[i])||(n[i]={}),n=n[i];n[o.at(-1)]=r}function mt(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}var xr=Object.freeze({trendZscore:3,momentum:1,diamondScore:1,edgeScore:1,cohortScore:1,"quality.bracketFit":3,"quality.archetypeDepth":3,"quality.retention":3,price:2});function ye(e){let t=e?.commanders;return Array.isArray(t)?t:t?.format===X?xe(t):[]}var bt="mtg-edge-lord",f="datasets";var N=null;function Q(){return N||(N=new Promise(e=>{if(!globalThis.indexedDB)return e(null);let t;try{t=indexedDB.open(bt,1)}catch{return e(null)}t.onupgradeneeded=()=>{t.result.objectStoreNames.contains(f)||t.result.createObjectStore(f)},t.onsuccess=()=>e(t.result),t.onerror=()=>e(null),t.onblocked=()=>e(null)}),N)}async function ee(e){let t=await Q();return t?new Promise(r=>{try{let o=t.transaction(f,"readonly").objectStore(f).get(e);o.onsuccess=()=>r(o.result??null),o.onerror=()=>r(null)}catch{r(null)}}):null}async function D(e,t){let r=await Q();return r?new Promise(o=>{try{let n=r.transaction(f,"readwrite");n.objectStore(f).put(t,e),n.oncomplete=()=>o(!0),n.onerror=()=>o(!1),n.onabort=()=>o(!1)}catch{o(!1)}}):!1}async function ke(e){let t=await Q();if(t)try{t.transaction(f,"readwrite").objectStore(f).delete(e)}catch{}}var ve="https://rktrobinhood.github.io/MTG-Edge-Lord/data",$e="https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/data",te="datasets:v2",re="commander-detail:v2",xt=1440*60*1e3;function yt(e,t){let r=t-Date.parse(e?.checkedAt);return!(r>=0&&r<xt)}var kt="mtg-edge-lord:data:v1";async function Se({force:e=!1,checkRemote:t=!0}={}){vt();let r=await ee(te),o=Date.now();if(r&&!e&&(!t||!yt(r,o)))return{...r,stale:!1};try{let n;try{n=await we(ve,r,e)}catch{n=await we($e,r,e)}let i=new Date(o).toISOString();if(n.cached){let d={...r,checkedAt:i};return await D(te,d),{...d,stale:!1}}let l={manifest:n.manifest,...n.datasets,cachedAt:new Date(o).toISOString(),checkedAt:i};return await D(te,l),r?.manifest?.dataVersion!==n.manifest.dataVersion&&await ke(re),{...l,stale:!1}}catch(n){if(r)return{...r,stale:!0,error:n.message};throw n}}async function Ce(e){let t=await ee(re);if(t?.dataVersion===e)return t.detail;for(let r of[ve,$e])try{let{detail:o}=await h(`${r}/commander-detail.json`);return await D(re,{dataVersion:e,detail:o}),o}catch{}return t?.detail??{}}async function we(e,t,r){let o=await h(`${e}/manifest.json?ts=${Date.now()}`);if(!r&&t?.manifest?.dataVersion===o.dataVersion)return{cached:!0};let[n,i,l,d,g,m]=await Promise.all([h(`${e}/findings.json`),h(`${e}/commanders.json`).then(wt),h(`${e}/hidden-cards.json`),h(`${e}/community-resources.json`),h(`${e}/relationships/card-commander.json`),h(`${e}/archive.json`).catch(()=>({schemaVersion:1,archive:[]}))]);return{manifest:o,datasets:{findings:n,commanders:i,cards:l,resources:d,relationships:g,archive:m}}}function wt(e){return{schemaVersion:e?.schemaVersion??1,commanders:ye(e)}}function vt(){try{localStorage.removeItem(kt)}catch{}}function h(e){let t=globalThis.GM?.xmlHttpRequest??globalThis.GM_xmlhttpRequest;return t?new Promise((r,o)=>t({method:"GET",url:e,headers:{Accept:"application/json"},onload:n=>{if(n.status<200||n.status>=300)return o(new Error(`HTTP ${n.status}`));try{r(JSON.parse(n.responseText))}catch{o(new Error("Backend returned invalid JSON."))}},onerror:()=>o(new Error("Could not reach the MTG Edge Lord data backend."))})):fetch(e).then($t).then(r=>r.json())}function $t(e){if(!e.ok)throw new Error(`HTTP ${e.status}`);return e}function Ee(e,t=220){let r=String(e??"").trim();if(r.length<=t)return r;let o=r.slice(0,t),n=o.lastIndexOf(" ");return`${(n>t*.6?o.slice(0,n):o).replace(/[\s,;:.]+$/,"")}\u2026`}function St(e){let t=e?.source?.url;return typeof t=="string"&&/^https:\/\//.test(t)}function Re(e){return(e??[]).filter(St)}function ne(e){let t=String(e?.creator??"").trim(),r=String(e?.name??"").trim();return t&&r&&t.toLowerCase()!==r.toLowerCase()?`${t} \xB7 ${r}`:t||r||"Source"}var Ct=["W","U","B","R","G"],j=Object.freeze([{id:"edge",label:"Edge score"},{id:"momentum",label:"Momentum"},{id:"worksScore",label:"How well it works"},{id:"price",label:"Cheapest first"},{id:"released",label:"Most recent"},{id:"name",label:"Alphabetical"},{id:"rank",label:"EDHREC rank"},{id:"deckCount",label:"Deck count (popularity)"}]),Le="edge",Me=Object.freeze([{id:"includes",label:"Includes"},{id:"exact",label:"Exactly"},{id:"atMost",label:"At most"}]),ae=Object.freeze({query:"",colors:[],colorMode:"includes",theme:"",functionalTag:"",creatureType:"",tier:"",minBracketFit:"",minRank:"",maxRank:"",minManaValue:"",maxManaValue:"",maxPrice:"",releasedAfter:"",scoredOnly:!1,sort:Le});function Et(e){return e.map(t=>{if(t.cohortScore!==void 0)return{...t,tier:S(t.popularity?.edhrecRank)};if(t.edgeScore===void 0)return{...t,tier:S(t.popularity?.edhrecRank)};let r=he(t);if(r.unscored){let o={...t,tier:r.tier};return delete o.edgeScore,o}return{...t,tier:r.tier,obscurity:r.obscurity,worksScore:r.worksScore,edgeScore:r.edgeScore,quality:r.quality}})}function Oe(e){let t=Et(e),r=t.map(o=>[o.name,...o.themes??[],...o.functionalTags??[],...o.creatureTypes??[],...o.types??[]].join(" ").toLowerCase());return{commanders:t,haystacks:r,themes:oe(t,"themes"),functionalTags:oe(t,"functionalTags"),creatureTypes:oe(t,"creatureTypes")}}function oe(e,t){let r=new Map;for(let o of e)for(let n of o[t]??[])r.set(n,(r.get(n)??0)+1);return[...r.entries()].sort((o,n)=>n[1]-o[1]||o[0].localeCompare(n[0])).map(([o])=>o)}function Ne(e,t){let r=String(t.query??"").toLowerCase().split(/\s+/).filter(Boolean),o=[];for(let n=0;n<e.commanders.length;n+=1){if(r.length&&!r.every(l=>e.haystacks[n].includes(l)))continue;let i=e.commanders[n];Rt(i,t)&&o.push(i)}return o}function Rt(e,t){let r=e.popularity?.edhrecRank;return!(!Tt(e.colorIdentity,t.colors,t.colorMode)||t.theme&&!(e.themes??[]).includes(t.theme)||t.functionalTag&&!(e.functionalTags??[]).includes(t.functionalTag)||t.creatureType&&!(e.creatureTypes??[]).includes(t.creatureType)||t.tier&&e.tier!==t.tier||t.scoredOnly&&e.edgeScore===void 0||t.minBracketFit!==""&&!(e.quality?.bracketFit>=Number(t.minBracketFit))||!Te(r,t.minRank,t.maxRank)||!Te(e.manaValue,t.minManaValue,t.maxManaValue)||t.maxPrice!==""&&e.price!==void 0&&e.price>Number(t.maxPrice)||t.releasedAfter&&(e.releasedAt??"")<t.releasedAfter)}function Te(e,t,r){return t===""&&r===""?!0:!(!Number.isFinite(e)||t!==""&&e<Number(t)||r!==""&&e>Number(r))}function Tt(e,t,r){if(!t?.length)return!0;if(e===void 0)return!1;let o=Ct.filter(n=>t.includes(n));return r==="exact"?e===o.join(""):r==="atMost"?[...e].every(n=>o.includes(n)):o.every(n=>e.includes(n))}function De(e,t){let r=Ae[t]??Ae[Le];return[...e].sort(r)}var I=e=>(t,r)=>{let o=e(t),n=e(r);return o===void 0&&n===void 0?w(t,r):o===void 0?1:n===void 0?-1:n-o||w(t,r)},At=e=>(t,r)=>{let o=e(t),n=e(r);return o===void 0&&n===void 0?w(t,r):o===void 0?1:n===void 0?-1:o-n||w(t,r)};function w(e,t){return(e.popularity?.edhrecRank??1/0)-(t.popularity?.edhrecRank??1/0)}var Ae={edge:I(e=>e.edgeScore),momentum:I(e=>e.momentum),worksScore:I(e=>e.worksScore),price:At(e=>e.price),released:(e,t)=>String(t.releasedAt??"").localeCompare(String(e.releasedAt??""))||w(e,t),name:(e,t)=>e.name.localeCompare(t.name),rank:w,deckCount:I(e=>e.popularity?.deckCount)};var x=60,Lt=140,_e="mtg-edge-lord:filters",Mt=[{id:"W",label:"W"},{id:"U",label:"U"},{id:"B",label:"B"},{id:"R",label:"R"},{id:"G",label:"G"}],Ot=[{id:"",label:"Any tier"},{id:"edge",label:"Edge (1,000\u20133,000)"},{id:"rare",label:"Rare (500\u20131,000)"},{id:"meta",label:"Meta (top 500)"},{id:"uncharted",label:"Uncharted (3,000+)"}],a={tab:"search",filters:{...ae,...tr()},shown:x,expanded:null,detail:null,index:null,data:null,loading:!0,error:null},Ie=null,le=document.createElement("div");le.id="mtg-edge-lord-root";var p=le.attachShadow({mode:"open"}),u=document.createElement("div");u.id="mtg-edge-lord-button";var ce=u.attachShadow({mode:"open"});document.body.append(le);Nt();Fe();It();ze({checkRemote:!1});function Nt(){ce.innerHTML=`<style>${R}</style>
    <button id="toggle" type="button" aria-expanded="false" aria-label="MTG Edge Lord advanced search">Advanced</button>`,p.innerHTML=`<style>${R}</style>
    <section id="panel" aria-label="MTG Edge Lord" hidden>
      <header>
        <div><strong>MTG Edge Lord</strong><span id="status">Loading\u2026</span></div>
        <a href="https://github.com/RktRobinhood/MTG-Edge-Lord" target="_blank" rel="noopener noreferrer">About</a>
      </header>
      <nav>${F("search","Search")}${F("discover","Recent finds")}${F("card","Card-first")}${F("archive","Archive")}</nav>
      <main></main>
    </section>`,ce.getElementById("toggle").addEventListener("click",jt),p.querySelector("nav").addEventListener("click",e=>{let t=e.target.closest("button[data-tab]");t&&(a.tab=t.dataset.tab,a.shown=x,de())})}function Dt(){for(let e of document.querySelectorAll('header nav input[aria-label="Search"], header nav input.rbt-input-main')){let t=e.closest('[class*="Navbar_search"], .input-group');if(t?.getBoundingClientRect().width)return t}return null}function Fe(){let e=Dt();if(e){u.classList.remove("floating"),u.previousElementSibling!==e&&e.after(u);return}u.classList.add("floating"),u.parentElement!==document.body&&document.body.append(u)}function It(){let e=null,t=()=>{clearTimeout(e),e=setTimeout(()=>{Fe(),Z(a.index?.commanders),p.getElementById("panel").hidden||Be()},100)};new MutationObserver(t).observe(document.body,{childList:!0,subtree:!0}),addEventListener("resize",t)}function jt(){let e=p.getElementById("panel"),t=e.hidden;t&&Be(),e.hidden=!t;let r=ce.getElementById("toggle");r.setAttribute("aria-expanded",String(t)),r.classList.toggle("on",t),t&&ze()}var je=14;function Be(){let e=p.getElementById("panel"),t=u.getBoundingClientRect(),r=!u.classList.contains("floating");e.style.setProperty("--mel-top",`${r?Math.round(t.bottom)+8:je}px`),e.style.setProperty("--mel-right",`${je}px`)}async function ze({checkRemote:e=!0}={}){try{a.data=await Se({checkRemote:e}),a.index=Oe(a.data.commanders.commanders),a.error=null}catch(t){a.error=t.message}finally{a.loading=!1,de(),Z(a.index?.commanders)}}function de(){p.querySelectorAll("nav button").forEach(t=>t.classList.toggle("active",t.dataset.tab===a.tab)),p.getElementById("status").textContent=_t();let e=p.querySelector("main");if(a.loading)return void(e.innerHTML='<div class="empty">Loading\u2026</div>');if(a.error)return void(e.innerHTML=`<div class="empty">${s(a.error)}</div>`);e.innerHTML=`
    ${a.data.stale?'<div class="notice">Live data could not be reached. Showing the last cached version.</div>':""}
    ${a.tab==="search"?Ht():qt()}
    <div class="summary" id="result-summary"></div>
    <div class="stack" id="results"></div>`,Bt(e),v()}function _t(){if(!a.data)return"Discovery data unavailable";let e=a.index?.commanders.length??0,t=a.data.stale?"offline":Ft(a.data.checkedAt);return`${e.toLocaleString()} commanders \xB7 ${a.data.manifest.dataVersion}${t?` \xB7 ${t}`:""}`}function Ft(e){let t=Date.now()-Date.parse(e);if(!Number.isFinite(t)||t<0)return"";let r=Math.floor(t/36e5);return r<1?"checked just now":r<24?`checked ${r}h ago`:"checking\u2026"}function Bt(e){e.querySelectorAll("[data-field]").forEach(t=>{let r=t.tagName==="SELECT"||t.type==="checkbox"?"change":"input";t.addEventListener(r,()=>{let o=t.type==="checkbox"?t.checked:t.value;a.filters[t.dataset.field]=o,a.shown=x,se(),r==="input"?zt():v()})}),e.querySelectorAll("[data-color]").forEach(t=>t.addEventListener("click",()=>{let r=t.dataset.color,o=a.filters.colors.includes(r)?a.filters.colors.filter(n=>n!==r):[...a.filters.colors,r];a.filters.colors=o,t.classList.toggle("on",o.includes(r)),a.shown=x,se(),v()})),e.addEventListener("click",t=>{if(t.target.closest("a, button, input, select, label"))return;let r=t.target.closest("[data-open]");r&&open(r.dataset.open,"_blank","noopener")}),e.querySelector("#reset")?.addEventListener("click",()=>{a.filters={...ae},a.shown=x,se(),de()})}function zt(){clearTimeout(Ie),Ie=setTimeout(v,Lt)}function v(){let e=p.getElementById("results"),t=p.getElementById("result-summary");if(!e)return;if(a.tab==="discover"){let n=Re(a.data.findings.findings).filter(i=>ie(`${i.title} ${i.summary}`,a.filters.query)).sort((i,l)=>l.score.total-i.score.total);return t.textContent=`${n.length} find${n.length===1?"":"s"}`,e.innerHTML=n.slice(0,a.shown).map(Xt).join("")||B("No finds match that search yet."),_(e)}if(a.tab==="archive"){let n=(a.data.archive?.archive??[]).filter(i=>ie(i.name,a.filters.query));return t.textContent=n.length?`${n.length} commander${n.length===1?"":"s"} surfaced to date`:"Nothing surfaced yet",e.innerHTML=n.slice(0,a.shown).map(Qt).join("")||B("No commander has been surfaced under that name yet."),_(e)}if(a.tab==="card"){let n=a.data.cards.cards.filter(i=>ie(i.name,a.filters.query));return t.textContent=`${n.length} card${n.length===1?"":"s"}`,e.innerHTML=n.slice(0,a.shown).map(er).join("")||B("No cards match that search yet."),_(e)}let r=De(Ne(a.index,a.filters),a.filters.sort),o=r.filter(n=>n.edgeScore!==void 0).length;t.innerHTML=`<strong>${r.length.toLocaleString()}</strong> commanders \xB7 ${o.toLocaleString()} scored \xB7 sorted by ${s(rr(a.filters.sort))}`,e.innerHTML=r.slice(0,a.shown).map(Pt).join("")||B("Nothing matches those filters. Widen the rank band or clear a colour."),r.length>a.shown&&e.insertAdjacentHTML("beforeend",`<button class="more" id="more" type="button">Show ${Math.min(x,r.length-a.shown)} more of ${(r.length-a.shown).toLocaleString()}</button>`),_(e)}function _(e){e.querySelector("#more")?.addEventListener("click",()=>{a.shown+=x,v()}),e.querySelectorAll("[data-expand]").forEach(t=>t.addEventListener("click",async()=>{let r=t.dataset.expand;a.expanded=a.expanded===r?null:r,a.expanded&&!a.detail&&(a.detail=await Ce(a.data.manifest.dataVersion)),v()}))}function Ht(){let e=a.filters;return`<div class="controls">
    <input class="query" data-field="query" value="${c(e.query)}" placeholder="Name, theme, mechanic, creature type" aria-label="Search">
    <div class="row colors">
      <span class="label">Colour identity</span>
      ${Mt.map(t=>`<button type="button" class="pip ${e.colors.includes(t.id)?"on":""}" data-color="${t.id}" aria-label="${t.label}">${t.label}</button>`).join("")}
      <select data-field="colorMode" aria-label="Colour matching">${b(Me.map(t=>[t.id,t.label]),e.colorMode)}</select>
    </div>
    <div class="row">
      <span class="label">Rank band</span>
      <input type="number" min="1" data-field="minRank" value="${c(e.minRank)}" placeholder="1000">
      <span class="to">to</span>
      <input type="number" min="1" data-field="maxRank" value="${c(e.maxRank)}" placeholder="3000">
      <select data-field="tier" aria-label="Tier">${b(Ot.map(t=>[t.id,t.label]),e.tier)}</select>
    </div>
    <div class="row">
      <span class="label">Mana value</span>
      <input type="number" min="0" data-field="minManaValue" value="${c(e.minManaValue)}" placeholder="0">
      <span class="to">to</span>
      <input type="number" min="0" data-field="maxManaValue" value="${c(e.maxManaValue)}" placeholder="9">
      <span class="label">Max $</span>
      <input type="number" min="0" step="0.5" data-field="maxPrice" value="${c(e.maxPrice)}" placeholder="any">
    </div>
    <div class="row">
      <select data-field="theme" aria-label="Theme">${b([["","Any theme"],...a.index.themes.map(t=>[t,H(t)])],e.theme)}</select>
      <select data-field="functionalTag" aria-label="Mechanic">${b([["","Any mechanic"],...a.index.functionalTags.map(t=>[t,H(t)])],e.functionalTag)}</select>
      <select data-field="creatureType" aria-label="Creature type">${b([["","Any creature type"],...a.index.creatureTypes.map(t=>[t,t])],e.creatureType)}</select>
    </div>
    <div class="row">
      <span class="label">Bracket fit at least</span>
      <select data-field="minBracketFit" aria-label="Bracket fit">${b([["","Any"],["0.4","40%"],["0.55","55%"],["0.7","70%"]],e.minBracketFit)}</select>
      <span class="label">Released after</span>
      <input type="date" data-field="releasedAfter" value="${c(e.releasedAfter)}">
    </div>
    <div class="row">
      <label class="check"><input type="checkbox" data-field="scoredOnly" ${e.scoredOnly?"checked":""}> Scored only</label>
      <select data-field="sort" aria-label="Sort">${b(j.map(t=>[t.id,t.label]),e.sort)}</select>
      <button type="button" id="reset" class="reset">Reset</button>
    </div>
  </div>`}function qt(){return`<div class="controls"><input class="query" data-field="query" value="${c(a.filters.query)}" placeholder="Search" aria-label="Search"></div>`}function Pt(e){let t=a.expanded===e.slug,r=z(e.slug),o=(e.themes??[]).slice(0,3);return`<article class="card commander" data-open="${c(r)}">
    <div class="head">
      <h3><a href="${c(r)}" target="_blank" rel="noopener noreferrer">${s(e.name)}</a></h3>
      ${Ut(e)}
    </div>
    <div class="line">
      ${Wt(e)}
      ${e.tier?`<span class="tier ${c(e.tier)}">${s(e.tier)}</span>`:""}
      <span class="muted">${s(Gt(e))}</span>
    </div>
    ${He(e.findingIds)}
    <div class="foot">
      <div class="chips">${o.map(n=>`<span class="chip">${s(H(n))}</span>`).join("")}</div>
      <button type="button" class="why-toggle${t?" on":""}" data-expand="${c(e.slug)}" aria-expanded="${t}" aria-label="Why it works" title="Why it works">?</button>
    </div>
    ${t?Vt(e):""}
  </article>`}function z(e){return`https://edhrec.com/commanders/${encodeURIComponent(e)}`}function Ut(e){let t=M(e.manaCost);return t||(e.colorIdentity===void 0?"":`<span class="chip">${s(e.colorIdentity||"Colourless")}</span>`)}function Gt(e){let t=e.popularity?.edhrecRank,r=e.popularity?.deckCount;return[t?`#${t.toLocaleString()}`:null,r?`${r.toLocaleString()} decks`:null,e.price!==void 0?`$${e.price.toFixed(2)}`:null].filter(Boolean).join(" \xB7 ")}function Vt(e){return`<div class="detail">
    ${Kt(e)}
    ${Yt(e)}
    ${Jt(e)}
  </div>`}function Wt(e){return e.edgeScore!==void 0?`<span class="score">${e.edgeScore}</span>`:e.cohortScore!==void 0?`<span class="score cohort" title="Scored against its set cohort, not the whole format">${e.cohortScore}<small>new</small></span>`:'<span class="score none" title="Not enough evidence to score">\u2014</span>'}function Kt(e){return e.cohortScore!==void 0?`<p class="cohort-note">New arrival \u2014 scored against its ${s(String(e.cohort?.setCode??"").toUpperCase())} set cohort, not the whole format.</p>
      <ul class="why">${A(e).map(t=>`<li>${s(t)}</li>`).join("")}</ul>`:e.edgeScore===void 0?`<p class="insufficient">Insufficient data \u2014 ${s(E(e))}</p>`:`<ul class="why">${C(e).map(t=>`<li>${s(t)}</li>`).join("")}</ul>`}function Yt(e){let t=e.quality;if(!t)return"";let r=[["Bracket fit",t.bracketFit],["Archetype depth",t.archetypeDepth],["Retention",t.retention]].filter(([,o])=>o!==void 0);return r.length?`<div class="chips">${r.map(([o,n])=>`<span class="chip quality">${o} ${Math.round(n*100)}%</span>`).join("")}${e.partialScore?'<span class="chip muted">partial</span>':""}</div>`:""}function Jt(e){let t=a.detail?.[e.slug];return t?`<div class="more-detail">
    ${t.highSynergyCards?.length?`<p class="label">Cards that want to be here</p><div class="chips">${t.highSynergyCards.map(r=>`<a class="chip" href="https://edhrec.com/cards/${encodeURIComponent(r)}" target="_blank" rel="noopener noreferrer">${s(H(r))}</a>`).join("")}</div>`:""}
    ${t.similar?.length?`<p class="label">Plays like</p><div class="chips">${t.similar.map(r=>`<span class="chip">${s(r)}</span>`).join("")}</div>`:""}
    ${e.comboCount&&e.comboUrl?`<p class="muted"><a href="${c(e.comboUrl)}" target="_blank" rel="noopener noreferrer">${e.comboCount} known combo line${e.comboCount===1?"":"s"} on Commander Spellbook \u2197</a> \u2014 shown, never scored.</p>`:""}
    ${Zt(e)}
    ${e.dedicatedCommunity?`<p class="muted"><a href="${c(e.dedicatedCommunity.url)}" target="_blank" rel="noopener noreferrer">Has a dedicated community \u2197</a> \u2014 via ${s(e.dedicatedCommunity.source)}.</p>`:""}
  </div>`:""}function Zt(e){let t=e.cedhListing;if(!t?.sourceUrl)return"";let r={brew:"In the Brewer's Corner",competitive:"Listed as an established competitive deck",outdated:"Listed, but its entry is marked outdated"}[t.section];if(!r)return"";let o=t.updatedAt?` \xB7 entry updated ${s(t.updatedAt.slice(0,10))}`:"";return`<p class="muted"><a href="${c(t.sourceUrl)}" target="_blank" rel="noopener noreferrer">${r} on the cEDH Decklist Database \u2197</a>${o} \u2014 shown, never scored.</p>`}function Xt(e){let t=[...e.commanders,...e.cards].map(r=>`<span class="chip">${s(r.name)}</span>`).join("");return`<a class="card digest" href="${c(e.source.url)}" target="_blank" rel="noopener noreferrer">
    <div class="credit">
      <span class="source">${s(ne(e.source))}</span>
      <span class="muted">${s(e.publishedAt)}${e.observedAt?` \xB7 found ${s(e.observedAt.slice(0,10))}`:""}</span>
    </div>
    <h3>${s(e.title)}</h3>
    <p class="clamp">${s(Ee(e.summary))}</p>
    <div class="chips">${t}</div>
    <span class="readon">Read it at ${s(ne(e.source))} \u2197</span>
  </a>`}function Qt(e){let t=e.popularityAtFirstSurface?.edhrecRank,r=(e.sources??[]).filter(n=>typeof n.url=="string"&&n.url.startsWith("https://")).map(n=>`<a class="chip" href="${c(n.url)}" target="_blank" rel="noopener noreferrer">${s(n.creator||n.name)} \u2197</a>`).join(""),o=e.timesSurfaced>1?` \xB7 surfaced ${e.timesSurfaced} times`:"";return`<article class="card" data-open="${c(z(e.slug))}">
    <div class="credit">
      <span class="muted">First surfaced ${s(e.firstSurfacedAt)}${o}</span>
    </div>
    <h3><a href="${c(z(e.slug))}" target="_blank" rel="noopener noreferrer">${s(e.name)}</a></h3>
    ${t?`<p class="muted">Rank ${t.toLocaleString()} when found${e.popularityAtFirstSurface.deckCount?` \xB7 ${e.popularityAtFirstSurface.deckCount.toLocaleString()} decks`:""}</p>`:""}
    <div class="chips">${r}</div>
  </article>`}function er(e){let t=e.commanders.map(r=>`<a class="chip" href="${c(z(r.slug))}" target="_blank" rel="noopener noreferrer">${s(r.name)} \xB7 ${r.relationshipScore}</a>`).join("");return`<article class="card"><h3>${s(e.name)}</h3><div class="chips">${t}</div>${He(e.findingIds)}</article>`}function He(e=[]){let t=new Set(e),r=(a.data.resources.resources??[]).filter(o=>t.has(o.findingId)&&typeof o.url=="string"&&o.url.startsWith("https://")).slice(0,3);return r.length?`<p class="sources">${r.map(o=>`<a href="${c(o.url)}" target="_blank" rel="noopener noreferrer">${s(o.creator)} \xB7 ${nr(o.resourceDepth)} \u2197</a>`).join(" \xB7 ")}</p>`:""}function ie(e,t){let r=String(t??"").trim().toLowerCase();return!r||String(e).toLowerCase().includes(r)}function se(){try{sessionStorage.setItem(_e,JSON.stringify(a.filters))}catch{}}function tr(){try{return JSON.parse(sessionStorage.getItem(_e))??{}}catch{return{}}}function rr(e){return j.find(t=>t.id===e)?.label??j[0].label}function H(e){return String(e).replaceAll("-"," ").replace(/\b[a-z]/g,t=>t.toUpperCase())}function b(e,t){return e.map(([r,o])=>`<option value="${c(r)}" ${String(t)===String(r)?"selected":""}>${s(o)}</option>`).join("")}function F(e,t){return`<button type="button" data-tab="${e}" class="${a.tab===e?"active":""}">${t}</button>`}function nr(e){return s(String(e).replaceAll("_"," "))}function B(e){return`<div class="empty">${s(e)}</div>`}function s(e){let t=document.createElement("span");return t.textContent=String(e),t.innerHTML}function c(e){return s(e).replaceAll('"',"&quot;")}})();
