'use client';
import React,{useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,Diamond,FileText,Flag,GitBranch,Grip,Link2,LocateFixed,Maximize2,Waypoints,ZoomIn,ZoomOut} from 'lucide-react';
import {IconButton} from './ui';
import {MAX_FLOW_EDGES,type FlowNode,type SessionFlow} from '@/lib/session-flow';
import './session-flow-canvas.css';

const W=246,H=174,MIN_ZOOM=.000001,MAX_ZOOM=2;
const KINDS={scene:{label:'Scena',icon:BookOpen},decision:{label:'Scelta',icon:Diamond},note:{label:'Nota',icon:FileText},outcome:{label:'Esito',icon:Flag}};
type Camera={x:number;y:number;zoom:number};
type Gesture={pointerId:number;px:number;py:number;lastX:number;lastY:number;moved:boolean;camera:Camera;node?:{id:string;x:number;y:number}};
type Props={flow:SessionFlow;selectedNode:string;selectedEdge:string;disabled:boolean;onSelectNode:(id:string,openDetails?:boolean)=>void;onSelectEdge:(id:string)=>void;onMoveNode:(id:string,x:number,y:number)=>void;onConnect:(id:string)=>void;focusNodeId?:string;focusRequest?:number;onViewportCenter:(x:number,y:number)=>void};

