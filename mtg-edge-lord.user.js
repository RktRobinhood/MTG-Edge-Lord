// ==UserScript==
// @name         MTG Edge Lord — EDHREC Discovery
// @namespace    https://github.com/RktRobinhood/MTG-Edge-Lord
// @version      1.0.0
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
(()=>{var Se="edge-v1",ve=Object.freeze({bracketFit:.4,archetypeDepth:.4,retention:.2}),Ce=Object.freeze([0,0,1,1,.6]),A=30,g=Object.freeze({zeroAt:500,peakFrom:1e3,peakTo:3e3}),$=3e3,Ee=Object.freeze([{tier:"meta",maxRank:500},{tier:"rare",maxRank:1e3},{tier:"edge",maxRank:3e3},{tier:"uncharted",maxRank:1/0}]),Re=e=>Math.round(e*10)/10,w=e=>Math.round(e*1e3)/1e3,K=e=>Math.max(0,Math.min(1,Number(e)||0));function W(e){return!Number.isFinite(e)||e<=0?"uncharted":Ee.find(t=>e<=t.maxRank).tier}function Y(e){return!Number.isFinite(e)||e<=g.zeroAt||e>g.peakTo?0:e>=g.peakFrom?1:w((e-g.zeroAt)/(g.peakFrom-g.zeroAt))}function Te(e){if(!Array.isArray(e)||e.length!==5)return null;let t=e.map(o=>Math.max(0,Number(o)||0)),r=t.reduce((o,s)=>o+s,0);if(r<A)return null;let n=t.reduce((o,s,l)=>o+s*Ce[l],0);return w(n/r)}function Ae(e){if(!Array.isArray(e)||e.length<4)return null;let t=e.map(s=>Math.max(0,Number(s)||0)),r=Math.floor(t.length/2),n=G(t.slice(0,r)),o=G(t.slice(r));return n<=0?o>0?1:null:w(K(o/n/2))}function J(e,t=ve){let r=e.popularity?.edhrecRank,n=W(r);if(!Number.isFinite(r)||r<=0)return{unscored:!0,reason:"No EDHREC rank yet, so obscurity cannot be judged.",tier:n};if(r>$)return{unscored:!0,reason:`Past EDHREC rank ${$}, where the evidence to say this works does not exist.`,tier:n};let o={bracketFit:Te(e.bracketCounts),archetypeDepth:e.archetypeDepth===void 0?null:K(e.archetypeDepth),retention:Ae(e.retentionTrend)};if(o.bracketFit===null)return{unscored:!0,reason:O(e),tier:n,...e.bracketCounts?{bracketCounts:e.bracketCounts}:{}};let s=Object.entries(o).filter(([,k])=>k!==null),l=s.reduce((k,[R])=>k+t[R],0),p=w(s.reduce((k,[R,we])=>k+we*t[R],0)/l),x=Y(r);return{tier:n,obscurity:x,worksScore:p,edgeScore:Re(x*p*100),quality:Object.fromEntries(s),partial:s.length<Object.keys(o).length,reasons:M(e,{obscurity:x,worksScore:p,tier:n,components:o}),modelVersion:Se}}function M(e,{obscurity:t,worksScore:r,tier:n,components:o}={}){return t??=e.obscurity??Y(e.popularity?.edhrecRank),r??=e.worksScore??0,n??=e.tier??W(e.popularity?.edhrecRank),o??={bracketFit:e.quality?.bracketFit??null,archetypeDepth:e.quality?.archetypeDepth??null,retention:e.quality?.retention??null},Me(e,{obscurity:t,worksScore:r,tier:n,components:o})}function O(e){let t=e.popularity?.edhrecRank;if(!Number.isFinite(t)||t<=0)return"No EDHREC rank yet, so obscurity cannot be judged.";if(t>$)return`Past EDHREC rank ${$.toLocaleString()}, where the evidence to say this works does not exist.`;let r=T(e);return r>0?`Only ${r} bracket-tagged deck${r===1?"":"s"}, below the floor of ${A}.`:"No EDHREC page data has been collected for this commander yet."}function Me(e,{obscurity:t,worksScore:r,tier:n,components:o}){let s=[];if(t>=1?s.push(`Sits at EDHREC rank ${e.popularity.edhrecRank}, squarely in the Edge tier.`):t>0&&s.push(`Rank ${e.popularity.edhrecRank} is on the edge of the Rare tier, so obscurity counts for less.`),o.bracketFit!==null){let l=Math.round(o.bracketFit*100),p=T(e);s.push(`${l}% of its ${p.toLocaleString()} bracket-tagged decks are built at Bracket 3 or above.`)}else e.bracketCounts&&s.push(`Bracket data shown but not scored: only ${T(e)} tagged decks, below the floor of ${A}.`);return o.archetypeDepth!==null&&s.push(o.archetypeDepth>=.35?"A deep pool of high-synergy cards means there is an archetype here, not just goodstuff.":"A shallow high-synergy pool suggests the deck leans on colour-identity staples."),o.retention!==null&&s.push(o.retention>=.5?"Deck saves are holding or climbing rather than fading after release.":"Deck saves are falling away from their earlier level."),r<.3&&s.push("The evidence that this works is weak, so the Edge score stays low however obscure it is."),n==="rare"&&r>=.5&&s.push("Known enough to have a track record, obscure enough to be worth a second look."),s.slice(0,5)}function T(e){return Array.isArray(e.bracketCounts)?e.bracketCounts.reduce((t,r)=>t+(Number(r)||0),0):0}function G(e){return e.length?e.reduce((t,r)=>t+r,0)/e.length:0}var ht=Object.freeze({cohortPosition:.6,interestToTraction:.4});function Z(e){let t=e?.cohort;if(!t)return[];let r=e.popularity?.deckCount??0,n=[`${Oe(t.position)} of ${t.size} new legends in ${String(t.setCode).toUpperCase()}, with ${r.toLocaleString()} deck${r===1?"":"s"} so far.`],o=e.mentionCount;return n.push(Number.isFinite(o)&&o>0?`${o} deck-tech mention${o===1?"":"s"} against ${r.toLocaleString()} build${r===1?"":"s"}.`:"No deck-tech coverage found yet, so this is cohort position alone."),n}function Oe(e){let t=e%100;return t>=11&&t<=13?`${e}th`:`${e}${["th","st","nd","rd"][e%10]??"th"}`}var L="columnar/1";function Q(e){if(e?.format!==L)throw new Error(`Unsupported columnar format: ${e?.format??"missing"}`);let t=Array.from({length:e.count},()=>({}));for(let[r,n]of Object.entries(e.columns)){let o=Le(n,e.count);for(let s=0;s<e.count;s+=1)o[s]!==null&&Ne(t[s],r,o[s])}return t}function Le(e,t){if(e.kind==="raw")return e.values;if(e.kind==="tokens")return e.index.map(r=>r===null?null:r.map(n=>e.vocabulary[n]));if(e.kind==="dict")return e.index.map(r=>r===-1?null:X(e.keys[r]));if(e.kind==="sparse"){let r=Array.from({length:t},()=>X(e.fill));return e.index.forEach((n,o)=>{r[n]=e.values[o]}),r}throw new Error(`Unsupported column kind: ${e.kind}`)}function X(e){return typeof e=="object"&&e!==null?structuredClone(e):e}function Ne(e,t,r){let n=t.split("."),o=e;for(let s of n.slice(0,-1))De(o[s])||(o[s]={}),o=o[s];o[n.at(-1)]=r}function De(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}var xt=Object.freeze({trendZscore:3,momentum:1,diamondScore:1,edgeScore:1,cohortScore:1,"quality.bracketFit":3,"quality.archetypeDepth":3,"quality.retention":3,price:2});function ee(e){let t=e?.commanders;return Array.isArray(t)?t:t?.format===L?Q(t):[]}var Ie="mtg-edge-lord",u="datasets";var S=null;function N(){return S||(S=new Promise(e=>{if(!globalThis.indexedDB)return e(null);let t;try{t=indexedDB.open(Ie,1)}catch{return e(null)}t.onupgradeneeded=()=>{t.result.objectStoreNames.contains(u)||t.result.createObjectStore(u)},t.onsuccess=()=>e(t.result),t.onerror=()=>e(null),t.onblocked=()=>e(null)}),S)}async function D(e){let t=await N();return t?new Promise(r=>{try{let n=t.transaction(u,"readonly").objectStore(u).get(e);n.onsuccess=()=>r(n.result??null),n.onerror=()=>r(null)}catch{r(null)}}):null}async function I(e,t){let r=await N();return r?new Promise(n=>{try{let o=r.transaction(u,"readwrite");o.objectStore(u).put(t,e),o.oncomplete=()=>n(!0),o.onerror=()=>n(!1),o.onabort=()=>n(!1)}catch{n(!1)}}):!1}async function te(e){let t=await N();if(t)try{t.transaction(u,"readwrite").objectStore(u).delete(e)}catch{}}var oe="https://rktrobinhood.github.io/MTG-Edge-Lord/data",ae="https://raw.githubusercontent.com/RktRobinhood/MTG-Edge-Lord/main/data",re="datasets:v2",j="commander-detail:v2",je="mtg-edge-lord:data:v1";async function se({force:e=!1}={}){Fe();let t=await D(re);try{let r;try{r=await ne(oe,t,e)}catch{r=await ne(ae,t,e)}if(r.cached)return{...t,stale:!1};let n={manifest:r.manifest,...r.datasets,cachedAt:new Date().toISOString()};return await I(re,n),t?.manifest?.dataVersion!==r.manifest.dataVersion&&await te(j),{...n,stale:!1}}catch(r){if(t)return{...t,stale:!0,error:r.message};throw r}}async function ie(e){let t=await D(j);if(t?.dataVersion===e)return t.detail;for(let r of[oe,ae])try{let{detail:n}=await f(`${r}/commander-detail.json`);return await I(j,{dataVersion:e,detail:n}),n}catch{}return t?.detail??{}}async function ne(e,t,r){let n=await f(`${e}/manifest.json?ts=${Date.now()}`);if(!r&&t?.manifest?.dataVersion===n.dataVersion)return{cached:!0};let[o,s,l,p,x]=await Promise.all([f(`${e}/findings.json`),f(`${e}/commanders.json`).then(_e),f(`${e}/hidden-cards.json`),f(`${e}/community-resources.json`),f(`${e}/relationships/card-commander.json`)]);return{manifest:n,datasets:{findings:o,commanders:s,cards:l,resources:p,relationships:x}}}function _e(e){return{schemaVersion:e?.schemaVersion??1,commanders:ee(e)}}function Fe(){try{localStorage.removeItem(je)}catch{}}function f(e){let t=globalThis.GM?.xmlHttpRequest??globalThis.GM_xmlhttpRequest;return t?new Promise((r,n)=>t({method:"GET",url:e,headers:{Accept:"application/json"},onload:o=>{if(o.status<200||o.status>=300)return n(new Error(`HTTP ${o.status}`));try{r(JSON.parse(o.responseText))}catch{n(new Error("Backend returned invalid JSON."))}},onerror:()=>n(new Error("Could not reach the MTG Edge Lord data backend."))})):fetch(e).then(ze).then(r=>r.json())}function ze(e){if(!e.ok)throw new Error(`HTTP ${e.status}`);return e}function ce(e,t=220){let r=String(e??"").trim();if(r.length<=t)return r;let n=r.slice(0,t),o=n.lastIndexOf(" ");return`${(o>t*.6?n.slice(0,o):n).replace(/[\s,;:.]+$/,"")}\u2026`}function qe(e){let t=e?.source?.url;return typeof t=="string"&&/^https:\/\//.test(t)}function le(e){return(e??[]).filter(qe)}function _(e){let t=String(e?.creator??"").trim(),r=String(e?.name??"").trim();return t&&r&&t.toLowerCase()!==r.toLowerCase()?`${t} \xB7 ${r}`:t||r||"Source"}var Be=["W","U","B","R","G"],C=Object.freeze([{id:"edge",label:"Edge score"},{id:"momentum",label:"Momentum"},{id:"worksScore",label:"How well it works"},{id:"price",label:"Cheapest first"},{id:"released",label:"Most recent"},{id:"name",label:"Alphabetical"},{id:"rank",label:"EDHREC rank"},{id:"deckCount",label:"Deck count (popularity)"}]),pe="edge",fe=Object.freeze([{id:"includes",label:"Includes"},{id:"exact",label:"Exactly"},{id:"atMost",label:"At most"}]),z=Object.freeze({query:"",colors:[],colorMode:"includes",theme:"",functionalTag:"",creatureType:"",tier:"",minBracketFit:"",minRank:"",maxRank:"",minManaValue:"",maxManaValue:"",maxPrice:"",releasedAfter:"",scoredOnly:!1,sort:pe});function He(e){return e.map(t=>{let r=J(t);return r.unscored?{...t,tier:r.tier}:{...t,tier:r.tier,obscurity:r.obscurity,worksScore:r.worksScore,quality:r.quality}})}function he(e){let t=He(e),r=t.map(n=>[n.name,...n.themes??[],...n.functionalTags??[],...n.creatureTypes??[],...n.types??[]].join(" ").toLowerCase());return{commanders:t,haystacks:r,themes:F(t,"themes"),functionalTags:F(t,"functionalTags"),creatureTypes:F(t,"creatureTypes")}}function F(e,t){let r=new Map;for(let n of e)for(let o of n[t]??[])r.set(o,(r.get(o)??0)+1);return[...r.entries()].sort((n,o)=>o[1]-n[1]||n[0].localeCompare(o[0])).map(([n])=>n)}function me(e,t){let r=String(t.query??"").toLowerCase().split(/\s+/).filter(Boolean),n=[];for(let o=0;o<e.commanders.length;o+=1){if(r.length&&!r.every(l=>e.haystacks[o].includes(l)))continue;let s=e.commanders[o];Pe(s,t)&&n.push(s)}return n}function Pe(e,t){let r=e.popularity?.edhrecRank;return!(!Ve(e.colorIdentity,t.colors,t.colorMode)||t.theme&&!(e.themes??[]).includes(t.theme)||t.functionalTag&&!(e.functionalTags??[]).includes(t.functionalTag)||t.creatureType&&!(e.creatureTypes??[]).includes(t.creatureType)||t.tier&&e.tier!==t.tier||t.scoredOnly&&e.edgeScore===void 0||t.minBracketFit!==""&&!(e.quality?.bracketFit>=Number(t.minBracketFit))||!de(r,t.minRank,t.maxRank)||!de(e.manaValue,t.minManaValue,t.maxManaValue)||t.maxPrice!==""&&e.price!==void 0&&e.price>Number(t.maxPrice)||t.releasedAfter&&(e.releasedAt??"")<t.releasedAfter)}function de(e,t,r){return t===""&&r===""?!0:!(!Number.isFinite(e)||t!==""&&e<Number(t)||r!==""&&e>Number(r))}function Ve(e,t,r){if(!t?.length)return!0;if(e===void 0)return!1;let n=Be.filter(o=>t.includes(o));return r==="exact"?e===n.join(""):r==="atMost"?[...e].every(o=>n.includes(o)):n.every(o=>e.includes(o))}function ge(e,t){let r=ue[t]??ue[pe];return[...e].sort(r)}var v=e=>(t,r)=>{let n=e(t),o=e(r);return n===void 0&&o===void 0?b(t,r):n===void 0?1:o===void 0?-1:o-n||b(t,r)},Ue=e=>(t,r)=>{let n=e(t),o=e(r);return n===void 0&&o===void 0?b(t,r):n===void 0?1:o===void 0?-1:n-o||b(t,r)};function b(e,t){return(e.popularity?.edhrecRank??1/0)-(t.popularity?.edhrecRank??1/0)}var ue={edge:v(e=>e.edgeScore),momentum:v(e=>e.momentum),worksScore:v(e=>e.worksScore),price:Ue(e=>e.price),released:(e,t)=>String(t.releasedAt??"").localeCompare(String(e.releasedAt??""))||b(e,t),name:(e,t)=>e.name.localeCompare(t.name),rank:b,deckCount:v(e=>e.popularity?.deckCount)};var be=`
:host { all: initial; --mel-bg:#111513; --mel-panel:#1a211e; --mel-line:#34423c; --mel-text:#f2f6f3; --mel-muted:#9cafa6; --mel-green:#8ee6a8; --mel-gold:#f2ce72; color:var(--mel-text); font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif }
* { box-sizing:border-box }
button,input,select { font:inherit }
#toggle { position:fixed; z-index:2147483646; right:14px; bottom:18px; width:52px; height:52px; border:1px solid var(--mel-line); border-radius:50%; background:var(--mel-bg); color:var(--mel-green); font-weight:900; cursor:pointer; box-shadow:0 8px 28px #0008 }
#panel { position:fixed; z-index:2147483645; right:14px; bottom:82px; width:min(430px,calc(100vw - 28px)); height:min(760px,calc(100vh - 110px)); display:grid; grid-template-rows:auto auto 1fr; background:var(--mel-bg); border:1px solid var(--mel-line); border-radius:14px; box-shadow:0 20px 60px #000b; overflow:hidden }
#panel[hidden] { display:none }
header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:15px 16px; border-bottom:1px solid var(--mel-line) }
header strong { display:block; font-size:16px } header span,.muted { color:var(--mel-muted); font-size:12px }
nav { display:grid; grid-template-columns:repeat(3,1fr); border-bottom:1px solid var(--mel-line) }
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
.actions { margin-top:9px; justify-content:space-between }
.link { border:0; background:none; color:var(--mel-green); cursor:pointer; padding:0; font-size:13px }
.detail { margin-top:10px; padding-top:9px; border-top:1px solid var(--mel-line) }
.detail .label { display:block; margin:8px 0 4px }
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

.empty { padding:25px 8px; text-align:center; color:var(--mel-muted) }
.notice { padding:8px 12px; margin-bottom:10px; border-radius:7px; background:#4c361f; color:#ffdba3; font-size:12px }
@media (max-width:560px) { #panel { right:0; bottom:0; width:100vw; height:100vh; border-radius:0 } #toggle { right:10px; bottom:10px } }
`;var m=60,Ge=140,ke="mtg-edge-lord:filters",Ke=[{id:"W",label:"W"},{id:"U",label:"U"},{id:"B",label:"B"},{id:"R",label:"R"},{id:"G",label:"G"}],We=[{id:"",label:"Any tier"},{id:"edge",label:"Edge (1,000\u20133,000)"},{id:"rare",label:"Rare (500\u20131,000)"},{id:"meta",label:"Meta (top 500)"},{id:"uncharted",label:"Uncharted (3,000+)"}],a={tab:"search",filters:{...z,...lt()},shown:m,expanded:null,detail:null,index:null,data:null,loading:!0,error:null},ye=null,V=document.createElement("div");V.id="mtg-edge-lord-root";var d=V.attachShadow({mode:"open"});document.body.append(V);Ye();Je();function Ye(){d.innerHTML=`<style>${be}</style>
    <button id="toggle" type="button" aria-label="Open MTG Edge Lord">EL</button>
    <section id="panel" aria-label="MTG Edge Lord" hidden>
      <header>
        <div><strong>MTG Edge Lord</strong><span id="status">Loading\u2026</span></div>
        <a href="https://github.com/RktRobinhood/MTG-Edge-Lord" target="_blank" rel="noopener noreferrer">About</a>
      </header>
      <nav>${H("search","Search")}${H("discover","Recent finds")}${H("card","Card-first")}</nav>
      <main></main>
    </section>`,d.getElementById("toggle").addEventListener("click",()=>{let e=d.getElementById("panel");e.hidden=!e.hidden}),d.querySelector("nav").addEventListener("click",e=>{let t=e.target.closest("button[data-tab]");t&&(a.tab=t.dataset.tab,a.shown=m,U())})}async function Je(){try{a.data=await se(),a.index=he(a.data.commanders.commanders)}catch(e){a.error=e.message}finally{a.loading=!1,U()}}function U(){d.querySelectorAll("nav button").forEach(t=>t.classList.toggle("active",t.dataset.tab===a.tab)),d.getElementById("status").textContent=Ze();let e=d.querySelector("main");if(a.loading)return void(e.innerHTML='<div class="empty">Loading\u2026</div>');if(a.error)return void(e.innerHTML=`<div class="empty">${i(a.error)}</div>`);e.innerHTML=`
    ${a.data.stale?'<div class="notice">Live data could not be reached. Showing the last cached version.</div>':""}
    ${a.tab==="search"?et():tt()}
    <div class="summary" id="result-summary"></div>
    <div class="stack" id="results"></div>`,Xe(e),y()}function Ze(){return a.data?`${(a.index?.commanders.length??0).toLocaleString()} commanders \xB7 ${a.data.manifest.dataVersion}${a.data.stale?" \xB7 cached":""}`:"Discovery data unavailable"}function Xe(e){e.querySelectorAll("[data-field]").forEach(t=>{let r=t.tagName==="SELECT"||t.type==="checkbox"?"change":"input";t.addEventListener(r,()=>{let n=t.type==="checkbox"?t.checked:t.value;a.filters[t.dataset.field]=n,a.shown=m,B(),r==="input"?Qe():y()})}),e.querySelectorAll("[data-color]").forEach(t=>t.addEventListener("click",()=>{let r=t.dataset.color,n=a.filters.colors.includes(r)?a.filters.colors.filter(o=>o!==r):[...a.filters.colors,r];a.filters.colors=n,t.classList.toggle("on",n.includes(r)),a.shown=m,B(),y()})),e.querySelector("#reset")?.addEventListener("click",()=>{a.filters={...z},a.shown=m,B(),U()})}function Qe(){clearTimeout(ye),ye=setTimeout(y,Ge)}function y(){let e=d.getElementById("results"),t=d.getElementById("result-summary");if(!e)return;if(a.tab==="discover"){let o=le(a.data.findings.findings).filter(s=>xe(`${s.title} ${s.summary}`,a.filters.query)).sort((s,l)=>l.score.total-s.score.total);return t.textContent=`${o.length} find${o.length===1?"":"s"}`,e.innerHTML=o.slice(0,a.shown).map(it).join("")||P("No finds match that search yet."),q(e)}if(a.tab==="card"){let o=a.data.cards.cards.filter(s=>xe(s.name,a.filters.query));return t.textContent=`${o.length} card${o.length===1?"":"s"}`,e.innerHTML=o.slice(0,a.shown).map(ct).join("")||P("No cards match that search yet."),q(e)}let r=ge(me(a.index,a.filters),a.filters.sort),n=r.filter(o=>o.edgeScore!==void 0).length;t.innerHTML=`<strong>${r.length.toLocaleString()}</strong> commanders \xB7 ${n.toLocaleString()} scored \xB7 sorted by ${i(dt(a.filters.sort))}`,e.innerHTML=r.slice(0,a.shown).map(rt).join("")||P("Nothing matches those filters. Widen the rank band or clear a colour."),r.length>a.shown&&e.insertAdjacentHTML("beforeend",`<button class="more" id="more" type="button">Show ${Math.min(m,r.length-a.shown)} more of ${(r.length-a.shown).toLocaleString()}</button>`),q(e)}function q(e){e.querySelector("#more")?.addEventListener("click",()=>{a.shown+=m,y()}),e.querySelectorAll("[data-expand]").forEach(t=>t.addEventListener("click",async()=>{let r=t.dataset.expand;a.expanded=a.expanded===r?null:r,a.expanded&&!a.detail&&(a.detail=await ie(a.data.manifest.dataVersion)),y()}))}function et(){let e=a.filters;return`<div class="controls">
    <input class="query" data-field="query" value="${c(e.query)}" placeholder="Name, theme, mechanic, creature type" aria-label="Search">
    <div class="row colors">
      <span class="label">Colour identity</span>
      ${Ke.map(t=>`<button type="button" class="pip ${e.colors.includes(t.id)?"on":""}" data-color="${t.id}" aria-label="${t.label}">${t.label}</button>`).join("")}
      <select data-field="colorMode" aria-label="Colour matching">${h(fe.map(t=>[t.id,t.label]),e.colorMode)}</select>
    </div>
    <div class="row">
      <span class="label">Rank band</span>
      <input type="number" min="1" data-field="minRank" value="${c(e.minRank)}" placeholder="1000">
      <span class="to">to</span>
      <input type="number" min="1" data-field="maxRank" value="${c(e.maxRank)}" placeholder="3000">
      <select data-field="tier" aria-label="Tier">${h(We.map(t=>[t.id,t.label]),e.tier)}</select>
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
      <select data-field="theme" aria-label="Theme">${h([["","Any theme"],...a.index.themes.map(t=>[t,E(t)])],e.theme)}</select>
      <select data-field="functionalTag" aria-label="Mechanic">${h([["","Any mechanic"],...a.index.functionalTags.map(t=>[t,E(t)])],e.functionalTag)}</select>
      <select data-field="creatureType" aria-label="Creature type">${h([["","Any creature type"],...a.index.creatureTypes.map(t=>[t,t])],e.creatureType)}</select>
    </div>
    <div class="row">
      <span class="label">Bracket fit at least</span>
      <select data-field="minBracketFit" aria-label="Bracket fit">${h([["","Any"],["0.4","40%"],["0.55","55%"],["0.7","70%"]],e.minBracketFit)}</select>
      <span class="label">Released after</span>
      <input type="date" data-field="releasedAfter" value="${c(e.releasedAfter)}">
    </div>
    <div class="row">
      <label class="check"><input type="checkbox" data-field="scoredOnly" ${e.scoredOnly?"checked":""}> Scored only</label>
      <select data-field="sort" aria-label="Sort">${h(C.map(t=>[t.id,t.label]),e.sort)}</select>
      <button type="button" id="reset" class="reset">Reset</button>
    </div>
  </div>`}function tt(){return`<div class="controls"><input class="query" data-field="query" value="${c(a.filters.query)}" placeholder="Search" aria-label="Search"></div>`}function rt(e){let t=e.popularity?.edhrecRank,r=e.popularity?.deckCount,n=a.expanded===e.slug;return`<article class="card">
    <div class="meta">
      ${nt(e)}
      ${e.tier?`<span class="tier ${e.tier}">${i(e.tier)}</span>`:""}
      ${e.colorIdentity!==void 0?`<span class="chip">${i(e.colorIdentity||"Colourless")}</span>`:""}
      ${Number.isFinite(e.manaValue)?`<span class="chip">MV ${e.manaValue}</span>`:""}
      ${e.price!==void 0?`<span class="chip">$${e.price.toFixed(2)}</span>`:""}
      <span class="muted">#${t?.toLocaleString()??"\u2014"} \xB7 ${r?.toLocaleString()??"\u2014"} decks</span>
    </div>
    <h3>${i(e.name)}</h3>
    ${ot(e)}
    ${at(e)}
    <div class="chips">${(e.themes??[]).slice(0,5).map(o=>`<span class="chip">${i(E(o))}</span>`).join("")}</div>
    ${$e(e.findingIds)}
    <div class="row actions">
      <a href="https://edhrec.com/commanders/${encodeURIComponent(e.slug)}" target="_blank" rel="noopener noreferrer">Open on EDHREC \u2197</a>
      <button type="button" class="link" data-expand="${c(e.slug)}">${n?"Hide detail":"Why it works"}</button>
    </div>
    ${n?st(e):""}
  </article>`}function nt(e){return e.edgeScore!==void 0?`<span class="score">${e.edgeScore}</span>`:e.cohortScore!==void 0?`<span class="score cohort" title="Scored against its set cohort, not the whole format">${e.cohortScore}<small>new</small></span>`:'<span class="score none" title="Not enough evidence to score">\u2014</span>'}function ot(e){return e.cohortScore!==void 0?`<p class="cohort-note">New arrival \u2014 scored against its ${i(String(e.cohort?.setCode??"").toUpperCase())} set cohort, not the whole format.</p>
      <ul class="why">${Z(e).map(t=>`<li>${i(t)}</li>`).join("")}</ul>`:e.edgeScore===void 0?`<p class="insufficient">Insufficient data \u2014 ${i(O(e))}</p>`:`<ul class="why">${M(e).map(t=>`<li>${i(t)}</li>`).join("")}</ul>`}function at(e){let t=e.quality;if(!t)return"";let r=[["Bracket fit",t.bracketFit],["Archetype depth",t.archetypeDepth],["Retention",t.retention]].filter(([,n])=>n!==void 0);return r.length?`<div class="chips">${r.map(([n,o])=>`<span class="chip quality">${n} ${Math.round(o*100)}%</span>`).join("")}${e.partialScore?'<span class="chip muted">partial</span>':""}</div>`:""}function st(e){let t=a.detail?.[e.slug];return t?`<div class="detail">
    ${t.highSynergyCards?.length?`<p class="label">Cards that want to be here</p><div class="chips">${t.highSynergyCards.map(r=>`<a class="chip" href="https://edhrec.com/cards/${encodeURIComponent(r)}" target="_blank" rel="noopener noreferrer">${i(E(r))}</a>`).join("")}</div>`:""}
    ${t.similar?.length?`<p class="label">Plays like</p><div class="chips">${t.similar.map(r=>`<span class="chip">${i(r)}</span>`).join("")}</div>`:""}
    ${e.comboCount&&e.comboUrl?`<p class="muted"><a href="${c(e.comboUrl)}" target="_blank" rel="noopener noreferrer">${e.comboCount} known combo line${e.comboCount===1?"":"s"} on Commander Spellbook \u2197</a> \u2014 shown, never scored.</p>`:""}
  </div>`:'<div class="detail">No per-commander detail has been collected yet.</div>'}function it(e){let t=[...e.commanders,...e.cards].map(r=>`<span class="chip">${i(r.name)}</span>`).join("");return`<a class="card digest" href="${c(e.source.url)}" target="_blank" rel="noopener noreferrer">
    <div class="credit">
      <span class="source">${i(_(e.source))}</span>
      <span class="muted">${i(e.publishedAt)}${e.observedAt?` \xB7 found ${i(e.observedAt.slice(0,10))}`:""}</span>
    </div>
    <h3>${i(e.title)}</h3>
    <p class="clamp">${i(ce(e.summary))}</p>
    <div class="chips">${t}</div>
    <span class="readon">Read it at ${i(_(e.source))} \u2197</span>
  </a>`}function ct(e){let t=e.commanders.map(r=>`<a class="chip" href="https://edhrec.com/commanders/${encodeURIComponent(r.slug)}" target="_blank" rel="noopener noreferrer">${i(r.name)} \xB7 ${r.relationshipScore}</a>`).join("");return`<article class="card"><h3>${i(e.name)}</h3><div class="chips">${t}</div>${$e(e.findingIds)}</article>`}function $e(e=[]){let t=new Set(e),r=(a.data.resources.resources??[]).filter(n=>t.has(n.findingId)&&typeof n.url=="string"&&n.url.startsWith("https://")).slice(0,3);return r.length?`<p class="sources">${r.map(n=>`<a href="${c(n.url)}" target="_blank" rel="noopener noreferrer">${i(n.creator)} \xB7 ${ut(n.resourceDepth)} \u2197</a>`).join(" \xB7 ")}</p>`:""}function xe(e,t){let r=String(t??"").trim().toLowerCase();return!r||String(e).toLowerCase().includes(r)}function B(){try{sessionStorage.setItem(ke,JSON.stringify(a.filters))}catch{}}function lt(){try{return JSON.parse(sessionStorage.getItem(ke))??{}}catch{return{}}}function dt(e){return C.find(t=>t.id===e)?.label??C[0].label}function E(e){return String(e).replaceAll("-"," ").replace(/\b[a-z]/g,t=>t.toUpperCase())}function h(e,t){return e.map(([r,n])=>`<option value="${c(r)}" ${String(t)===String(r)?"selected":""}>${i(n)}</option>`).join("")}function H(e,t){return`<button type="button" data-tab="${e}" class="${a.tab===e?"active":""}">${t}</button>`}function ut(e){return i(String(e).replaceAll("_"," "))}function P(e){return`<div class="empty">${i(e)}</div>`}function i(e){let t=document.createElement("span");return t.textContent=String(e),t.innerHTML}function c(e){return i(e).replaceAll('"',"&quot;")}})();
