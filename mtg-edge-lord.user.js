// ==UserScript==
// @name         MTG Edge Lord — EDHREC Discovery
// @namespace    https://github.com/RktRobinhood/MTG-Edge-Lord
// @version      1.3.1
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
(()=>{var Ue="edge-v2",Ge=Object.freeze({bracketFit:.4,archetypeDepth:.4,retention:.2}),Ve=Object.freeze([0,0,1,1,.6]),G=30,y=Object.freeze({zeroAt:500,peakFrom:1e3,peakTo:3e3}),$=3e3,We=Object.freeze([{tier:"meta",maxRank:500},{tier:"rare",maxRank:1e3},{tier:"edge",maxRank:3e3},{tier:"uncharted",maxRank:1/0}]),Ke=e=>Math.round(e*10)/10,T=e=>Math.round(e*1e3)/1e3,fe=e=>Math.max(0,Math.min(1,Number(e)||0));function S(e){return!Number.isFinite(e)||e<=0?"uncharted":We.find(t=>e<=t.maxRank).tier}function he(e){return!Number.isFinite(e)||e<=y.zeroAt||e>y.peakTo?0:e>=y.peakFrom?1:T((e-y.zeroAt)/(y.peakFrom-y.zeroAt))}function Ye(e){if(!Array.isArray(e)||e.length!==5)return null;let t=e.map(r=>Math.max(0,Number(r)||0)),n=t.reduce((r,i)=>r+i,0);if(n<G)return null;let o=t.reduce((r,i,l)=>r+i*Ve[l],0);return T(o/n)}var P=2,Je=5,Ze=2;function Xe(e){if(!Array.isArray(e)||e.length<4)return null;let t=e.map(g=>Math.max(0,Number(g)||0)),n=Math.max(...t);if(n<Je)return null;let o=t.slice(-P),r=t.slice(-P*2,-P),i=pe(o),l=pe(r);return Math.max(...o)===n&&i>l*Ze?null:T(fe(i/n))}function ge(e,t=Ge){let n=e.popularity?.edhrecRank,o=S(n);if(!Number.isFinite(n)||n<=0)return{unscored:!0,reason:"No EDHREC rank yet, so obscurity cannot be judged.",tier:o};if(n>$)return{unscored:!0,reason:`Past EDHREC rank ${$}, where the evidence to say this works does not exist.`,tier:o};let r={bracketFit:Ye(e.bracketCounts),archetypeDepth:e.archetypeDepth===void 0?null:fe(e.archetypeDepth),retention:Xe(e.retentionTrend)};if(r.bracketFit===null)return{unscored:!0,reason:E(e),tier:o,...e.bracketCounts?{bracketCounts:e.bracketCounts}:{}};let i=Object.entries(r).filter(([,m])=>m!==null),l=i.reduce((m,[q])=>m+t[q],0),u=T(i.reduce((m,[q,Pe])=>m+Pe*t[q],0)/l),g=he(n);return{tier:o,obscurity:g,worksScore:u,edgeScore:Ke(g*u*100),quality:Object.fromEntries(i),partial:i.length<Object.keys(r).length,reasons:C(e,{obscurity:g,worksScore:u,tier:o,components:r}),modelVersion:Ue}}function C(e,{obscurity:t,worksScore:n,tier:o,components:r}={}){return t??=e.obscurity??he(e.popularity?.edhrecRank),n??=e.worksScore??0,o??=e.tier??S(e.popularity?.edhrecRank),r??={bracketFit:e.quality?.bracketFit??null,archetypeDepth:e.quality?.archetypeDepth??null,retention:e.quality?.retention??null},Qe(e,{obscurity:t,worksScore:n,tier:o,components:r})}function E(e){let t=e.popularity?.edhrecRank;if(!Number.isFinite(t)||t<=0)return"No EDHREC rank yet, so obscurity cannot be judged.";if(t>$)return`Past EDHREC rank ${$.toLocaleString()}, where the evidence to say this works does not exist.`;let n=U(e);return n>0?`Only ${n} bracket-tagged deck${n===1?"":"s"}, below the floor of ${G}.`:"No EDHREC page data has been collected for this commander yet."}function Qe(e,{obscurity:t,worksScore:n,tier:o,components:r}){let i=[];if(t>=1?i.push(`Sits at EDHREC rank ${e.popularity.edhrecRank}, squarely in the Edge tier.`):t>0&&i.push(`Rank ${e.popularity.edhrecRank} is on the edge of the Rare tier, so obscurity counts for less.`),r.bracketFit!==null){let l=Math.round(r.bracketFit*100),u=U(e);i.push(`${l}% of its ${u.toLocaleString()} bracket-tagged decks are built at Bracket 3 or above.`)}else e.bracketCounts&&i.push(`Bracket data shown but not scored: only ${U(e)} tagged decks, below the floor of ${G}.`);return r.archetypeDepth!==null&&i.push(r.archetypeDepth>=.35?"A deep pool of high-synergy cards means there is an archetype here, not just goodstuff.":"A shallow high-synergy pool suggests the deck leans on colour-identity staples."),r.retention!==null&&i.push(r.retention>=.5?"Deck saves are holding or climbing rather than fading after release.":"Deck saves are falling away from their earlier level."),n<.3&&i.push("The evidence that this works is weak, so the Edge score stays low however obscure it is."),o==="rare"&&n>=.5&&i.push("Known enough to have a track record, obscure enough to be worth a second look."),i.slice(0,5)}function U(e){return Array.isArray(e.bracketCounts)?e.bracketCounts.reduce((t,n)=>t+(Number(n)||0),0):0}function pe(e){return e.length?e.reduce((t,n)=>t+n,0)/e.length:0}var sn=Object.freeze({cohortPosition:.6,interestToTraction:.4});function A(e){let t=e?.cohort;if(!t)return[];let n=e.popularity?.deckCount??0,o=[`${et(t.position)} of ${t.size} new legends in ${String(t.setCode).toUpperCase()}, with ${n.toLocaleString()} deck${n===1?"":"s"} so far.`],r=e.mentionCount;return o.push(Number.isFinite(r)&&r>0?`${r} deck-tech mention${r===1?"":"s"} against ${n.toLocaleString()} build${n===1?"":"s"}.`:"No deck-tech coverage found yet, so this is cohort position alone."),o}function et(e){let t=e%100;return t>=11&&t<=13?`${e}th`:`${e}${["th","st","nd","rd"][e%10]??"th"}`}var tt=/\{([^}]{1,4})\}/g,L=Object.freeze({W:"#f7f2da",U:"#b3dbf2",B:"#c0b5ad",R:"#f2a687",G:"#a4d5ae",C:"#cfd5d3"}),V="#cbcfcd";function nt(e){let t=[];for(let[,n]of String(e??"").matchAll(tt)){let o=rt(n.toUpperCase());o&&t.push(o)}return t}function rt(e){if(e.includes("/")){let t=e.split("/"),n=t.at(-1)==="P",o=(n?t.slice(0,-1):t).filter(i=>L[i]),r=o.length?o.map(i=>L[i]):[V];return n?{glyph:"\u03A6",colors:r}:{glyph:t.map(ot).join(""),colors:r}}return L[e]?{glyph:e,colors:[L[e]]}:/^\d{1,3}$/.test(e)?{glyph:e,colors:[V]}:/^[XYZS]$/.test(e)?{glyph:e,colors:[V]}:null}function ot(e){return/^[WUBRGCXYZS]$|^\d$/.test(e)?e:""}function M(e){let t=String(e??"").split("//").map(nt).filter(r=>r.length);if(!t.length)return"";let n=t.map(r=>r.map(at).join("")).join('<i class="pip-split">//</i>');return`<span class="mana" aria-label="Mana cost ${t.map(st).join(" or ")}" role="img">${n}</span>`}function at(e){return`<i class="pip-mana" style="background:${it(e.colors)}">${e.glyph}</i>`}function it(e){return e.length===1?e[0]:`linear-gradient(-45deg, ${e[0]} 0 50%, ${e.at(-1)} 50% 100%)`}function st(e){return e.map(t=>t.glyph==="\u03A6"?"Phyrexian":t.glyph).join(" ")}var R=`
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

/* The status line doubles as the manual re-check, so it is a button that has
   to keep reading as the quiet caption it replaced: chrome only on hover. */
#status { display:block; padding:0; border:0; background:none; color:var(--mel-muted); font-size:12px; text-align:left; cursor:pointer; text-decoration:underline dotted transparent; text-underline-offset:3px }
#status:hover { color:var(--mel-text); text-decoration-color:var(--mel-muted) }
#status:focus-visible { outline:2px solid var(--mel-green); outline-offset:2px; border-radius:3px }
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
`;var k=document.createElement("div");k.id="mtg-edge-lord-insight";var Y=k.attachShadow({mode:"open"});Y.innerHTML=`<style>${R}</style><div id="insight"></div>`;var J=null,me=new Set,W={source:null,bySlug:new Map};function Z(e){let t=lt(location.pathname);if(!t||!e?.length||me.has(t))return K();let n=ct(e).get(t);if(!n)return K();J!==t&&(Y.getElementById("insight").innerHTML=ut(n),Y.querySelector("#dismiss")?.addEventListener("click",()=>{me.add(t),K()}),J=t),k.isConnected||dt()}function ct(e){return W.source!==e&&(W={source:e,bySlug:new Map(e.map(t=>[t.slug,t]))}),W.bySlug}function lt(e){let[,t,n]=String(e).split("/");return t==="commanders"&&n?decodeURIComponent(n):null}function dt(){let e=document.querySelector("main");e?.parentElement?e.parentElement.insertBefore(k,e):document.body.prepend(k)}function K(){k.remove(),J=null}function ut(e){let t=e.popularity?.edhrecRank,n=e.popularity?.deckCount;return`<article>
    <div class="head">
      <span class="brand">MTG Edge Lord</span>
      <button id="dismiss" type="button" aria-label="Hide this">\xD7</button>
    </div>
    <div class="line">
      ${pt(e)}
      ${M(e.manaCost)}
      <span class="muted">#${t?.toLocaleString()??"\u2014"}${n?` \xB7 ${n.toLocaleString()} decks`:""}${e.price!==void 0?` \xB7 $${e.price.toFixed(2)}`:""}</span>
    </div>
    ${ft(e)}
  </article>`}function pt(e){return e.edgeScore!==void 0?`<span class="score">${e.edgeScore}</span><span class="tier ${ht(e.tier??"")}">${O(e.tier??"scored")}</span>`:e.cohortScore!==void 0?`<span class="score cohort">${e.cohortScore}<small>new</small></span>`:'<span class="score none">\u2014</span>'}function ft(e){return e.cohortScore!==void 0?`<ul class="why">${A(e).map(be).join("")}</ul>`:e.edgeScore===void 0?`<p class="insufficient">Not scored \u2014 ${O(E(e))}</p>`:`<ul class="why">${C(e).map(be).join("")}</ul>`}function be(e){return`<li>${O(e)}</li>`}function O(e){let t=document.createElement("span");return t.textContent=String(e),t.innerHTML}function ht(e){return O(e).replaceAll('"',"&quot;")}var X="columnar/1";function ye(e){if(e?.format!==X)throw new Error(`Unsupported columnar format: ${e?.format??"missing"}`);let t=Array.from({length:e.count},()=>({}));for(let[n,o]of Object.entries(e.columns)){let r=gt(o,e.count);for(let i=0;i<e.count;i+=1)r[i]!==null&&mt(t[i],n,r[i])}return t}function gt(e,t){if(e.kind==="raw")return e.values;if(e.kind==="tokens")return e.index.map(n=>n===null?null:n.map(o=>e.vocabulary[o]));if(e.kind==="dict")return e.index.map(n=>n===-1?null:xe(e.keys[n]));if(e.kind==="sparse"){let n=Array.from({length:t},()=>xe(e.fill));return e.index.forEach((o,r)=>{n[o]=e.values[r]}),n}throw new Error(`Unsupported column kind: ${e.kind}`)}function xe(e){return typeof e=="object"&&e!==null?structuredClone(e):e}function mt(e,t,n){let o=t.split("."),r=e;for(let i of o.slice(0,-1))bt(r[i])||(r[i]={}),r=r[i];r[o.at(-1)]=n}function bt(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}var yn=Object.freeze({trendZscore:3,momentum:1,diamondScore:1,edgeScore:1,cohortScore:1,"quality.bracketFit":3,"quality.archetypeDepth":3,"quality.retention":3,price:2});function ke(e){let t=e?.commanders;return Array.isArray(t)?t:t?.format===X?ye(t):[]}var xt="mtg-edge-lord",f="datasets";var N=null;function Q(){return N||(N=new Promise(e=>{if(!globalThis.indexedDB)return e(null);let t;try{t=indexedDB.open(xt,1)}catch{return e(null)}t.onupgradeneeded=()=>{t.result.objectStoreNames.contains(f)||t.result.createObjectStore(f)},t.onsuccess=()=>e(t.result),t.onerror=()=>e(null),t.onblocked=()=>e(null)}),N)}async function ee(e){let t=await Q();return t?new Promise(n=>{try{let o=t.transaction(f,"readonly").objectStore(f).get(e);o.onsuccess=()=>n(o.result??null),o.onerror=()=>n(null)}catch{n(null)}}):null}async function D(e,t){let n=await Q();return n?new Promise(o=>{try{let r=n.transaction(f,"readwrite");r.objectStore(f).put(t,e),r.oncomplete=()=>o(!0),r.onerror=()=>o(!1),r.onabort=()=>o(!1)}catch{o(!1)}}):!1}async function ve(e){let t=await Q();if(t)try{t.transaction(f,"readwrite").objectStore(f).delete(e)}catch{}}var $e="https://rktrobinhood.github.io/MTG-Edge-Lord/data",Se="https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/data",te="datasets:v2",ne="commander-detail:v2",yt=1440*60*1e3;function kt(e,t){let n=t-Date.parse(e?.checkedAt);return!(n>=0&&n<yt)}var vt="mtg-edge-lord:data:v1";async function Ce({force:e=!1,checkRemote:t=!0}={}){$t();let n=await ee(te),o=Date.now();if(n&&!e&&(!t||!kt(n,o)))return{...n,stale:!1};try{let r;try{r=await we($e,n,e)}catch{r=await we(Se,n,e)}let i=new Date(o).toISOString();if(r.cached){let u={...n,checkedAt:i};return await D(te,u),{...u,stale:!1}}let l={manifest:r.manifest,...r.datasets,cachedAt:new Date(o).toISOString(),checkedAt:i};return await D(te,l),n?.manifest?.dataVersion!==r.manifest.dataVersion&&await ve(ne),{...l,stale:!1}}catch(r){if(n)return{...n,stale:!0,error:r.message};throw r}}async function Ee(e){let t=await ee(ne);if(t?.dataVersion===e)return t.detail;for(let n of[$e,Se])try{let{detail:o}=await h(`${n}/commander-detail.json`);return await D(ne,{dataVersion:e,detail:o}),o}catch{}return t?.detail??{}}async function we(e,t,n){let o=await h(`${e}/manifest.json?ts=${Date.now()}`);if(!n&&t?.manifest?.dataVersion===o.dataVersion)return{cached:!0};let[r,i,l,u,g,m]=await Promise.all([h(`${e}/findings.json`),h(`${e}/commanders.json`).then(wt),h(`${e}/hidden-cards.json`),h(`${e}/community-resources.json`),h(`${e}/relationships/card-commander.json`),h(`${e}/archive.json`).catch(()=>({schemaVersion:1,archive:[]}))]);return{manifest:o,datasets:{findings:r,commanders:i,cards:l,resources:u,relationships:g,archive:m}}}function wt(e){return{schemaVersion:e?.schemaVersion??1,commanders:ke(e)}}function $t(){try{localStorage.removeItem(vt)}catch{}}function h(e){let t=globalThis.GM?.xmlHttpRequest??globalThis.GM_xmlhttpRequest;return t?new Promise((n,o)=>t({method:"GET",url:e,headers:{Accept:"application/json"},onload:r=>{if(r.status<200||r.status>=300)return o(new Error(`HTTP ${r.status}`));try{n(JSON.parse(r.responseText))}catch{o(new Error("Backend returned invalid JSON."))}},onerror:()=>o(new Error("Could not reach the MTG Edge Lord data backend."))})):fetch(e).then(St).then(n=>n.json())}function St(e){if(!e.ok)throw new Error(`HTTP ${e.status}`);return e}function Re(e,t=220){let n=String(e??"").trim();if(n.length<=t)return n;let o=n.slice(0,t),r=o.lastIndexOf(" ");return`${(r>t*.6?o.slice(0,r):o).replace(/[\s,;:.]+$/,"")}\u2026`}function Ct(e){let t=e?.source?.url;return typeof t=="string"&&/^https:\/\//.test(t)}function Te(e){return(e??[]).filter(Ct)}function re(e){let t=String(e?.creator??"").trim(),n=String(e?.name??"").trim();return t&&n&&t.toLowerCase()!==n.toLowerCase()?`${t} \xB7 ${n}`:t||n||"Source"}var Et=["W","U","B","R","G"],j=Object.freeze([{id:"edge",label:"Edge score"},{id:"momentum",label:"Momentum"},{id:"worksScore",label:"How well it works"},{id:"price",label:"Cheapest first"},{id:"released",label:"Most recent"},{id:"name",label:"Alphabetical"},{id:"rank",label:"EDHREC rank"},{id:"deckCount",label:"Deck count (popularity)"}]),Me="edge",Oe=Object.freeze([{id:"includes",label:"Includes"},{id:"exact",label:"Exactly"},{id:"atMost",label:"At most"}]),ae=Object.freeze({query:"",colors:[],colorMode:"includes",theme:"",functionalTag:"",creatureType:"",tier:"",minBracketFit:"",minRank:"",maxRank:"",minManaValue:"",maxManaValue:"",maxPrice:"",releasedAfter:"",scoredOnly:!1,sort:Me});function Rt(e){return e.map(t=>{if(t.cohortScore!==void 0)return{...t,tier:S(t.popularity?.edhrecRank)};if(t.edgeScore===void 0)return{...t,tier:S(t.popularity?.edhrecRank)};let n=ge(t);if(n.unscored){let o={...t,tier:n.tier};return delete o.edgeScore,o}return{...t,tier:n.tier,obscurity:n.obscurity,worksScore:n.worksScore,edgeScore:n.edgeScore,quality:n.quality}})}function Ne(e){let t=Rt(e),n=t.map(o=>[o.name,...o.themes??[],...o.functionalTags??[],...o.creatureTypes??[],...o.types??[]].join(" ").toLowerCase());return{commanders:t,haystacks:n,themes:oe(t,"themes"),functionalTags:oe(t,"functionalTags"),creatureTypes:oe(t,"creatureTypes")}}function oe(e,t){let n=new Map;for(let o of e)for(let r of o[t]??[])n.set(r,(n.get(r)??0)+1);return[...n.entries()].sort((o,r)=>r[1]-o[1]||o[0].localeCompare(r[0])).map(([o])=>o)}function De(e,t){let n=String(t.query??"").toLowerCase().split(/\s+/).filter(Boolean),o=[];for(let r=0;r<e.commanders.length;r+=1){if(n.length&&!n.every(l=>e.haystacks[r].includes(l)))continue;let i=e.commanders[r];Tt(i,t)&&o.push(i)}return o}function Tt(e,t){let n=e.popularity?.edhrecRank;return!(!At(e.colorIdentity,t.colors,t.colorMode)||t.theme&&!(e.themes??[]).includes(t.theme)||t.functionalTag&&!(e.functionalTags??[]).includes(t.functionalTag)||t.creatureType&&!(e.creatureTypes??[]).includes(t.creatureType)||t.tier&&e.tier!==t.tier||t.scoredOnly&&e.edgeScore===void 0||t.minBracketFit!==""&&!(e.quality?.bracketFit>=Number(t.minBracketFit))||!Ae(n,t.minRank,t.maxRank)||!Ae(e.manaValue,t.minManaValue,t.maxManaValue)||t.maxPrice!==""&&e.price!==void 0&&e.price>Number(t.maxPrice)||t.releasedAfter&&(e.releasedAt??"")<t.releasedAfter)}function Ae(e,t,n){return t===""&&n===""?!0:!(!Number.isFinite(e)||t!==""&&e<Number(t)||n!==""&&e>Number(n))}function At(e,t,n){if(!t?.length)return!0;if(e===void 0)return!1;let o=Et.filter(r=>t.includes(r));return n==="exact"?e===o.join(""):n==="atMost"?[...e].every(r=>o.includes(r)):o.every(r=>e.includes(r))}function Ie(e,t){let n=Le[t]??Le[Me];return[...e].sort(n)}var I=e=>(t,n)=>{let o=e(t),r=e(n);return o===void 0&&r===void 0?v(t,n):o===void 0?1:r===void 0?-1:r-o||v(t,n)},Lt=e=>(t,n)=>{let o=e(t),r=e(n);return o===void 0&&r===void 0?v(t,n):o===void 0?1:r===void 0?-1:o-r||v(t,n)};function v(e,t){return(e.popularity?.edhrecRank??1/0)-(t.popularity?.edhrecRank??1/0)}var Le={edge:I(e=>e.edgeScore),momentum:I(e=>e.momentum),worksScore:I(e=>e.worksScore),price:Lt(e=>e.price),released:(e,t)=>String(t.releasedAt??"").localeCompare(String(e.releasedAt??""))||v(e,t),name:(e,t)=>e.name.localeCompare(t.name),rank:v,deckCount:I(e=>e.popularity?.deckCount)};var x=60,Mt=140,Be="mtg-edge-lord:filters",Ot=[{id:"W",label:"W"},{id:"U",label:"U"},{id:"B",label:"B"},{id:"R",label:"R"},{id:"G",label:"G"}],Nt=[{id:"",label:"Any tier"},{id:"edge",label:"Edge (1,000\u20133,000)"},{id:"rare",label:"Rare (500\u20131,000)"},{id:"meta",label:"Meta (top 500)"},{id:"uncharted",label:"Uncharted (3,000+)"}],a={tab:"search",filters:{...ae,...tn()},shown:x,expanded:null,detail:null,index:null,data:null,loading:!0,error:null},je=null,le=document.createElement("div");le.id="mtg-edge-lord-root";var d=le.attachShadow({mode:"open"}),p=document.createElement("div");p.id="mtg-edge-lord-button";var ce=p.attachShadow({mode:"open"});document.body.append(le);Dt();Fe();jt();de({checkRemote:!1});function Dt(){ce.innerHTML=`<style>${R}</style>
    <button id="toggle" type="button" aria-expanded="false" aria-label="MTG Edge Lord advanced search">Advanced</button>`,d.innerHTML=`<style>${R}</style>
    <section id="panel" aria-label="MTG Edge Lord" hidden>
      <header>
        <div><strong>MTG Edge Lord</strong><button id="status" type="button" title="Check the backend for new finds now">Loading\u2026</button></div>
        <a href="https://github.com/RktRobinhood/MTG-Edge-Lord" target="_blank" rel="noopener noreferrer">About</a>
      </header>
      <nav>${B("search","Search")}${B("discover","Recent finds")}${B("card","Card-first")}${B("archive","Archive")}</nav>
      <main></main>
    </section>`,ce.getElementById("toggle").addEventListener("click",_t),d.getElementById("status").addEventListener("click",async()=>{a.checking||(a.checking=!0,d.getElementById("status").textContent=He(),await de({force:!0}))}),d.querySelector("nav").addEventListener("click",e=>{let t=e.target.closest("button[data-tab]");t&&(a.tab=t.dataset.tab,a.shown=x,ue())})}function It(){for(let e of document.querySelectorAll('header nav input[aria-label="Search"], header nav input.rbt-input-main')){let t=e.closest('[class*="Navbar_search"], .input-group');if(t?.getBoundingClientRect().width)return t}return null}function Fe(){let e=It();if(e){p.classList.remove("floating"),p.previousElementSibling!==e&&e.after(p);return}p.classList.add("floating"),p.parentElement!==document.body&&document.body.append(p)}function jt(){let e=null,t=()=>{clearTimeout(e),e=setTimeout(()=>{Fe(),Z(a.index?.commanders),d.getElementById("panel").hidden||ze()},100)};new MutationObserver(t).observe(document.body,{childList:!0,subtree:!0}),addEventListener("resize",t)}function _t(){let e=d.getElementById("panel"),t=e.hidden;t&&ze(),e.hidden=!t;let n=ce.getElementById("toggle");n.setAttribute("aria-expanded",String(t)),n.classList.toggle("on",t),t&&de()}var _e=14;function ze(){let e=d.getElementById("panel"),t=p.getBoundingClientRect(),n=!p.classList.contains("floating");e.style.setProperty("--mel-top",`${n?Math.round(t.bottom)+8:_e}px`),e.style.setProperty("--mel-right",`${_e}px`)}async function de({checkRemote:e=!0,force:t=!1}={}){try{a.data=await Ce({checkRemote:e,force:t}),a.index=Ne(a.data.commanders.commanders),a.error=null}catch(n){a.error=n.message}finally{a.loading=!1,a.checking=!1,ue(),Z(a.index?.commanders)}}function ue(){d.querySelectorAll("nav button").forEach(t=>t.classList.toggle("active",t.dataset.tab===a.tab)),d.getElementById("status").textContent=He();let e=d.querySelector("main");if(a.loading)return void(e.innerHTML='<div class="empty">Loading\u2026</div>');if(a.error)return void(e.innerHTML=`<div class="empty">${s(a.error)}</div>`);e.innerHTML=`
    ${a.data.stale?'<div class="notice">Live data could not be reached. Showing the last cached version.</div>':""}
    ${a.tab==="search"?Ht():qt()}
    <div class="summary" id="result-summary"></div>
    <div class="stack" id="results"></div>`,Ft(e),w()}function He(){if(a.checking)return"Checking\u2026";if(!a.data)return"Discovery data unavailable";let e=a.index?.commanders.length??0,t=a.data.stale?"offline":Bt(a.data.checkedAt);return`${e.toLocaleString()} commanders \xB7 ${a.data.manifest.dataVersion}${t?` \xB7 ${t}`:""}`}function Bt(e){let t=Date.now()-Date.parse(e);if(!Number.isFinite(t)||t<0)return"";let n=Math.floor(t/36e5);return n<1?"checked just now":n<24?`checked ${n}h ago`:"checking\u2026"}function Ft(e){e.querySelectorAll("[data-field]").forEach(t=>{let n=t.tagName==="SELECT"||t.type==="checkbox"?"change":"input";t.addEventListener(n,()=>{let o=t.type==="checkbox"?t.checked:t.value;a.filters[t.dataset.field]=o,a.shown=x,se(),n==="input"?zt():w()})}),e.querySelectorAll("[data-color]").forEach(t=>t.addEventListener("click",()=>{let n=t.dataset.color,o=a.filters.colors.includes(n)?a.filters.colors.filter(r=>r!==n):[...a.filters.colors,n];a.filters.colors=o,t.classList.toggle("on",o.includes(n)),a.shown=x,se(),w()})),e.addEventListener("click",t=>{if(t.target.closest("a, button, input, select, label"))return;let n=t.target.closest("[data-open]");n&&open(n.dataset.open,"_blank","noopener")}),e.querySelector("#reset")?.addEventListener("click",()=>{a.filters={...ae},a.shown=x,se(),ue()})}function zt(){clearTimeout(je),je=setTimeout(w,Mt)}function w(){let e=d.getElementById("results"),t=d.getElementById("result-summary");if(!e)return;if(a.tab==="discover"){let r=Te(a.data.findings.findings).filter(i=>ie(`${i.title} ${i.summary}`,a.filters.query)).sort((i,l)=>l.score.total-i.score.total);return t.textContent=`${r.length} find${r.length===1?"":"s"}`,e.innerHTML=r.slice(0,a.shown).map(Xt).join("")||F("No finds match that search yet."),_(e)}if(a.tab==="archive"){let r=(a.data.archive?.archive??[]).filter(i=>ie(i.name,a.filters.query));return t.textContent=r.length?`${r.length} commander${r.length===1?"":"s"} surfaced to date`:"Nothing surfaced yet",e.innerHTML=r.slice(0,a.shown).map(Qt).join("")||F("No commander has been surfaced under that name yet."),_(e)}if(a.tab==="card"){let r=a.data.cards.cards.filter(i=>ie(i.name,a.filters.query));return t.textContent=`${r.length} card${r.length===1?"":"s"}`,e.innerHTML=r.slice(0,a.shown).map(en).join("")||F("No cards match that search yet."),_(e)}let n=Ie(De(a.index,a.filters),a.filters.sort),o=n.filter(r=>r.edgeScore!==void 0).length;t.innerHTML=`<strong>${n.length.toLocaleString()}</strong> commanders \xB7 ${o.toLocaleString()} scored \xB7 sorted by ${s(nn(a.filters.sort))}`,e.innerHTML=n.slice(0,a.shown).map(Pt).join("")||F("Nothing matches those filters. Widen the rank band or clear a colour."),n.length>a.shown&&e.insertAdjacentHTML("beforeend",`<button class="more" id="more" type="button">Show ${Math.min(x,n.length-a.shown)} more of ${(n.length-a.shown).toLocaleString()}</button>`),_(e)}function _(e){e.querySelector("#more")?.addEventListener("click",()=>{a.shown+=x,w()}),e.querySelectorAll("[data-expand]").forEach(t=>t.addEventListener("click",async()=>{let n=t.dataset.expand;a.expanded=a.expanded===n?null:n,a.expanded&&!a.detail&&(a.detail=await Ee(a.data.manifest.dataVersion)),w()}))}function Ht(){let e=a.filters;return`<div class="controls">
    <input class="query" data-field="query" value="${c(e.query)}" placeholder="Name, theme, mechanic, creature type" aria-label="Search">
    <div class="row colors">
      <span class="label">Colour identity</span>
      ${Ot.map(t=>`<button type="button" class="pip ${e.colors.includes(t.id)?"on":""}" data-color="${t.id}" aria-label="${t.label}">${t.label}</button>`).join("")}
      <select data-field="colorMode" aria-label="Colour matching">${b(Oe.map(t=>[t.id,t.label]),e.colorMode)}</select>
    </div>
    <div class="row">
      <span class="label">Rank band</span>
      <input type="number" min="1" data-field="minRank" value="${c(e.minRank)}" placeholder="1000">
      <span class="to">to</span>
      <input type="number" min="1" data-field="maxRank" value="${c(e.maxRank)}" placeholder="3000">
      <select data-field="tier" aria-label="Tier">${b(Nt.map(t=>[t.id,t.label]),e.tier)}</select>
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
  </div>`}function qt(){return`<div class="controls"><input class="query" data-field="query" value="${c(a.filters.query)}" placeholder="Search" aria-label="Search"></div>`}function Pt(e){let t=a.expanded===e.slug,n=z(e.slug),o=(e.themes??[]).slice(0,3);return`<article class="card commander" data-open="${c(n)}">
    <div class="head">
      <h3><a href="${c(n)}" target="_blank" rel="noopener noreferrer">${s(e.name)}</a></h3>
      ${Ut(e)}
    </div>
    <div class="line">
      ${Wt(e)}
      ${e.tier?`<span class="tier ${c(e.tier)}">${s(e.tier)}</span>`:""}
      <span class="muted">${s(Gt(e))}</span>
    </div>
    ${qe(e.findingIds)}
    <div class="foot">
      <div class="chips">${o.map(r=>`<span class="chip">${s(H(r))}</span>`).join("")}</div>
      <button type="button" class="why-toggle${t?" on":""}" data-expand="${c(e.slug)}" aria-expanded="${t}" aria-label="Why it works" title="Why it works">?</button>
    </div>
    ${t?Vt(e):""}
  </article>`}function z(e){return`https://edhrec.com/commanders/${encodeURIComponent(e)}`}function Ut(e){let t=M(e.manaCost);return t||(e.colorIdentity===void 0?"":`<span class="chip">${s(e.colorIdentity||"Colourless")}</span>`)}function Gt(e){let t=e.popularity?.edhrecRank,n=e.popularity?.deckCount;return[t?`#${t.toLocaleString()}`:null,n?`${n.toLocaleString()} decks`:null,e.price!==void 0?`$${e.price.toFixed(2)}`:null].filter(Boolean).join(" \xB7 ")}function Vt(e){return`<div class="detail">
    ${Kt(e)}
    ${Yt(e)}
    ${Jt(e)}
  </div>`}function Wt(e){return e.edgeScore!==void 0?`<span class="score">${e.edgeScore}</span>`:e.cohortScore!==void 0?`<span class="score cohort" title="Scored against its set cohort, not the whole format">${e.cohortScore}<small>new</small></span>`:'<span class="score none" title="Not enough evidence to score">\u2014</span>'}function Kt(e){return e.cohortScore!==void 0?`<p class="cohort-note">New arrival \u2014 scored against its ${s(String(e.cohort?.setCode??"").toUpperCase())} set cohort, not the whole format.</p>
      <ul class="why">${A(e).map(t=>`<li>${s(t)}</li>`).join("")}</ul>`:e.edgeScore===void 0?`<p class="insufficient">Insufficient data \u2014 ${s(E(e))}</p>`:`<ul class="why">${C(e).map(t=>`<li>${s(t)}</li>`).join("")}</ul>`}function Yt(e){let t=e.quality;if(!t)return"";let n=[["Bracket fit",t.bracketFit],["Archetype depth",t.archetypeDepth],["Retention",t.retention]].filter(([,o])=>o!==void 0);return n.length?`<div class="chips">${n.map(([o,r])=>`<span class="chip quality">${o} ${Math.round(r*100)}%</span>`).join("")}${e.partialScore?'<span class="chip muted">partial</span>':""}</div>`:""}function Jt(e){let t=a.detail?.[e.slug];return t?`<div class="more-detail">
    ${t.highSynergyCards?.length?`<p class="label">Cards that want to be here</p><div class="chips">${t.highSynergyCards.map(n=>`<a class="chip" href="https://edhrec.com/cards/${encodeURIComponent(n)}" target="_blank" rel="noopener noreferrer">${s(H(n))}</a>`).join("")}</div>`:""}
    ${t.similar?.length?`<p class="label">Plays like</p><div class="chips">${t.similar.map(n=>`<span class="chip">${s(n)}</span>`).join("")}</div>`:""}
    ${e.comboCount&&e.comboUrl?`<p class="muted"><a href="${c(e.comboUrl)}" target="_blank" rel="noopener noreferrer">${e.comboCount} known combo line${e.comboCount===1?"":"s"} on Commander Spellbook \u2197</a> \u2014 shown, never scored.</p>`:""}
    ${Zt(e)}
    ${e.dedicatedCommunity?`<p class="muted"><a href="${c(e.dedicatedCommunity.url)}" target="_blank" rel="noopener noreferrer">Has a dedicated community \u2197</a> \u2014 via ${s(e.dedicatedCommunity.source)}.</p>`:""}
  </div>`:""}function Zt(e){let t=e.cedhListing;if(!t?.sourceUrl)return"";let n={brew:"In the Brewer's Corner",competitive:"Listed as an established competitive deck",outdated:"Listed, but its entry is marked outdated"}[t.section];if(!n)return"";let o=t.updatedAt?` \xB7 entry updated ${s(t.updatedAt.slice(0,10))}`:"";return`<p class="muted"><a href="${c(t.sourceUrl)}" target="_blank" rel="noopener noreferrer">${n} on the cEDH Decklist Database \u2197</a>${o} \u2014 shown, never scored.</p>`}function Xt(e){let t=[...e.commanders,...e.cards].map(n=>`<span class="chip">${s(n.name)}</span>`).join("");return`<a class="card digest" href="${c(e.source.url)}" target="_blank" rel="noopener noreferrer">
    <div class="credit">
      <span class="source">${s(re(e.source))}</span>
      <span class="muted">${s(e.publishedAt)}${e.observedAt?` \xB7 found ${s(e.observedAt.slice(0,10))}`:""}</span>
    </div>
    <h3>${s(e.title)}</h3>
    <p class="clamp">${s(Re(e.summary))}</p>
    <div class="chips">${t}</div>
    <span class="readon">Read it at ${s(re(e.source))} \u2197</span>
  </a>`}function Qt(e){let t=e.popularityAtFirstSurface?.edhrecRank,n=(e.sources??[]).filter(r=>typeof r.url=="string"&&r.url.startsWith("https://")).map(r=>`<a class="chip" href="${c(r.url)}" target="_blank" rel="noopener noreferrer">${s(r.creator||r.name)} \u2197</a>`).join(""),o=e.timesSurfaced>1?` \xB7 surfaced ${e.timesSurfaced} times`:"";return`<article class="card" data-open="${c(z(e.slug))}">
    <div class="credit">
      <span class="muted">First surfaced ${s(e.firstSurfacedAt)}${o}</span>
    </div>
    <h3><a href="${c(z(e.slug))}" target="_blank" rel="noopener noreferrer">${s(e.name)}</a></h3>
    ${t?`<p class="muted">Rank ${t.toLocaleString()} when found${e.popularityAtFirstSurface.deckCount?` \xB7 ${e.popularityAtFirstSurface.deckCount.toLocaleString()} decks`:""}</p>`:""}
    <div class="chips">${n}</div>
  </article>`}function en(e){let t=e.commanders.map(n=>`<a class="chip" href="${c(z(n.slug))}" target="_blank" rel="noopener noreferrer">${s(n.name)} \xB7 ${n.relationshipScore}</a>`).join("");return`<article class="card"><h3>${s(e.name)}</h3><div class="chips">${t}</div>${qe(e.findingIds)}</article>`}function qe(e=[]){let t=new Set(e),n=(a.data.resources.resources??[]).filter(o=>t.has(o.findingId)&&typeof o.url=="string"&&o.url.startsWith("https://")).slice(0,3);return n.length?`<p class="sources">${n.map(o=>`<a href="${c(o.url)}" target="_blank" rel="noopener noreferrer">${s(o.creator)} \xB7 ${rn(o.resourceDepth)} \u2197</a>`).join(" \xB7 ")}</p>`:""}function ie(e,t){let n=String(t??"").trim().toLowerCase();return!n||String(e).toLowerCase().includes(n)}function se(){try{sessionStorage.setItem(Be,JSON.stringify(a.filters))}catch{}}function tn(){try{return JSON.parse(sessionStorage.getItem(Be))??{}}catch{return{}}}function nn(e){return j.find(t=>t.id===e)?.label??j[0].label}function H(e){return String(e).replaceAll("-"," ").replace(/\b[a-z]/g,t=>t.toUpperCase())}function b(e,t){return e.map(([n,o])=>`<option value="${c(n)}" ${String(t)===String(n)?"selected":""}>${s(o)}</option>`).join("")}function B(e,t){return`<button type="button" data-tab="${e}" class="${a.tab===e?"active":""}">${t}</button>`}function rn(e){return s(String(e).replaceAll("_"," "))}function F(e){return`<div class="empty">${s(e)}</div>`}function s(e){let t=document.createElement("span");return t.textContent=String(e),t.innerHTML}function c(e){return s(e).replaceAll('"',"&quot;")}})();