export default function FlowCanvas(props:Props){
 const {flow,selectedNode,selectedEdge,disabled,focusNodeId,focusRequest}=props;
 const callbacks=useRef(props);callbacks.current=props;
 const viewport=useRef<HTMLDivElement>(null),gesture=useRef<Gesture|null>(null),suppressClick=useRef(false),frame=useRef(0),fitted=useRef(false);
 const [size,setSize]=useState({width:0,height:0}),[camera,setCamera]=useState<Camera>({x:500,y:320,zoom:.8}),[dragging,setDragging]=useState(false);
 const cameraRef=useRef(camera);cameraRef.current=camera;
 const marker='flow-arrow-'+useId().replace(/:/g,'');
 const nodes=useMemo(()=>new Map(flow.nodes.map(n=>[n.id,n])),[flow.nodes]);
 const edges=useMemo(()=>flow.edges.flatMap(e=>{const a=nodes.get(e.from),b=nodes.get(e.to);return a&&b?[{edge:e,a,b,geometry:geometry(a,b)}]:[];}),[flow.edges,nodes]);
 function setView(next:Camera){if(!Number.isFinite(next.x)||!Number.isFinite(next.y))return;cameraRef.current=next;setCamera(next);}
 function fit(width=size.width,height=size.height){
  if(!width||!height)return;
  const rects=flow.nodes.map(n=>({left:n.x,top:n.y,right:n.x+W,bottom:n.y+H}));
  edges.forEach(e=>rects.push({left:e.geometry.x-108,top:e.geometry.y-35,right:e.geometry.x+108,bottom:e.geometry.y+35}));
  if(!rects.length){setView({x:0,y:0,zoom:.8});return;}
  const left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top)),right=Math.max(...rects.map(r=>r.right)),bottom=Math.max(...rects.map(r=>r.bottom));
  setView({x:(left+right)/2,y:(top+bottom)/2,zoom:Math.max(MIN_ZOOM,Math.min(.9,(width-100)/Math.max(1,right-left),(height-110)/Math.max(1,bottom-top)))});
 }
 useLayoutEffect(()=>{const el=viewport.current;if(!el)return;const observer=new ResizeObserver(()=>setSize({width:el.clientWidth,height:el.clientHeight}));observer.observe(el);return()=>observer.disconnect();},[]);
 useLayoutEffect(()=>{if(!flow.nodes.length){fitted.current=false;return;}if(size.width&&size.height&&!fitted.current){fitted.current=true;fit();}},[size,flow.nodes.length]);
 useEffect(()=>{callbacks.current.onViewportCenter(camera.x,camera.y);},[camera]);
 useLayoutEffect(()=>{if(!focusRequest||!focusNodeId)return;const n=nodes.get(focusNodeId);if(n)setView({...cameraRef.current,x:n.x+W/2,y:n.y+H/2,zoom:Math.max(.65,cameraRef.current.zoom)});},[focusRequest,focusNodeId]);
 function zoomTo(zoom:number,anchor?:{x:number;y:number}){
  const c=cameraRef.current,next=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,zoom));
  const dx=(anchor?.x??size.width/2)-size.width/2,dy=(anchor?.y??size.height/2)-size.height/2;
  setView({x:c.x+dx/c.zoom-dx/next,y:c.y+dy/c.zoom-dy/next,zoom:next});
 }
 // Native non-passive wheel handling keeps all scrolling inside the map itself.
 const wheel=useRef((e:WheelEvent)=>{});
 wheel.current=e=>{if(gesture.current)return;e.preventDefault();const el=viewport.current;if(!el)return;const unit=e.deltaMode===1?16:e.deltaMode===2?el.clientHeight:1,c=cameraRef.current;
  if(e.ctrlKey||e.metaKey){const r=el.getBoundingClientRect();zoomTo(c.zoom*Math.exp(-e.deltaY*.008),{x:e.clientX-r.left,y:e.clientY-r.top});}
  else setView({...c,x:c.x+(e.shiftKey&&!e.deltaX?e.deltaY:e.deltaX)*unit/c.zoom,y:c.y+(e.shiftKey&&!e.deltaX?0:e.deltaY)*unit/c.zoom});
 };
 useEffect(()=>{const el=viewport.current;if(!el)return;const handle=(e:WheelEvent)=>wheel.current(e);el.addEventListener('wheel',handle,{passive:false});return()=>{el.removeEventListener('wheel',handle);cancelAnimationFrame(frame.current);};},[]);
 function moveCard(d:Gesture){if(!d.node||callbacks.current.disabled)return;const c=cameraRef.current;
  const x=Math.round(d.node.x+(d.lastX-d.px)/d.camera.zoom+c.x-d.camera.x),y=Math.round(d.node.y+(d.lastY-d.py)/d.camera.zoom+c.y-d.camera.y);
  if(Number.isSafeInteger(x)&&Number.isSafeInteger(y))callbacks.current.onMoveNode(d.node.id,x,y);
 }
 function autoPan(){const d=gesture.current,el=viewport.current;if(!d?.node||!d.moved||!el)return;
  const r=el.getBoundingClientRect(),margin=Math.min(65,r.width/5,r.height/5);
  const speed=(p:number,start:number,end:number)=>p<start+margin?-Math.min(18,(start+margin-p)*.25):p>end-margin?Math.min(18,(p-end+margin)*.25):0;
  const dx=speed(d.lastX,r.left,r.right),dy=speed(d.lastY,r.top,r.bottom),c=cameraRef.current;
  if(dx||dy){setView({...c,x:c.x+dx/c.zoom,y:c.y+dy/c.zoom});moveCard(d);}
  frame.current=requestAnimationFrame(autoPan);
 }
 function start(e:React.PointerEvent<HTMLElement>,n?:FlowNode){
  const el=viewport.current;if(!el||gesture.current||!e.isPrimary)return;
  const target=e.target as HTMLElement;
  if(n){if(disabled||e.button!==0||target.closest('button:not(.flow-node-content):not(.flow-node-handle)'))return;props.onSelectNode(n.id,false);}
  else if(e.button!==1&&(e.button!==0||target.closest('.flow-node,button,a,input,textarea,select')))return;
  if(!n){e.preventDefault();el.focus({preventScroll:true});}
  gesture.current={pointerId:e.pointerId,px:e.clientX,py:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,camera:{...cameraRef.current},...(n?{node:{id:n.id,x:n.x,y:n.y}}:{})};
  suppressClick.current=false;el.setPointerCapture(e.pointerId);
 }
 function move(e:React.PointerEvent<HTMLDivElement>){const d=gesture.current;if(!d||e.pointerId!==d.pointerId)return;d.lastX=e.clientX;d.lastY=e.clientY;
  const dx=e.clientX-d.px,dy=e.clientY-d.py;if(!d.moved&&Math.hypot(dx,dy)<4)return;
  if(!d.moved){d.moved=true;setDragging(true);if(d.node)frame.current=requestAnimationFrame(autoPan);}e.preventDefault();
  if(d.node)moveCard(d);else setView({...d.camera,x:d.camera.x-dx/d.camera.zoom,y:d.camera.y-dy/d.camera.zoom});
 }
 function end(e:React.PointerEvent<HTMLDivElement>){const d=gesture.current;if(!d||d.pointerId!==e.pointerId)return;suppressClick.current=d.moved&&e.type==='pointerup';if(!d.moved&&d.node&&e.type==='pointerup')props.onSelectNode(d.node.id);gesture.current=null;cancelAnimationFrame(frame.current);setDragging(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
 function nodeKey(e:React.KeyboardEvent<HTMLButtonElement>,n:FlowNode){const step=e.shiftKey?8:24;if(!disabled&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();props.onMoveNode(n.id,n.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),n.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));}}
 const margin=350/camera.zoom,left=camera.x-size.width/2/camera.zoom-margin,right=camera.x+size.width/2/camera.zoom+margin,top=camera.y-size.height/2/camera.zoom-margin,bottom=camera.y+size.height/2/camera.zoom+margin;
 const visible=(x:number,y:number,w=W,h=H)=>x+w>=left&&x<=right&&y+h>=top&&y<=bottom;
 const visibleEdges=edges.filter(e=>Math.max(e.a.x+W,e.b.x+W,e.geometry.x+110)>=left&&Math.min(e.a.x,e.b.x,e.geometry.x-110)<=right&&Math.max(e.a.y+H,e.b.y+H,e.geometry.y+35)>=top&&Math.min(e.a.y,e.b.y,e.geometry.y-35)<=bottom);
 const dot=Math.max(10,30*camera.zoom);
 return <div className="flow-infinite-canvas">
  <div ref={viewport} className={'flow-infinite-viewport'+(dragging?' is-dragging':'')} role="region" aria-label="Mappa delle scene: trascina o scorri per navigare" tabIndex={0}
   style={{backgroundSize:`${dot}px ${dot}px`,backgroundPosition:`${size.width/2-camera.x*camera.zoom}px ${size.height/2-camera.y*camera.zoom}px`}}
   onPointerDownCapture={e=>{if(e.isPrimary)suppressClick.current=false;}} onPointerDown={e=>start(e)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
   onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}}
   onKeyDown={e=>{if(e.target!==e.currentTarget)return;const delta=80/camera.zoom;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setView({...camera,x:camera.x+(e.key==='ArrowRight'?delta:e.key==='ArrowLeft'?-delta:0),y:camera.y+(e.key==='ArrowDown'?delta:e.key==='ArrowUp'?-delta:0)});}}}>
   <div className="flow-infinite-world" style={{transform:`translate(${size.width/2}px,${size.height/2}px) scale(${camera.zoom})`}}>
    <svg className="flow-arrows" width="1" height="1" aria-hidden="true"><defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z"/></marker></defs>{visibleEdges.map(({edge:e,a,b})=><g key={e.id} className={selectedEdge===e.id?'selected':''}><path d={geometry({...a,x:a.x-camera.x,y:a.y-camera.y},{...b,x:b.x-camera.x,y:b.y-camera.y}).path} markerEnd={`url(#${marker})`}/></g>)}</svg>
    {visibleEdges.filter(e=>visible(e.geometry.x-99,e.geometry.y-25,198,53)).map(({edge:e,a,b,geometry:g})=><button key={e.id} className={'flow-edge-label '+(selectedEdge===e.id?'selected':'')} style={{left:g.x-camera.x-99,top:g.y-camera.y-25}} onClick={()=>props.onSelectEdge(e.id)} aria-label={`Diramazione da ${a.title} a ${b.title}: ${e.condition}`}><span>SE</span><strong>{e.condition}</strong></button>)}
    {flow.nodes.map((n,i)=>visible(n.x,n.y)||gesture.current?.node?.id===n.id?{n,i}:null).filter((v):v is {n:FlowNode;i:number}=>!!v).map(({n,i})=>{const kind=KINDS[n.kind];return <article key={n.id} className={'flow-node kind-'+n.kind+' '+(selectedNode===n.id?'selected':'')} style={{left:n.x-camera.x,top:n.y-camera.y,width:W,height:H}} onPointerDown={e=>start(e,n)}>
     <div className="flow-node-top"><span><kind.icon size={13}/>{kind.label}<b>{String(i+1).padStart(2,'0')}</b></span><button className="flow-node-handle" disabled={disabled} aria-label={'Sposta '+n.title+'. Usa anche i tasti freccia.'} onKeyDown={e=>nodeKey(e,n)}><Grip size={16}/></button></div>
     <button className="flow-node-content" onClick={()=>props.onSelectNode(n.id)} aria-pressed={selectedNode===n.id}><strong>{n.title||'Titolo da completare'}</strong><p>{n.notes||'Aggiungi note alla scheda…'}</p></button>
     <div className="flow-node-bottom"><span><Link2 size={12}/>{n.links.length?`${n.links.length} ${n.links.length===1?'pagina':'pagine'}`:'Nessuna pagina'}</span><button aria-label={'Crea diramazione da '+n.title} disabled={disabled||flow.edges.length>=MAX_FLOW_EDGES} onClick={()=>props.onConnect(n.id)}><GitBranch size={13}/>Collega</button></div>
    </article>;})}
   </div>
   {!flow.nodes.length&&<div className="flow-map-empty"><Waypoints size={32}/><strong>Nessuna scheda</strong><span>Aggiungi una scena dalla barra in alto.</span></div>}
  </div>
  <div className="flow-zoom"><IconButton label="Riduci la mappa" disabled={camera.zoom<=MIN_ZOOM} onClick={()=>zoomTo(camera.zoom/1.2)}><ZoomOut size={17}/></IconButton><span>{camera.zoom<.01?'<1':Math.round(camera.zoom*100)}%</span><IconButton label="Ingrandisci la mappa" disabled={camera.zoom>=MAX_ZOOM} onClick={()=>zoomTo(camera.zoom*1.2)}><ZoomIn size={17}/></IconButton><i/><IconButton label="Mostra tutto il flusso" onClick={()=>fit()}><Maximize2 size={16}/></IconButton>{selectedNode&&<IconButton label="Centra la scheda selezionata" onClick={()=>{const n=nodes.get(selectedNode);if(n)setView({x:n.x+W/2,y:n.y+H/2,zoom:Math.max(.65,camera.zoom)});}}><LocateFixed size={17}/></IconButton>}</div>
 </div>;
}

