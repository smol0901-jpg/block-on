'use strict';
const $=s=>document.querySelector(s),svg=$('#cv'),NS='http://www.w3.org/2000/svg';
const LS=(k,d)=>{try{return JSON.parse(localStorage[k])||d}catch{return d}};
const T={terminal:['Начало','#a6e3a1'],process:['Действие','#89b4fa'],decision:['Условие?','#fab387'],io:['Ввод/Вывод','#cba6f7'],data:['Данные','#94e2d5'],sub:['Подпроцесс','#f9e2af'],note:['Заметка','#f5c2e7']};
const NAMES={terminal:'Старт/Конец',process:'Процесс',decision:'Условие',io:'Ввод/вывод',data:'Данные',sub:'Подпроцесс',note:'Заметка'},ICON={terminal:'⬭',process:'▭',decision:'◇',io:'▱',data:'🛢',sub:'⊟',note:'🗒'};
const PAL={dark:{bg:'#1e1e2e',dot:'#3a3c52',edge:'#89b4fa',txt:'#cdd6f4'},light:{bg:'#f6f7fb',dot:'#cdd2e2',edge:'#3b5bdb',txt:'#1f2430'},blue:{bg:'#0b3d91',dot:'#3b6bc2',edge:'#ffffff',txt:'#ffffff'},paper:{bg:'#fbf6e9',dot:'#ded3b5',edge:'#5c4a2a',txt:'#2b2315'},none:{bg:'transparent',dot:'#8886',edge:'#5c6bc0',txt:'#333333'}};
const BGN={dark:'Тёмный',light:'Светлый',blue:'Синька',paper:'Бумага',none:'Прозрачный'};
let S={nodes:[],edges:[],cam:{x:60,y:40,k:1}},cfg={bg:'dark',snap:true,sig:true,sc:2,...LS('ffCfg',{})};
let sel=new Set(),selE=null,tool='select',linkFrom=null,hist=[],hi=-1,clip=null,ov='',raf=0,space=false,last={t:0,id:0},NM=new Map(),g=null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const G=v=>cfg.snap?Math.round(v/20)*20:Math.round(v),N=id=>S.nodes.find(n=>n.id==id),stamp=()=>new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._);t._=setTimeout(()=>t.classList.remove('show'),2600)};
const ink=c=>{c=c.replace('#','');if(c.length==3)c=[...c].map(x=>x+x).join('');const[r,g,b]=[0,2,4].map(i=>parseInt(c.substr(i,2),16));return(r*299+g*587+b*114)/1000>140?'#1e1e2e':'#ffffff'};
const nid=p=>{let i=1;const u=new Set([...S.nodes,...S.edges].map(o=>o.id));while(u.has(p+i))i++;return p+i};
/* ---------- модель ---------- */
const wrap=(t,m=16)=>{const o=[];String(t).split('\n').forEach(p=>{let l='';p.split(' ').forEach(w=>{if(l&&(l+' '+w).length>m){o.push(l);l=w}else l=l?l+' '+w:w});o.push(l)});return o};
function dim(n){const L=wrap(n.text),mx=Math.max(...L.map(s=>s.length),4);let w=Math.max(120,mx*8.6+36),h=Math.max(56,L.length*19+26);if(n.type=='decision'){w*=1.35;h=Math.max(84,h*1.5)}if(n.type=='io')w+=24;n.w=Math.round(w);n.h=Math.round(h);n.L=L}
const dimAll=()=>S.nodes.forEach(dim);
function addNode(type,x,y,text,color){const n={id:nid('n'),type,text:text??T[type][0],x:G(x),y:G(y)};if(color)n.color=color;dim(n);S.nodes.push(n);return n}
function addEdge(a,b,label){if(!a||!b||a==b||S.edges.some(e=>e.from==a&&e.to==b))return null;const e={id:nid('e'),from:a,to:b};if(label)e.label=label;S.edges.push(e);return e}
const ser=c=>({format:'flowforge',version:'2.0',...(c?{camera:{x:Math.round(S.cam.x),y:Math.round(S.cam.y),zoom:+S.cam.k.toFixed(3)}}:{}),nodes:S.nodes.map(({id,type,text,x,y,color})=>({id,type,text,x,y,...(color?{color}:{})})),edges:S.edges.map(({id,from,to,label})=>({id,from,to,...(label?{label}:{})}))});
function save(){try{localStorage.ffDoc=JSON.stringify(ser(true))}catch{}}
const cfgSave=()=>{try{localStorage.ffCfg=JSON.stringify(cfg)}catch{}};
function commit(){const s=JSON.stringify(ser());if(hist[hi]===s)return;hist=hist.slice(0,hi+1);hist.push(s);if(hist.length>100)hist.shift();hi=hist.length-1;save();draw();insp()}
function restore(s){const d=JSON.parse(s);S.nodes=d.nodes;S.edges=d.edges;dimAll();sel=new Set([...sel].filter(i=>N(i)));if(selE&&!S.edges.some(e=>e.id==selE))selE=null;save();draw();insp()}
const undo=()=>{if(hi>0){hi--;restore(hist[hi])}},redo=()=>{if(hi<hist.length-1){hi++;restore(hist[hi])}};
function norm(d){if(!d||!Array.isArray(d.nodes))throw Error('нет массива "nodes"');const m=new Map(),seen=new Set();
const nodes=d.nodes.map((r,i)=>{r=r||{};let id=r.id!=null?String(r.id):'n'+(i+1);const o=id;while(seen.has(id))id+='_';seen.add(id);if(!m.has(o))m.set(o,id);
const type=T[r.type]?r.type:'process',xy=r.x!=null&&r.y!=null&&isFinite(+r.x)&&isFinite(+r.y),n={id,type,text:String(r.text??T[type][0]),x:xy?+r.x:NaN,y:xy?+r.y:NaN};if(/^#[0-9a-f]{3,8}$/i.test(r.color))n.color=r.color;return n});
const pairs=new Set(),edges=[];(Array.isArray(d.edges)?d.edges:[]).forEach(r=>{const a=m.get(String(r?.from)),b=m.get(String(r?.to));if(a&&b&&a!=b&&!pairs.has(a+'>'+b)){pairs.add(a+'>'+b);edges.push({id:'e'+(edges.length+1),from:a,to:b,...(r.label?{label:String(r.label)}:{})})}});
return{nodes,edges,auto:nodes.some(n=>isNaN(n.x))}}
function setDoc(r){const{nodes,edges,auto}=norm(r),c=r.camera;S.nodes=nodes;S.edges=edges;dimAll();sel=new Set();selE=null;linkFrom=null;
if(auto)layout('TB',true);const ok=c&&isFinite(+c.x)&&isFinite(+c.y)&&+c.zoom>0;if(ok&&!auto)S.cam={x:+c.x,y:+c.y,k:Math.max(.1,Math.min(4,+c.zoom))};commit();if(!ok||auto)fit()}
function demo(){S.nodes=[];S.edges=[];sel=new Set();const a=addNode('terminal',340,40,'Начало'),b=addNode('io',320,160,'Ввод A, B'),c=addNode('decision',300,280,'A > B?'),d=addNode('process',600,440,'Max = A'),e=addNode('process',60,440,'Max = B'),f=addNode('terminal',340,600,'Конец');
addEdge(a.id,b.id);addEdge(b.id,c.id);addEdge(c.id,d.id,'Да');addEdge(c.id,e.id,'Нет');addEdge(d.id,f.id);addEdge(e.id,f.id);commit();fit()}
function layout(dir='TB',quiet){const nd=S.nodes;if(!nd.length)return;
if(window.dagre){const gr=new dagre.graphlib.Graph();gr.setGraph({rankdir:dir,nodesep:50,ranksep:70});gr.setDefaultEdgeLabel(()=>({}));nd.forEach(n=>gr.setNode(n.id,{width:n.w,height:n.h}));S.edges.forEach(e=>gr.setEdge(e.from,e.to));dagre.layout(gr);nd.forEach(n=>{const p=gr.node(n.id);n.x=G(p.x-n.w/2);n.y=G(p.y-n.h/2)})}
else{if(!quiet)toast('dagre не загружен (нет сети) — простая сетка');nd.forEach((n,i)=>{n.x=40+(i%4)*260;n.y=40+Math.floor(i/4)*140})}
if(!quiet){commit();fit()}}
/* ---------- геометрия и рендер ---------- */
const pt=(n,s)=>s=='r'?[n.x+n.w,n.y+n.h/2]:s=='l'?[n.x,n.y+n.h/2]:s=='b'?[n.x+n.w/2,n.y+n.h]:[n.x+n.w/2,n.y];
const side=(a,b)=>{const dx=b.x+b.w/2-a.x-a.w/2,dy=b.y+b.h/2-a.y-a.h/2;return Math.abs(dx)*a.h>Math.abs(dy)*a.w?(dx>0?'r':'l'):(dy>0?'b':'t')},NV={r:[1,0],l:[-1,0],b:[0,1],t:[0,-1]};
function geo(e){const a=NM.get(e.from),b=NM.get(e.to);if(!a||!b)return;const s1=side(a,b),s2=side(b,a),p=pt(a,s1),q=pt(b,s2),k=Math.min(Math.hypot(q[0]-p[0],q[1]-p[1])*.4,110),c1=[p[0]+NV[s1][0]*k,p[1]+NV[s1][1]*k],c2=[q[0]+NV[s2][0]*k,q[1]+NV[s2][1]*k];return{d:`M${p}C${c1} ${c2} ${q}`,m:[(p[0]+3*c1[0]+3*c2[0]+q[0])/8,(p[1]+3*c1[1]+3*c2[1]+q[1])/8]}}
function shp(n,f,st,sw){const{x,y,w,h}=n,a=`fill="${f}" stroke="${st}" stroke-width="${sw}"`;
switch(n.type){case'terminal':return`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h/2}" ${a}/>`;
case'decision':return`<path d="M${x+w/2} ${y}L${x+w} ${y+h/2}L${x+w/2} ${y+h}L${x} ${y+h/2}Z" ${a}/>`;
case'io':{const s=h*.3;return`<path d="M${x+s} ${y}H${x+w}L${x+w-s} ${y+h}H${x}Z" ${a}/>`}
case'data':{const e=9;return`<path d="M${x} ${y+e}V${y+h-e}A${w/2} ${e} 0 0 0 ${x+w} ${y+h-e}V${y+e}A${w/2} ${e} 0 0 0 ${x} ${y+e}A${w/2} ${e} 0 0 0 ${x+w} ${y+e}" ${a}/>`}
case'sub':return`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ${a}/><path d="M${x+14} ${y}V${y+h}M${x+w-14} ${y}V${y+h}" fill="none" stroke="${st}" stroke-width="${sw}"/>`;
case'note':return`<path d="M${x} ${y}H${x+w-16}L${x+w} ${y+16}V${y+h}H${x}Z" ${a}/>`;
default:return`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" ${a}/>`}}
const defs=P=>`<defs>${['ah','ahs'].map((id,i)=>`<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${i?'#f9e2af':P.edge}"/></marker>`).join('')}</defs>`;
function body(ex){const P=PAL[cfg.bg];let o='';
S.edges.forEach(e=>{const q=geo(e);if(!q)return;const on=!ex&&selE==e.id;o+=`<g data-e="${e.id}"><path d="${q.d}" fill="none" stroke="transparent" stroke-width="24"/><path d="${q.d}" fill="none" stroke="${on?'#f9e2af':P.edge}" stroke-width="${on?3:2}" marker-end="url(#${on?'ahs':'ah'})"/>${e.label?`<text x="${q.m[0]}" y="${q.m[1]-6}" text-anchor="middle" font-size="13" font-weight="700" fill="${P.txt}">${esc(e.label)}</text>`:''}</g>`});
S.nodes.forEach(n=>{const on=!ex&&(sel.has(n.id)||linkFrom==n.id),f=n.color||T[n.type][1],cx=n.x+n.w/2,y0=n.y+n.h/2-(n.L.length-1)*9.5+5;
o+=`<g data-n="${n.id}">${shp(n,f,on?'#f9e2af':'rgba(0,0,0,.3)',on?3:1.5)}<text font-size="14" font-weight="600" text-anchor="middle" fill="${ink(f)}">${n.L.map((s,i)=>`<tspan x="${cx}" y="${y0+i*19}">${esc(s)}</tspan>`).join('')}</text></g>`});
if(!ex&&sel.size==1&&tool!='pan'){const n=N([...sel][0]);if(n)['r','l','t','b'].forEach(s=>{const[px,py]=pt(n,s);o+=`<circle data-p="${n.id}" data-s="${s}" cx="${px}" cy="${py}" r="${9/Math.max(.6,Math.min(S.cam.k,1.5))}" fill="#f9e2af" stroke="#1e1e2e" stroke-width="2"/>`})}
return o}
function render(){raf=0;NM=new Map(S.nodes.map(n=>[n.id,n]));const P=PAL[cfg.bg],c=S.cam;$('#stage').style.background=P.bg=='transparent'?'':P.bg;$('#stage').classList.toggle('chk',P.bg=='transparent');
svg.innerHTML=`${defs(P)}<pattern id="gr" width="${20*c.k}" height="${20*c.k}" patternUnits="userSpaceOnUse" x="${c.x}" y="${c.y}"><circle cx="1" cy="1" r="${Math.max(.8,c.k)}" fill="${c.k<.5?'none':P.dot}"/></pattern><rect width="100%" height="100%" fill="url(#gr)"/><g transform="translate(${c.x} ${c.y}) scale(${c.k})">${body(false)}${ov}</g>`;
$('#info').textContent=`${S.nodes.length} бл · ${S.edges.length} св · ${Math.round(c.k*100)}%`;$('[data-a=undo]').disabled=hi<1;$('[data-a=redo]').disabled=hi>=hist.length-1}
const draw=()=>raf||(raf=requestAnimationFrame(render));
function bbox(){if(!S.nodes.length)return{x:0,y:0,w:300,h:200};let a=1e9,b=1e9,c=-1e9,d=-1e9;S.nodes.forEach(n=>{a=Math.min(a,n.x);b=Math.min(b,n.y);c=Math.max(c,n.x+n.w);d=Math.max(d,n.y+n.h)});return{x:a,y:b,w:c-a,h:d-b}}
function fit(){const r=svg.getBoundingClientRect(),b=bbox(),k=Math.max(.15,Math.min(1.6,Math.min((r.width-60)/b.w,(r.height-60)/b.h)));S.cam={k,x:r.width/2-(b.x+b.w/2)*k,y:r.height/2-(b.y+b.h/2)*k};draw();save()}
function zoomAt(f,cx,cy){const r=svg.getBoundingClientRect(),c=S.cam,mx=cx-r.left,my=cy-r.top,wx=(mx-c.x)/c.k,wy=(my-c.y)/c.k,k=Math.max(.1,Math.min(4,c.k*f));S.cam={k,x:mx-wx*k,y:my-wy*k};draw()}
const zoomC=f=>{const r=svg.getBoundingClientRect();zoomAt(f,r.left+r.width/2,r.top+r.height/2)};
/* ---------- выделение и инспектор ---------- */
function setSel(ids,e=null){sel=new Set(ids);selE=e;insp();draw()}
function insp(){const one=sel.size==1?N([...sel][0]):null,e=selE&&S.edges.find(x=>x.id==selE),p=$('#insp');p.hidden=!(sel.size||e);p.className=(one?'one ':'')+(sel.size?'nodes ':'')+(e?'edge':'');
if(one){$('#pt').value=one.text;$('#pty').value=one.type;$('#pc').value=one.color||T[one.type][1]}else if(sel.size)$('#pc').value='#89b4fa';if(e)$('#pl').value=e.label||''}
$('#pty').innerHTML=Object.keys(T).map(k=>`<option value="${k}">${NAMES[k]}`).join('');
$('#pt').oninput=e=>{const n=N([...sel][0]);if(n){n.text=e.target.value;dim(n);draw()}};
$('#pty').onchange=e=>{sel.forEach(i=>{const n=N(i);n.type=e.target.value;dim(n)});commit()};
$('#pc').oninput=e=>{sel.forEach(i=>N(i).color=e.target.value);draw()};
$('#pl').oninput=e=>{const x=S.edges.find(x=>x.id==selE);if(x){x.label=e.target.value;draw()}};
['pt','pc','pl'].forEach(i=>$('#'+i).onchange=commit);
function setTool(t){tool=t;linkFrom=null;document.querySelectorAll('[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t==t));svg.style.cursor=t=='pan'?'grab':t=='link'?'crosshair':'default';draw()}
function del(){if(selE){S.edges=S.edges.filter(e=>e.id!=selE);selE=null}else if(sel.size){S.nodes=S.nodes.filter(n=>!sel.has(n.id));S.edges=S.edges.filter(e=>!sel.has(e.from)&&!sel.has(e.to));sel=new Set()}else return;commit()}
function copy(){clip={n:S.nodes.filter(n=>sel.has(n.id)).map(n=>({...n})),e:S.edges.filter(e=>sel.has(e.from)&&sel.has(e.to)).map(e=>({...e})),c:0};if(clip.n.length)toast('Скопировано')}
function paste(){if(!clip||!clip.n.length)return;clip.c++;const m=new Map(),o=clip.c*40;clip.n.forEach(n=>m.set(n.id,addNode(n.type,n.x+o,n.y+o,n.text,n.color).id));clip.e.forEach(e=>addEdge(m.get(e.from),m.get(e.to),e.label));sel=new Set(m.values());commit()}
function addFromPalette(type){const r=svg.getBoundingClientRect(),c=S.cam,s=sel.size==1&&type!='note'?N([...sel][0]):null,o=(S.nodes.length%6)*20;let n;
if(s){n=addNode(type,s.x,s.y+s.h+60);addEdge(s.id,n.id)}else n=addNode(type,(r.width/2-c.x)/c.k-60+o,(r.height/2-c.y)/c.k-30+o);
sel=new Set([n.id]);selE=null;commit()}
$('#pal').innerHTML=Object.keys(T).map(k=>`<button data-add="${k}"><i>${ICON[k]}</i>${NAMES[k]}</button>`).join('');
/* ---------- жесты: мышь, палец, перо ---------- */
const toW=e=>{const r=svg.getBoundingClientRect(),c=S.cam;return{x:(e.clientX-r.left-c.x)/c.k,y:(e.clientY-r.top-c.y)/c.k}};
const hit=w=>[...S.nodes].reverse().find(n=>w.x>=n.x&&w.x<=n.x+n.w&&w.y>=n.y&&w.y<=n.y+n.h),P=new Map();
svg.addEventListener('pointerdown',e=>{svg.setPointerCapture(e.pointerId);P.set(e.pointerId,{x:e.clientX,y:e.clientY});
if(P.size==2){const[a,b]=[...P.values()];g={t:'pinch',d:Math.hypot(a.x-b.x,a.y-b.y)||1,k:S.cam.k,w:toW({clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2})};return}
if(P.size>2)return;
const w=toW(e),pe=e.target.closest('[data-p]'),ne=e.target.closest('[data-n]'),ee=e.target.closest('[data-e]'),pan=tool=='pan'||space||e.button==1;
if(pe&&!pan){g={t:'link',from:pe.dataset.p,s:pe.dataset.s,w};return}
if(ne&&!pan){const id=ne.dataset.n;
if(tool=='link'){if(!linkFrom)linkFrom=id;else{if(addEdge(linkFrom,id))commit();linkFrom=null}draw();return}
if(e.shiftKey||e.ctrlKey||e.metaKey){sel.has(id)?sel.delete(id):sel.add(id);selE=null}else if(!sel.has(id)){sel=new Set([id]);selE=null}
insp();if(last.id==id&&Date.now()-last.t<350){$('#pt').focus();$('#pt').select()}last={id,t:Date.now()};
const o=new Map();sel.forEach(i=>{const n=N(i);o.set(i,[n.x,n.y])});g={t:'drag',w,o,mv:false};draw();return}
if(ee&&!pan){setSel([],ee.dataset.e);return}
g={t:pan||e.pointerType=='touch'?'pan':'box',w,x:e.clientX,y:e.clientY,cx:S.cam.x,cy:S.cam.y,add:e.shiftKey,mv:false}});
svg.addEventListener('pointermove',e=>{if(!P.has(e.pointerId))return;P.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!g)return;
if(g.t=='pinch'){if(P.size<2)return;const[a,b]=[...P.values()],r=svg.getBoundingClientRect(),k=Math.max(.1,Math.min(4,g.k*Math.hypot(a.x-b.x,a.y-b.y)/g.d)),mx=(a.x+b.x)/2-r.left,my=(a.y+b.y)/2-r.top;S.cam={k,x:mx-g.w.x*k,y:my-g.w.y*k};return draw()}
const w=toW(e);
if(g.t=='pan'){const dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.hypot(dx,dy)>3)g.mv=true;S.cam.x=g.cx+dx;S.cam.y=g.cy+dy}
else if(g.t=='drag'){const dx=w.x-g.w.x,dy=w.y-g.w.y;if(Math.hypot(dx,dy)*S.cam.k>4)g.mv=true;if(g.mv)g.o.forEach(([ox,oy],id)=>{const n=N(id);n.x=G(ox+dx);n.y=G(oy+dy)})}
else if(g.t=='link'){const[px,py]=pt(N(g.from),g.s);g.mv=Math.hypot(w.x-px,w.y-py)>12;ov=`<path d="M${px} ${py}L${w.x} ${w.y}" stroke="#f9e2af" stroke-width="2.5" stroke-dasharray="6 5" fill="none"/>`}
else if(g.t=='box'){g.mv=true;g.e=w;ov=`<rect x="${Math.min(g.w.x,w.x)}" y="${Math.min(g.w.y,w.y)}" width="${Math.abs(w.x-g.w.x)}" height="${Math.abs(w.y-g.w.y)}" fill="#89b4fa22" stroke="#89b4fa" stroke-dasharray="4 3"/>`}
draw()});
const up=e=>{P.delete(e.pointerId);if(!g)return;if(g.t=='pinch'){if(P.size<2){g=null;save()}return}
const w=toW(e),t=g.t;
if(t=='drag'&&g.mv)commit();
else if(t=='link'&&g.mv){const h=hit(w);if(h&&h.id!=g.from){if(addEdge(g.from,h.id))commit()}else if(!h){const n=addNode('process',w.x-60,w.y-28);addEdge(g.from,n.id);sel=new Set([n.id]);commit()}}
else if(t=='box'&&g.e){const x1=Math.min(g.w.x,g.e.x),x2=Math.max(g.w.x,g.e.x),y1=Math.min(g.w.y,g.e.y),y2=Math.max(g.w.y,g.e.y),ids=S.nodes.filter(n=>n.x<x2&&n.x+n.w>x1&&n.y<y2&&n.y+n.h>y1).map(n=>n.id);setSel(g.add?[...sel,...ids]:ids)}
else if((t=='box'||t=='pan')&&!g.mv)setSel([]);
if(t=='pan')save();g=null;ov='';draw();insp()};
svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up);
svg.addEventListener('dblclick',e=>{if(e.target.closest('[data-n],[data-e],[data-p]')||tool!='select')return;const w=toW(e),n=addNode('process',w.x-60,w.y-28);sel=new Set([n.id]);commit()});
svg.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.ctrlKey?Math.exp(-e.deltaY*.01):e.deltaY<0?1.12:1/1.12,e.clientX,e.clientY)},{passive:false});
addEventListener('keydown',e=>{if($('#menu').open)return;const typing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName),m=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
if(typing){if(k=='escape')e.target.blur();return}
if(e.code=='Space'){e.preventDefault();space=true;return}
if(m&&k=='z'){e.preventDefault();e.shiftKey?redo():undo()}else if(m&&k=='y'){e.preventDefault();redo()}
else if(m&&k=='c')copy();else if(m&&k=='v')paste();else if(m&&k=='d'){e.preventDefault();copy();paste()}
else if(m&&k=='a'){e.preventDefault();setSel(S.nodes.map(n=>n.id))}else if(m&&k=='s'){e.preventDefault();ACT.json()}
else if(k=='delete'||k=='backspace')del();else if(k=='escape'){linkFrom=null;setSel([])}
else if(k=='f')fit();else if(k=='v')setTool('select');else if(k=='h')setTool('pan');else if(k=='c')setTool('link');
else if(k=='+'||k=='=')zoomC(1.25);else if(k=='-')zoomC(.8);
else if(k.startsWith('arrow')&&sel.size){e.preventDefault();const d=e.shiftKey?100:20,[dx,dy]={arrowleft:[-d,0],arrowright:[d,0],arrowup:[0,-d],arrowdown:[0,d]}[k];sel.forEach(i=>{const n=N(i);n.x+=dx;n.y+=dy});commit()}});
addEventListener('keyup',e=>{if(e.code=='Space')space=false});
addEventListener('resize',draw);
/* ---------- экспорт / импорт ---------- */
function dl(b,name){const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
function svgStr(){const P=PAL[cfg.bg],b=bbox(),p=50,w=Math.round(b.w+2*p),h=Math.round(b.h+2*p+(cfg.sig?24:0)),x=b.x-p,y=b.y-p;
return{w,h,s:`<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" font-family="Inter,'Segoe UI',Arial,sans-serif">${defs(P)}${P.bg!='transparent'?`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${P.bg}"/>`:''}${body(true)}${cfg.sig?`<text x="${x+w-12}" y="${y+h-10}" text-anchor="end" font-size="12" fill="${P.edge}" opacity=".8">FlowForge Studio • github.com/smol0901-jpg</text>`:''}</svg>`}}
function canvas(sc,white){return new Promise((res,rej)=>{NM=new Map(S.nodes.map(n=>[n.id,n]));const{s,w,h}=svgStr(),im=new Image(),k=Math.min(sc,8000/Math.max(w,h)),c=document.createElement('canvas');c.width=w*k;c.height=h*k;const x=c.getContext('2d');if(white){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)}
im.onload=()=>{x.drawImage(im,0,0,c.width,c.height);res({c,w,h})};im.onerror=()=>rej(Error('render'));im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s)})}
function importText(t){try{setDoc(JSON.parse(t.trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim()));toast(`✅ Загружено: ${S.nodes.length} блоков, ${S.edges.length} связей`)}catch(e){toast('❌ Ошибка JSON: '+e.message)}}
const TYPES_DOC='terminal (овал: начало/конец), process (действие), decision (ромб: условие, 2 выхода «Да»/«Нет» в label связи), io (ввод/вывод), data (данные/БД), sub (подпроцесс), note (заметка)';
const tplObj=()=>({format:'flowforge',version:'2.0',_instructions:{task:'ЗАМЕНИТЕ НА ВАШУ ЗАДАЧУ',types:TYPES_DOC,rules:['id — уникальные строки','x,y можно НЕ указывать: схема раскладывается автоматически','edges: {from,to,label?}; color — необязательный #hex'],example_node:{id:'n1',type:'terminal',text:'Начало'},example_edge:{from:'n1',to:'n2',label:'Да'}},nodes:[],edges:[]});
const promptTxt=()=>`Ты — генератор блок-схем для FlowForge Studio.\n\nЗАДАЧА: ЗАМЕНИ ЭТУ СТРОКУ НА ОПИСАНИЕ ЗАДАЧИ.\n\nВерни ТОЛЬКО JSON без markdown:\n{"format":"flowforge","version":"2.0","nodes":[{"id":"n1","type":"terminal","text":"Начало"}],"edges":[{"from":"n1","to":"n2","label":"Да"}]}\n\nТипы: ${TYPES_DOC}.\nКоординаты x,y не нужны — раскладка автоматическая. У decision — две исходящие связи с label «Да»/«Нет».`;
const ACT={undo,redo,fit,del,zin:()=>zoomC(1.25),zout:()=>zoomC(.8),menu:()=>$('#menu').showModal(),
dup(){copy();paste()},rev(){const e=S.edges.find(x=>x.id==selE);if(e){[e.from,e.to]=[e.to,e.from];commit()}},resetc(){sel.forEach(i=>delete N(i).color);commit();insp()},
bg(){const k=Object.keys(PAL);cfg.bg=k[(k.indexOf(cfg.bg)+1)%k.length];cfgSave();$('#bg').value=cfg.bg;draw();toast('Фон: '+BGN[cfg.bg])},
new(){S.nodes=[];S.edges=[];sel=new Set();commit();toast('Новая схема (Ctrl+Z — вернуть)')},demo,tb:()=>layout('TB'),lr:()=>layout('LR'),open:()=>$('#fi').click(),
json:()=>dl(new Blob([JSON.stringify(ser(true),null,2)],{type:'application/json'}),`flowforge-${stamp()}.json`),
paste(){$('#pasteBox').hidden=$('#pasteGo').hidden=false;$('#pasteBox').focus()},tpl:()=>dl(new Blob([JSON.stringify(tplObj(),null,2)],{type:'application/json'}),'flowforge-template.json'),
prompt(){navigator.clipboard.writeText(promptTxt()).then(()=>toast('📋 Промпт скопирован'),()=>toast('Не удалось скопировать'))},
async png(){if(!S.nodes.length)return toast('Схема пуста');const{c}=await canvas(+cfg.sc);c.toBlob(b=>dl(b,`flowforge-${stamp()}.png`))},
svg(){NM=new Map(S.nodes.map(n=>[n.id,n]));dl(new Blob([svgStr().s],{type:'image/svg+xml'}),`flowforge-${stamp()}.svg`)},
async pdf(){if(!window.jspdf)return toast('PDF: нужна сеть для jsPDF');const{c,w,h}=await canvas(2,true),d=new jspdf.jsPDF({orientation:w>h?'l':'p',unit:'px',format:[w,h]});d.addImage(c.toDataURL('image/png'),'PNG',0,0,w,h);d.save(`flowforge-${stamp()}.pdf`)},
async share(){const{c}=await canvas(2);c.toBlob(b=>{const f=new File([b],'flowforge.png',{type:'image/png'});navigator.canShare&&navigator.canShare({files:[f]})?navigator.share({files:[f]}).catch(()=>{}):dl(b,'flowforge.png')})},
install(){window.dp&&window.dp.prompt()}};
document.addEventListener('click',e=>{const b=e.target.closest('[data-a],[data-t],[data-add]');if(!b)return;
if(b.dataset.t)return setTool(b.dataset.t);if(b.dataset.add)return addFromPalette(b.dataset.add);
const a=b.dataset.a;if(a=='paste')e.preventDefault();const r=ACT[a]&&ACT[a]();if(r&&r.catch)r.catch(()=>toast('❌ Ошибка экспорта'))});
$('#pasteGo').onclick=e=>{e.preventDefault();importText($('#pasteBox').value);$('#pasteBox').value='';$('#menu').close()};
$('#fi').onchange=e=>{const f=e.target.files[0];if(f)f.text().then(importText);e.target.value=''};
addEventListener('dragover',e=>e.preventDefault());addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)f.text().then(importText)});
$('#bg').innerHTML=Object.keys(PAL).map(k=>`<option value="${k}">${BGN[k]}`).join('');
$('#bg').value=cfg.bg;$('#sc').value=cfg.sc;$('#snap').checked=cfg.snap;$('#sig').checked=cfg.sig;
$('#bg').onchange=e=>{cfg.bg=e.target.value;cfgSave();draw()};$('#sc').onchange=e=>{cfg.sc=+e.target.value;cfgSave()};
$('#snap').onchange=e=>{cfg.snap=e.target.checked;cfgSave()};$('#sig').onchange=e=>{cfg.sig=e.target.checked;cfgSave()};
addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.dp=e;$('#inst').hidden=false});
addEventListener('appinstalled',()=>{$('#inst').hidden=true;toast('✅ Установлено')});
if('serviceWorker' in navigator&&location.protocol!='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
/* ---------- старт ---------- */
const saved=LS('ffDoc',null);
if(saved&&Array.isArray(saved.nodes)&&saved.nodes.length){try{setDoc(saved)}catch{demo()}}else demo();
setTool('select');
