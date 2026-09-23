// ==UserScript==
// @name         MTG Edge Lord — EDHREC Discovery
// @namespace    https://github.com/RktRobinhood/MTG-Edge-Lord
// @version      1.2.0
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
(()=>{var He="edge-v2",qe=Object.freeze({bracketFit:.4,archetypeDepth:.4,retention:.2}),Pe=Object.freeze([0,0,1,1,.6]),U=30,y=Object.freeze({zeroAt:500,peakFrom:1e3,peakTo:3e3}),w=3e3,Ue=Object.freeze([{tier:"meta",maxRank:500},{tier:"rare",maxRank:1e3},{tier:"edge",maxRank:3e3},{tier:"uncharted",maxRank:1/0}]),Ge=e=>Math.round(e*10)/10,T=e=>Math.round(e*1e3)/1e3,ue=e=>Math.max(0,Math.min(1,Number(e)||0));function S(e){return!Number.isFinite(e)||e<=0?"uncharted":Ue.find(t=>e<=t.maxRank).tier}function pe(e){return!Number.isFinite(e)||e<=y.zeroAt||e>y.peakTo?0:e>=y.peakFrom?1:T((e-y.zeroAt)/(y.peakFrom-y.zeroAt))}function Ve(e){if(!Array.isArray(e)||e.length!==5)return null;let t=e.map(o=>Math.max(0,Number(o)||0)),r=t.reduce((o,i)=>o+i,0);if(r<U)return null;let n=t.reduce((o,i,l)=>o+i*Pe[l],0);return T(n/r)}var q=2,We=5,Ke=2;function Ye(e){if(!Array.isArray(e)||e.length<4)return null;let t=e.map(g=>Math.max(0,Number(g)||0)),r=Math.max(...t);if(r<We)return null;let n=t.slice(-q),o=t.slice(-q*2,-q),i=de(n),l=de(o);return Math.max(...n)===r&&i>l*Ke?null:T(ue(i/r))}function fe(e,t=qe){let r=e.popularity?.edhrecRank,n=S(r);if(!Number.isFinite(r)||r<=0)return{unscored:!0,reason:"No EDHREC rank yet, so obscurity cannot be judged.",tier:n};if(r>w)return{unscored:!0,reason:`Past EDHREC rank ${w}, where the evidence to say this works does not exist.`,tier:n};let o={bracketFit:Ve(e.bracketCounts),archetypeDepth:e.archetypeDepth===void 0?null:ue(e.archetypeDepth),retention:Ye(e.retentionTrend)};if(o.bracketFit===null)return{unscored:!0,reason:E(e),tier:n,...e.bracketCounts?{bracketCounts:e.bracketCounts}:{}};let i=Object.entries(o).filter(([,m])=>m!==null),l=i.reduce((m,[H])=>m+t[H],0),p=T(i.reduce((m,[H,ze])=>m+ze*t[H],0)/l),g=pe(r);return{tier:n,obscurity:g,worksScore:p,edgeScore:Ge(g*p*100),quality:Object.fromEntries(i),partial:i.length<Object.keys(o).length,reasons:C(e,{obscurity:g,worksScore:p,tier:n,components:o}),modelVersion:He}}function C(e,{obscurity:t,worksScore:r,tier:n,components:o}={}){return t??=e.obscurity??pe(e.popularity?.edhrecRank),r??=e.worksScore??0,n??=e.tier??S(e.popularity?.edhrecRank),o??={bracketFit:e.quality?.bracketFit??null,archetypeDepth:e.quality?.archetypeDepth??null,retention:e.quality?.retention??null},Je(e,{obscurity:t,worksScore:r,tier:n,components:o})}function E(e){let t=e.popularity?.edhrecRank;if(!Number.isFinite(t)||t<=0)return"No EDHREC rank yet, so obscurity cannot be judged.";if(t>w)return`Past EDHREC rank ${w.toLocaleString()}, where the evidence to say this works does not exist.`;let r=P(e);return r>0?`Only ${r} bracket-tagged deck${r===1?"":"s"}, below the floor of ${U}.`:"No EDHREC page data has been collected for this commander yet."}function Je(e,{obscurity:t,worksScore:r,tier:n,components:o}){let i=[];if(t>=1?i.push(`Sits at EDHREC rank ${e.popularity.edhrecRank}, squarely in the Edge tier.`):t>0&&i.push(`Rank ${e.popularity.edhrecRank} is on the edge of the Rare tier, so obscurity counts for less.`),o.bracketFit!==null){let l=Math.round(o.bracketFit*100),p=P(e);i.push(`${l}% of its ${p.toLocaleString()} bracket-tagged decks are built at Bracket 3 or above.`)}else e.bracketCounts&&i.push(`Bracket data shown but not scored: only ${P(e)} tagged decks, below the floor of ${U}.`);return o.archetypeDepth!==null&&i.push(o.archetypeDepth>=.35?"A deep pool of high-synergy cards means there is an archetype here, not just goodstuff.":"A shallow high-synergy pool suggests the deck leans on colour-identity staples."),o.retention!==null&&i.push(o.retention>=.5?"Deck saves are holding or climbing rather than fading after release.":"Deck saves are falling away from their earlier level."),r<.3&&i.push("The evidence that this works is weak, so the Edge score stays low however obscure it is."),n==="rare"&&r>=.5&&i.push("Known enough to have a track record, obscure enough to be worth a second look."),i.slice(0,5)}function P(e){return Array.isArray(e.bracketCounts)?e.bracketCounts.reduce((t,r)=>t+(Number(r)||0),0):0}function de(e){return e.length?e.reduce((t,r)=>t+r,0)/e.length:0}var rr=Object.freeze({cohortPosition:.6,interestToTraction:.4});function A(e){let t=e?.cohort;if(!t)return[];let r=e.popularity?.deckCount??0,n=[`${Ze(t.position)} of ${t.size} new legends in ${String(t.setCode).toUpperCase()}, with ${r.toLocaleString()} deck${r===1?"":"s"} so far.`],o=e.mentionCount;return n.push(Number.isFinite(o)&&o>0?`${o} deck-tech mention${o===1?"":"s"} against ${r.toLocaleString()} build${r===1?"":"s"}.`:"No deck-tech coverage found yet, so this is cohort position alone."),n}function Ze(e){let t=e%100;return t>=11&&t<=13?`${e}th`:`${e}${["th","st","nd","rd"][e%10]??"th"}`}var Xe=/\{([^}]{1,4})\}/g,M=Object.freeze({W:"#f7f2da",U:"#b3dbf2",B:"#c0b5ad",R:"#f2a687",G:"#a4d5ae",C:"#cfd5d3"}),G="#cbcfcd";function Qe(e){let t=[];for(let[,r]of String(e??"").matchAll(Xe)){let n=et(r.toUpperCase());n&&t.push(n)}return t}function et(e){if(e.includes("/")){let t=e.split("/"),r=t.at(-1)==="P",n=(r?t.slice(0,-1):t).filter(i=>M[i]),o=n.length?n.map(i=>M[i]):[G];return r?{glyph:"\u03A6",colors:o}:{glyph:t.map(tt).join(""),colors:o}}return M[e]?{glyph:e,colors:[M[e]]}:/^\d{1,3}$/.test(e)?{glyph:e,colors:[G]}:/^[XYZS]$/.test(e)?{glyph:e,colors:[G]}:null}function tt(e){return/^[WUBRGCXYZS]$|^\d$/.test(e)?e:""}function L(e){let t=String(e??"").split("//").map(Qe).filter(o=>o.length);if(!t.length)return"";let r=t.map(o=>o.map(rt).join("")).join('<i class="pip-split">//</i>');return`<span class="mana" aria-label="Mana cost ${t.map(ot).join(" or ")}" role="img">${r}</span>`}function rt(e){return`<i class="pip-mana" style="background:${nt(e.colors)}">${e.glyph}</i>`}function nt(e){return e.length===1?e[0]:`linear-gradient(-45deg, ${e[0]} 0 50%, ${e.at(-1)} 50% 100%)`}function ot(e){return e.map(t=>t.glyph==="\u03A6"?"Phyrexian":t.glyph).join(" ")}var R=`
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
`;var k=document.createElement("div");k.id="mtg-edge-lord-insight";var K=k.attachShadow({mode:"open"});K.innerHTML=`<style>${R}</style><div id="insight"></div>`;var Y=null,he=new Set,V={source:null,bySlug:new Map};function J(e){let t=it(location.pathname);if(!t||!e?.length||he.has(t))return W();let r=at(e).get(t);if(!r)return W();Y!==t&&(K.getElementById("insight").innerHTML=ct(r),K.querySelector("#dismiss")?.addEventListener("click",()=>{he.add(t),W()}),Y=t),k.isConnected||st()}function at(e){return V.source!==e&&(V={source:e,bySlug:new Map(e.map(t=>[t.slug,t]))}),V.bySlug}function it(e){let[,t,r]=String(e).split("/");return t==="commanders"&&r?decodeURIComponent(r):null}function st(){let e=document.querySelector("main");e?.parentElement?e.parentElement.insertBefore(k,e):document.body.prepend(k)}function W(){k.remove(),Y=null}function ct(e){let t=e.popularity?.edhrecRank,r=e.popularity?.deckCount;return`<article>
    <div class="head">
      <span class="brand">MTG Edge Lord</span>
      <button id="dismiss" type="button" aria-label="Hide this">\xD7</button>
    </div>
    <div class="line">
      ${lt(e)}
      ${L(e.manaCost)}
      <span class="muted">#${t?.toLocaleString()??"\u2014"}${r?` \xB7 ${r.toLocaleString()} decks`:""}${e.price!==void 0?` \xB7 $${e.price.toFixed(2)}`:""}</span>
    </div>
    ${dt(e)}
  </article>`}function lt(e){return e.edgeScore!==void 0?`<span class="score">${e.edgeScore}</span><span class="tier ${ut(e.tier??"")}">${O(e.tier??"scored")}</span>`:e.cohortScore!==void 0?`<span class="score cohort">${e.cohortScore}<small>new</small></span>`:'<span class="score none">\u2014</span>'}function dt(e){return e.cohortScore!==void 0?`<ul class="why">${A(e).map(ge).join("")}</ul>`:e.edgeScore===void 0?`<p class="insufficient">Not scored \u2014 ${O(E(e))}</p>`:`<ul class="why">${C(e).map(ge).join("")}</ul>`}function ge(e){return`<li>${O(e)}</li>`}function O(e){let t=document.createElement("span");return t.textContent=String(e),t.innerHTML}function ut(e){return O(e).replaceAll('"',"&quot;")}var Z="columnar/1";function be(e){if(e?.format!==Z)throw new Error(`Unsupported columnar format: ${e?.format??"missing"}`);let t=Array.from({length:e.count},()=>({}));for(let[r,n]of Object.entries(e.columns)){let o=pt(n,e.count);for(let i=0;i<e.count;i+=1)o[i]!==null&&ft(t[i],r,o[i])}return t}function pt(e,t){if(e.kind==="raw")return e.values;if(e.kind==="tokens")return e.index.map(r=>r===null?null:r.map(n=>e.vocabulary[n]));if(e.kind==="dict")return e.index.map(r=>r===-1?null:me(e.keys[r]));if(e.kind==="sparse"){let r=Array.from({length:t},()=>me(e.fill));return e.index.forEach((n,o)=>{r[n]=e.values[o]}),r}throw new Error(`Unsupported column kind: ${e.kind}`)}function me(e){return typeof e=="object"&&e!==null?structuredClone(e):e}function ft(e,t,r){let n=t.split("."),o=e;for(let i of n.slice(0,-1))ht(o[i])||(o[i]={}),o=o[i];o[n.at(-1)]=r}function ht(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}var hr=Object.freeze({trendZscore:3,momentum:1,diamondScore:1,edgeScore:1,cohortScore:1,"quality.bracketFit":3,"quality.archetypeDepth":3,"quality.retention":3,price:2});function xe(e){let t=e?.commanders;return Array.isArray(t)?t:t?.format===Z?be(t):[]}var gt="mtg-edge-lord",f="datasets";var N=null;function X(){return N||(N=new Promise(e=>{if(!globalThis.indexedDB)return e(null);let t;try{t=indexedDB.open(gt,1)}catch{return e(null)}t.onupgradeneeded=()=>{t.result.objectStoreNames.contains(f)||t.result.createObjectStore(f)},t.onsuccess=()=>e(t.result),t.onerror=()=>e(null),t.onblocked=()=>e(null)}),N)}async function Q(e){let t=await X();return t?new Promise(r=>{try{let n=t.transaction(f,"readonly").objectStore(f).get(e);n.onsuccess=()=>r(n.result??null),n.onerror=()=>r(null)}catch{r(null)}}):null}async function ee(e,t){let r=await X();return r?new Promise(n=>{try{let o=r.transaction(f,"readwrite");o.objectStore(f).put(t,e),o.oncomplete=()=>n(!0),o.onerror=()=>n(!1),o.onabort=()=>n(!1)}catch{n(!1)}}):!1}async function ye(e){let t=await X();if(t)try{t.transaction(f,"readwrite").objectStore(f).delete(e)}catch{}}var $e="https://rktrobinhood.github.io/MTG-Edge-Lord/data",we="https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/data",ke="datasets:v2",te="commander-detail:v2",mt="mtg-edge-lord:data:v1";async function Se({force:e=!1}={}){xt();let t=await Q(ke);try{let r;try{r=await ve($e,t,e)}catch{r=await ve(we,t,e)}if(r.cached)return{...t,stale:!1};let n={manifest:r.manifest,...r.datasets,cachedAt:new Date().toISOString()};return await ee(ke,n),t?.manifest?.dataVersion!==r.manifest.dataVersion&&await ye(te),{...n,stale:!1}}catch(r){if(t)return{...t,stale:!0,error:r.message};throw r}}async function Ce(e){let t=await Q(te);if(t?.dataVersion===e)return t.detail;for(let r of[$e,we])try{let{detail:n}=await h(`${r}/commander-detail.json`);return await ee(te,{dataVersion:e,detail:n}),n}catch{}return t?.detail??{}}async function ve(e,t,r){let n=await h(`${e}/manifest.json?ts=${Date.now()}`);if(!r&&t?.manifest?.dataVersion===n.dataVersion)return{cached:!0};let[o,i,l,p,g,m]=await Promise.all([h(`${e}/findings.json`),h(`${e}/commanders.json`).then(bt),h(`${e}/hidden-cards.json`),h(`${e}/community-resources.json`),h(`${e}/relationships/card-commander.json`),h(`${e}/archive.json`).catch(()=>({schemaVersion:1,archive:[]}))]);return{manifest:n,datasets:{findings:o,commanders:i,cards:l,resources:p,relationships:g,archive:m}}}function bt(e){return{schemaVersion:e?.schemaVersion??1,commanders:xe(e)}}function xt(){try{localStorage.removeItem(mt)}catch{}}function h(e){let t=globalThis.GM?.xmlHttpRequest??globalThis.GM_xmlhttpRequest;return t?new Promise((r,n)=>t({method:"GET",url:e,headers:{Accept:"application/json"},onload:o=>{if(o.status<200||o.status>=300)return n(new Error(`HTTP ${o.status}`));try{r(JSON.parse(o.responseText))}catch{n(new Error("Backend returned invalid JSON."))}},onerror:()=>n(new Error("Could not reach the MTG Edge Lord data backend."))})):fetch(e).then(yt).then(r=>r.json())}function yt(e){if(!e.ok)throw new Error(`HTTP ${e.status}`);return e}function Ee(e,t=220){let r=String(e??"").trim();if(r.length<=t)return r;let n=r.slice(0,t),o=n.lastIndexOf(" ");return`${(o>t*.6?n.slice(0,o):n).replace(/[\s,;:.]+$/,"")}\u2026`}function kt(e){let t=e?.source?.url;return typeof t=="string"&&/^https:\/\//.test(t)}function Re(e){return(e??[]).filter(kt)}function re(e){let t=String(e?.creator??"").trim(),r=String(e?.name??"").trim();return t&&r&&t.toLowerCase()!==r.toLowerCase()?`${t} \xB7 ${r}`:t||r||"Source"}var vt=["W","U","B","R","G"],I=Object.freeze([{id:"edge",label:"Edge score"},{id:"momentum",label:"Momentum"},{id:"worksScore",label:"How well it works"},{id:"price",label:"Cheapest first"},{id:"released",label:"Most recent"},{id:"name",label:"Alphabetical"},{id:"rank",label:"EDHREC rank"},{id:"deckCount",label:"Deck count (popularity)"}]),Me="edge",Le=Object.freeze([{id:"includes",label:"Includes"},{id:"exact",label:"Exactly"},{id:"atMost",label:"At most"}]),oe=Object.freeze({query:"",colors:[],colorMode:"includes",theme:"",functionalTag:"",creatureType:"",tier:"",minBracketFit:"",minRank:"",maxRank:"",minManaValue:"",maxManaValue:"",maxPrice:"",releasedAfter:"",scoredOnly:!1,sort:Me});function $t(e){return e.map(t=>{if(t.cohortScore!==void 0)return{...t,tier:S(t.popularity?.edhrecRank)};if(t.edgeScore===void 0)return{...t,tier:S(t.popularity?.edhrecRank)};let r=fe(t);if(r.unscored){let n={...t,tier:r.tier};return delete n.edgeScore,n}return{...t,tier:r.tier,obscurity:r.obscurity,worksScore:r.worksScore,edgeScore:r.edgeScore,quality:r.quality}})}function Oe(e){let t=$t(e),r=t.map(n=>[n.name,...n.themes??[],...n.functionalTags??[],...n.creatureTypes??[],...n.types??[]].join(" ").toLowerCase());return{commanders:t,haystacks:r,themes:ne(t,"themes"),functionalTags:ne(t,"functionalTags"),creatureTypes:ne(t,"creatureTypes")}}function ne(e,t){let r=new Map;for(let n of e)for(let o of n[t]??[])r.set(o,(r.get(o)??0)+1);return[...r.entries()].sort((n,o)=>o[1]-n[1]||n[0].localeCompare(o[0])).map(([n])=>n)}function Ne(e,t){let r=String(t.query??"").toLowerCase().split(/\s+/).filter(Boolean),n=[];for(let o=0;o<e.commanders.length;o+=1){if(r.length&&!r.every(l=>e.haystacks[o].includes(l)))continue;let i=e.commanders[o];wt(i,t)&&n.push(i)}return n}function wt(e,t){let r=e.popularity?.edhrecRank;return!(!St(e.colorIdentity,t.colors,t.colorMode)||t.theme&&!(e.themes??[]).includes(t.theme)||t.functionalTag&&!(e.functionalTags??[]).includes(t.functionalTag)||t.creatureType&&!(e.creatureTypes??[]).includes(t.creatureType)||t.tier&&e.tier!==t.tier||t.scoredOnly&&e.edgeScore===void 0||t.minBracketFit!==""&&!(e.quality?.bracketFit>=Number(t.minBracketFit))||!Te(r,t.minRank,t.maxRank)||!Te(e.manaValue,t.minManaValue,t.maxManaValue)||t.maxPrice!==""&&e.price!==void 0&&e.price>Number(t.maxPrice)||t.releasedAfter&&(e.releasedAt??"")<t.releasedAfter)}function Te(e,t,r){return t===""&&r===""?!0:!(!Number.isFinite(e)||t!==""&&e<Number(t)||r!==""&&e>Number(r))}function St(e,t,r){if(!t?.length)return!0;if(e===void 0)return!1;let n=vt.filter(o=>t.includes(o));return r==="exact"?e===n.join(""):r==="atMost"?[...e].every(o=>n.includes(o)):n.every(o=>e.includes(o))}function je(e,t){let r=Ae[t]??Ae[Me];return[...e].sort(r)}var j=e=>(t,r)=>{let n=e(t),o=e(r);return n===void 0&&o===void 0?v(t,r):n===void 0?1:o===void 0?-1:o-n||v(t,r)},Ct=e=>(t,r)=>{let n=e(t),o=e(r);return n===void 0&&o===void 0?v(t,r):n===void 0?1:o===void 0?-1:n-o||v(t,r)};function v(e,t){return(e.popularity?.edhrecRank??1/0)-(t.popularity?.edhrecRank??1/0)}var Ae={edge:j(e=>e.edgeScore),momentum:j(e=>e.momentum),worksScore:j(e=>e.worksScore),price:Ct(e=>e.price),released:(e,t)=>String(t.releasedAt??"").localeCompare(String(e.releasedAt??""))||v(e,t),name:(e,t)=>e.name.localeCompare(t.name),rank:v,deckCount:j(e=>e.popularity?.deckCount)};var x=60,Et=140,De="mtg-edge-lord:filters",Rt=[{id:"W",label:"W"},{id:"U",label:"U"},{id:"B",label:"B"},{id:"R",label:"R"},{id:"G",label:"G"}],Tt=[{id:"",label:"Any tier"},{id:"edge",label:"Edge (1,000\u20133,000)"},{id:"rare",label:"Rare (500\u20131,000)"},{id:"meta",label:"Meta (top 500)"},{id:"uncharted",label:"Uncharted (3,000+)"}],a={tab:"search",filters:{...oe,...Zt()},shown:x,expanded:null,detail:null,index:null,data:null,loading:!0,error:null},Ie=null,ce=document.createElement("div");ce.id="mtg-edge-lord-root";var u=ce.attachShadow({mode:"open"}),d=document.createElement("div");d.id="mtg-edge-lord-button";var se=d.attachShadow({mode:"open"});document.body.append(ce);At();_e();Lt();Nt();function At(){se.innerHTML=`<style>${R}</style>
    <button id="toggle" type="button" aria-expanded="false" aria-label="MTG Edge Lord advanced search">Advanced</button>`,u.innerHTML=`<style>${R}</style>
    <section id="panel" aria-label="MTG Edge Lord" hidden>
      <header>
        <div><strong>MTG Edge Lord</strong><span id="status">Loading\u2026</span></div>
        <a href="https://github.com/RktRobinhood/MTG-Edge-Lord" target="_blank" rel="noopener noreferrer">About</a>
      </header>
      <nav>${_("search","Search")}${_("discover","Recent finds")}${_("card","Card-first")}${_("archive","Archive")}</nav>
      <main></main>
    </section>`,se.getElementById("toggle").addEventListener("click",Ot),u.querySelector("nav").addEventListener("click",e=>{let t=e.target.closest("button[data-tab]");t&&(a.tab=t.dataset.tab,a.shown=x,le())})}function Mt(){for(let e of document.querySelectorAll('header nav input[aria-label="Search"], header nav input.rbt-input-main')){let t=e.closest('[class*="Navbar_search"], .input-group');if(t?.getBoundingClientRect().width)return t}return null}function _e(){let e=Mt();if(e){d.classList.remove("floating"),d.previousElementSibling!==e&&e.after(d);return}d.classList.add("floating"),d.parentElement!==document.body&&document.body.append(d)}function Lt(){let e=null,t=()=>{clearTimeout(e),e=setTimeout(()=>{_e(),J(a.index?.commanders),u.getElementById("panel").hidden||Fe()},100)};new MutationObserver(t).observe(document.body,{childList:!0,subtree:!0}),addEventListener("resize",t)}function Ot(){let e=u.getElementById("panel"),t=e.hidden;t&&Fe(),e.hidden=!t;let r=se.getElementById("toggle");r.setAttribute("aria-expanded",String(t)),r.classList.toggle("on",t)}function Fe(){let e=u.getElementById("panel"),t=d.getBoundingClientRect(),r=!d.classList.contains("floating");e.style.setProperty("--mel-top",`${r?Math.round(t.bottom)+8:14}px`),e.style.setProperty("--mel-right",`${r?Math.max(8,Math.round(innerWidth-t.right)):14}px`)}async function Nt(){try{a.data=await Se(),a.index=Oe(a.data.commanders.commanders)}catch(e){a.error=e.message}finally{a.loading=!1,le(),J(a.index?.commanders)}}function le(){u.querySelectorAll("nav button").forEach(t=>t.classList.toggle("active",t.dataset.tab===a.tab)),u.getElementById("status").textContent=jt();let e=u.querySelector("main");if(a.loading)return void(e.innerHTML='<div class="empty">Loading\u2026</div>');if(a.error)return void(e.innerHTML=`<div class="empty">${s(a.error)}</div>`);e.innerHTML=`
    ${a.data.stale?'<div class="notice">Live data could not be reached. Showing the last cached version.</div>':""}
    ${a.tab==="search"?_t():Ft()}
    <div class="summary" id="result-summary"></div>
    <div class="stack" id="results"></div>`,It(e),$()}function jt(){return a.data?`${(a.index?.commanders.length??0).toLocaleString()} commanders \xB7 ${a.data.manifest.dataVersion}${a.data.stale?" \xB7 cached":""}`:"Discovery data unavailable"}function It(e){e.querySelectorAll("[data-field]").forEach(t=>{let r=t.tagName==="SELECT"||t.type==="checkbox"?"change":"input";t.addEventListener(r,()=>{let n=t.type==="checkbox"?t.checked:t.value;a.filters[t.dataset.field]=n,a.shown=x,ie(),r==="input"?Dt():$()})}),e.querySelectorAll("[data-color]").forEach(t=>t.addEventListener("click",()=>{let r=t.dataset.color,n=a.filters.colors.includes(r)?a.filters.colors.filter(o=>o!==r):[...a.filters.colors,r];a.filters.colors=n,t.classList.toggle("on",n.includes(r)),a.shown=x,ie(),$()})),e.addEventListener("click",t=>{if(t.target.closest("a, button, input, select, label"))return;let r=t.target.closest("[data-open]");r&&open(r.dataset.open,"_blank","noopener")}),e.querySelector("#reset")?.addEventListener("click",()=>{a.filters={...oe},a.shown=x,ie(),le()})}function Dt(){clearTimeout(Ie),Ie=setTimeout($,Et)}function $(){let e=u.getElementById("results"),t=u.getElementById("result-summary");if(!e)return;if(a.tab==="discover"){let o=Re(a.data.findings.findings).filter(i=>ae(`${i.title} ${i.summary}`,a.filters.query)).sort((i,l)=>l.score.total-i.score.total);return t.textContent=`${o.length} find${o.length===1?"":"s"}`,e.innerHTML=o.slice(0,a.shown).map(Kt).join("")||F("No finds match that search yet."),D(e)}if(a.tab==="archive"){let o=(a.data.archive?.archive??[]).filter(i=>ae(i.name,a.filters.query));return t.textContent=o.length?`${o.length} commander${o.length===1?"":"s"} surfaced to date`:"Nothing surfaced yet",e.innerHTML=o.slice(0,a.shown).map(Yt).join("")||F("No commander has been surfaced under that name yet."),D(e)}if(a.tab==="card"){let o=a.data.cards.cards.filter(i=>ae(i.name,a.filters.query));return t.textContent=`${o.length} card${o.length===1?"":"s"}`,e.innerHTML=o.slice(0,a.shown).map(Jt).join("")||F("No cards match that search yet."),D(e)}let r=je(Ne(a.index,a.filters),a.filters.sort),n=r.filter(o=>o.edgeScore!==void 0).length;t.innerHTML=`<strong>${r.length.toLocaleString()}</strong> commanders \xB7 ${n.toLocaleString()} scored \xB7 sorted by ${s(Xt(a.filters.sort))}`,e.innerHTML=r.slice(0,a.shown).map(Bt).join("")||F("Nothing matches those filters. Widen the rank band or clear a colour."),r.length>a.shown&&e.insertAdjacentHTML("beforeend",`<button class="more" id="more" type="button">Show ${Math.min(x,r.length-a.shown)} more of ${(r.length-a.shown).toLocaleString()}</button>`),D(e)}function D(e){e.querySelector("#more")?.addEventListener("click",()=>{a.shown+=x,$()}),e.querySelectorAll("[data-expand]").forEach(t=>t.addEventListener("click",async()=>{let r=t.dataset.expand;a.expanded=a.expanded===r?null:r,a.expanded&&!a.detail&&(a.detail=await Ce(a.data.manifest.dataVersion)),$()}))}function _t(){let e=a.filters;return`<div class="controls">
    <input class="query" data-field="query" value="${c(e.query)}" placeholder="Name, theme, mechanic, creature type" aria-label="Search">
    <div class="row colors">
      <span class="label">Colour identity</span>
      ${Rt.map(t=>`<button type="button" class="pip ${e.colors.includes(t.id)?"on":""}" data-color="${t.id}" aria-label="${t.label}">${t.label}</button>`).join("")}
      <select data-field="colorMode" aria-label="Colour matching">${b(Le.map(t=>[t.id,t.label]),e.colorMode)}</select>
    </div>
    <div class="row">
      <span class="label">Rank band</span>
      <input type="number" min="1" data-field="minRank" value="${c(e.minRank)}" placeholder="1000">
      <span class="to">to</span>
      <input type="number" min="1" data-field="maxRank" value="${c(e.maxRank)}" placeholder="3000">
      <select data-field="tier" aria-label="Tier">${b(Tt.map(t=>[t.id,t.label]),e.tier)}</select>
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
      <select data-field="theme" aria-label="Theme">${b([["","Any theme"],...a.index.themes.map(t=>[t,z(t)])],e.theme)}</select>
      <select data-field="functionalTag" aria-label="Mechanic">${b([["","Any mechanic"],...a.index.functionalTags.map(t=>[t,z(t)])],e.functionalTag)}</select>
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
      <select data-field="sort" aria-label="Sort">${b(I.map(t=>[t.id,t.label]),e.sort)}</select>
      <button type="button" id="reset" class="reset">Reset</button>
    </div>
  </div>`}function Ft(){return`<div class="controls"><input class="query" data-field="query" value="${c(a.filters.query)}" placeholder="Search" aria-label="Search"></div>`}function Bt(e){let t=a.expanded===e.slug,r=B(e.slug),n=(e.themes??[]).slice(0,3);return`<article class="card commander" data-open="${c(r)}">
    <div class="head">
      <h3><a href="${c(r)}" target="_blank" rel="noopener noreferrer">${s(e.name)}</a></h3>
      ${zt(e)}
    </div>
    <div class="line">
      ${Pt(e)}
      ${e.tier?`<span class="tier ${c(e.tier)}">${s(e.tier)}</span>`:""}
      <span class="muted">${s(Ht(e))}</span>
    </div>
    ${Be(e.findingIds)}
    <div class="foot">
      <div class="chips">${n.map(o=>`<span class="chip">${s(z(o))}</span>`).join("")}</div>
      <button type="button" class="why-toggle${t?" on":""}" data-expand="${c(e.slug)}" aria-expanded="${t}" aria-label="Why it works" title="Why it works">?</button>
    </div>
    ${t?qt(e):""}
  </article>`}function B(e){return`https://edhrec.com/commanders/${encodeURIComponent(e)}`}function zt(e){let t=L(e.manaCost);return t||(e.colorIdentity===void 0?"":`<span class="chip">${s(e.colorIdentity||"Colourless")}</span>`)}function Ht(e){let t=e.popularity?.edhrecRank,r=e.popularity?.deckCount;return[t?`#${t.toLocaleString()}`:null,r?`${r.toLocaleString()} decks`:null,e.price!==void 0?`$${e.price.toFixed(2)}`:null].filter(Boolean).join(" \xB7 ")}function qt(e){return`<div class="detail">
    ${Ut(e)}
    ${Gt(e)}
    ${Vt(e)}
  </div>`}function Pt(e){return e.edgeScore!==void 0?`<span class="score">${e.edgeScore}</span>`:e.cohortScore!==void 0?`<span class="score cohort" title="Scored against its set cohort, not the whole format">${e.cohortScore}<small>new</small></span>`:'<span class="score none" title="Not enough evidence to score">\u2014</span>'}function Ut(e){return e.cohortScore!==void 0?`<p class="cohort-note">New arrival \u2014 scored against its ${s(String(e.cohort?.setCode??"").toUpperCase())} set cohort, not the whole format.</p>
      <ul class="why">${A(e).map(t=>`<li>${s(t)}</li>`).join("")}</ul>`:e.edgeScore===void 0?`<p class="insufficient">Insufficient data \u2014 ${s(E(e))}</p>`:`<ul class="why">${C(e).map(t=>`<li>${s(t)}</li>`).join("")}</ul>`}function Gt(e){let t=e.quality;if(!t)return"";let r=[["Bracket fit",t.bracketFit],["Archetype depth",t.archetypeDepth],["Retention",t.retention]].filter(([,n])=>n!==void 0);return r.length?`<div class="chips">${r.map(([n,o])=>`<span class="chip quality">${n} ${Math.round(o*100)}%</span>`).join("")}${e.partialScore?'<span class="chip muted">partial</span>':""}</div>`:""}function Vt(e){let t=a.detail?.[e.slug];return t?`<div class="more-detail">
    ${t.highSynergyCards?.length?`<p class="label">Cards that want to be here</p><div class="chips">${t.highSynergyCards.map(r=>`<a class="chip" href="https://edhrec.com/cards/${encodeURIComponent(r)}" target="_blank" rel="noopener noreferrer">${s(z(r))}</a>`).join("")}</div>`:""}
    ${t.similar?.length?`<p class="label">Plays like</p><div class="chips">${t.similar.map(r=>`<span class="chip">${s(r)}</span>`).join("")}</div>`:""}
    ${e.comboCount&&e.comboUrl?`<p class="muted"><a href="${c(e.comboUrl)}" target="_blank" rel="noopener noreferrer">${e.comboCount} known combo line${e.comboCount===1?"":"s"} on Commander Spellbook \u2197</a> \u2014 shown, never scored.</p>`:""}
    ${Wt(e)}
    ${e.dedicatedCommunity?`<p class="muted"><a href="${c(e.dedicatedCommunity.url)}" target="_blank" rel="noopener noreferrer">Has a dedicated community \u2197</a> \u2014 via ${s(e.dedicatedCommunity.source)}.</p>`:""}
  </div>`:""}function Wt(e){let t=e.cedhListing;if(!t?.sourceUrl)return"";let r={brew:"In the Brewer's Corner",competitive:"Listed as an established competitive deck",outdated:"Listed, but its entry is marked outdated"}[t.section];if(!r)return"";let n=t.updatedAt?` \xB7 entry updated ${s(t.updatedAt.slice(0,10))}`:"";return`<p class="muted"><a href="${c(t.sourceUrl)}" target="_blank" rel="noopener noreferrer">${r} on the cEDH Decklist Database \u2197</a>${n} \u2014 shown, never scored.</p>`}function Kt(e){let t=[...e.commanders,...e.cards].map(r=>`<span class="chip">${s(r.name)}</span>`).join("");return`<a class="card digest" href="${c(e.source.url)}" target="_blank" rel="noopener noreferrer">
    <div class="credit">
      <span class="source">${s(re(e.source))}</span>
      <span class="muted">${s(e.publishedAt)}${e.observedAt?` \xB7 found ${s(e.observedAt.slice(0,10))}`:""}</span>
    </div>
    <h3>${s(e.title)}</h3>
    <p class="clamp">${s(Ee(e.summary))}</p>
    <div class="chips">${t}</div>
    <span class="readon">Read it at ${s(re(e.source))} \u2197</span>
  </a>`}function Yt(e){let t=e.popularityAtFirstSurface?.edhrecRank,r=(e.sources??[]).filter(o=>typeof o.url=="string"&&o.url.startsWith("https://")).map(o=>`<a class="chip" href="${c(o.url)}" target="_blank" rel="noopener noreferrer">${s(o.creator||o.name)} \u2197</a>`).join(""),n=e.timesSurfaced>1?` \xB7 surfaced ${e.timesSurfaced} times`:"";return`<article class="card" data-open="${c(B(e.slug))}">
    <div class="credit">
      <span class="muted">First surfaced ${s(e.firstSurfacedAt)}${n}</span>
    </div>
    <h3><a href="${c(B(e.slug))}" target="_blank" rel="noopener noreferrer">${s(e.name)}</a></h3>
    ${t?`<p class="muted">Rank ${t.toLocaleString()} when found${e.popularityAtFirstSurface.deckCount?` \xB7 ${e.popularityAtFirstSurface.deckCount.toLocaleString()} decks`:""}</p>`:""}
    <div class="chips">${r}</div>
  </article>`}function Jt(e){let t=e.commanders.map(r=>`<a class="chip" href="${c(B(r.slug))}" target="_blank" rel="noopener noreferrer">${s(r.name)} \xB7 ${r.relationshipScore}</a>`).join("");return`<article class="card"><h3>${s(e.name)}</h3><div class="chips">${t}</div>${Be(e.findingIds)}</article>`}function Be(e=[]){let t=new Set(e),r=(a.data.resources.resources??[]).filter(n=>t.has(n.findingId)&&typeof n.url=="string"&&n.url.startsWith("https://")).slice(0,3);return r.length?`<p class="sources">${r.map(n=>`<a href="${c(n.url)}" target="_blank" rel="noopener noreferrer">${s(n.creator)} \xB7 ${Qt(n.resourceDepth)} \u2197</a>`).join(" \xB7 ")}</p>`:""}function ae(e,t){let r=String(t??"").trim().toLowerCase();return!r||String(e).toLowerCase().includes(r)}function ie(){try{sessionStorage.setItem(De,JSON.stringify(a.filters))}catch{}}function Zt(){try{return JSON.parse(sessionStorage.getItem(De))??{}}catch{return{}}}function Xt(e){return I.find(t=>t.id===e)?.label??I[0].label}function z(e){return String(e).replaceAll("-"," ").replace(/\b[a-z]/g,t=>t.toUpperCase())}function b(e,t){return e.map(([r,n])=>`<option value="${c(r)}" ${String(t)===String(r)?"selected":""}>${s(n)}</option>`).join("")}function _(e,t){return`<button type="button" data-tab="${e}" class="${a.tab===e?"active":""}">${t}</button>`}function Qt(e){return s(String(e).replaceAll("_"," "))}function F(e){return`<div class="empty">${s(e)}</div>`}function s(e){let t=document.createElement("span");return t.textContent=String(e),t.innerHTML}function c(e){return s(e).replaceAll('"',"&quot;")}})();