function geometry(from:FlowNode,to:FlowNode){
 const dx=to.x-from.x,dy=to.y-from.y;let sx:number,sy:number,ex:number,ey:number,c1x:number,c1y:number,c2x:number,c2y:number;
 if(Math.abs(dy)>Math.abs(dx)*.8){const down=dy>=0;sx=from.x+W/2;sy=from.y+(down?H:0);ex=to.x+W/2;ey=to.y+(down?0:H);const bend=Math.max(65,Math.abs(ey-sy)*.45);c1x=sx;c1y=sy+(down?bend:-bend);c2x=ex;c2y=ey+(down?-bend:bend);
  if(Math.abs(ey-sy)<75){const routeX=Math.max(from.x,to.x)+W+115,midY=(sy+ey)/2,offset=(down?1:-1)*Math.min(35,Math.abs(ey-sy)/2);return{path:`M ${sx} ${sy} C ${sx} ${sy+offset}, ${routeX} ${sy+offset}, ${routeX} ${midY} C ${routeX} ${ey-offset}, ${ex} ${ey-offset}, ${ex} ${ey}`,x:routeX,y:midY};}
 }else{const right=dx>=0;sx=from.x+(right?W:0);sy=from.y+H/2;ex=to.x+(right?0:W);ey=to.y+H/2;const bend=Math.max(65,Math.abs(ex-sx)*.45);c1x=sx+(right?bend:-bend);c1y=sy;c2x=ex+(right?-bend:bend);c2y=ey;
  if(Math.abs(ex-sx)<230){const routeY=Math.min(from.y,to.y)-48,midX=(sx+ex)/2,offset=(right?1:-1)*Math.min(65,Math.abs(ex-sx)/2);return{path:`M ${sx} ${sy} C ${sx+offset} ${sy}, ${sx+offset} ${routeY}, ${midX} ${routeY} C ${ex-offset} ${routeY}, ${ex-offset} ${ey}, ${ex} ${ey}`,x:midX,y:routeY};}
 }return{path:`M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`,x:(sx+3*c1x+3*c2x+ex)/8,y:(sy+3*c1y+3*c2y+ey)/8};
}
