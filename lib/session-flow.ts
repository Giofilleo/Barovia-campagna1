/** A session plan lives inside a private DM page, so revisions and backups travel with it. */
export type FlowNode={id:string;title:string;notes:string;kind:'scene'|'decision'|'note'|'outcome';x:number;y:number;links:string[]};
export type FlowEdge={id:string;from:string;to:string;condition:string};
export type SessionFlow={schema:1;nodes:FlowNode[];edges:FlowEdge[]};
export const MAX_FLOW_NODES=1000;
export const MAX_FLOW_EDGES=3000;
// Leave room for the surrounding page within the API's 2.5-million-character request limit.
export const MAX_FLOW_BYTES=2_000_000;
const flowEncoder=new TextEncoder();

/** Shared by the editor and API. Count encoded JSON, including escaped text and non-ASCII characters. */
export function sessionFlowSizeError(flow:SessionFlow):string|null{
 return flowEncoder.encode(JSON.stringify(flow)).byteLength>MAX_FLOW_BYTES
  ?'Il flusso supera il limite complessivo di 2 MB. Riduci le note o suddividi la preparazione in più flussi. Il contenuto non viene troncato.'
  :null;
}

function text(value:unknown,max:number,label:string,required=false){
 if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error(`${label}: inserisci ${required?'da 1 a':'al massimo'} ${max.toLocaleString('it-IT')} caratteri.`);
 return value;
}
function coordinate(value:unknown){
 if(typeof value!=='number'||!Number.isFinite(value)||!Number.isSafeInteger(Math.round(value)))throw new Error('La posizione di una scheda non è valida.');
 return Math.round(value);
}
/** Reject malformed/oversized plans rather than silently trimming away preparation. */
export function cleanSessionFlow(value:unknown):SessionFlow{
 const raw=value as any;
 if(!raw||raw.schema!==1||!Array.isArray(raw.nodes)||!Array.isArray(raw.edges))throw new Error('Il flusso di sessione non è valido.');
 if(raw.nodes.length>MAX_FLOW_NODES)throw new Error('Un flusso può contenere al massimo 1.000 schede.');
 if(raw.edges.length>MAX_FLOW_EDGES)throw new Error('Un flusso può contenere al massimo 3.000 collegamenti condizionali.');
 const ids=new Set<string>();
 const nodes:FlowNode[]=raw.nodes.map((n:any)=>{
  const id=text(n?.id,80,'Identificativo della scheda',true);
  if(ids.has(id))throw new Error('Ogni scheda deve avere un identificativo distinto.');
  ids.add(id);
  if(!['scene','decision','note','outcome'].includes(n.kind))throw new Error('Il tipo di scheda non è valido.');
  if(!Array.isArray(n.links)||n.links.length>100)throw new Error('Una scheda può collegare al massimo 100 pagine.');
  return {id,kind:n.kind,title:text(n.title,160,'Titolo della scheda',true),notes:text(n.notes,6000,'Note della scheda'),x:coordinate(n.x),y:coordinate(n.y),links:Array.from(new Set<string>(n.links.map((v:unknown)=>text(v,80,'Collegamento alla pagina',true))))};
 });
 const edgeIds=new Set<string>();
 const edges:FlowEdge[]=raw.edges.map((e:any)=>{
  const id=text(e?.id,80,'Identificativo del collegamento',true);
  if(edgeIds.has(id))throw new Error('Ogni collegamento deve avere un identificativo distinto.');
  edgeIds.add(id);
  const from=text(e.from,80,'Scheda di partenza',true),to=text(e.to,80,'Scheda di arrivo',true);
  if(!ids.has(from)||!ids.has(to))throw new Error('Un collegamento fa riferimento a una scheda non presente nel flusso.');
  return {id,from,to,condition:text(e.condition,500,'Condizione del collegamento',true)};
 });
 const flow:SessionFlow={schema:1,nodes,edges};
 const sizeError=sessionFlowSizeError(flow);if(sizeError)throw new Error(sizeError);
 return flow;
}

export function flowPageLinks(flow:SessionFlow){return Array.from(new Set(flow.nodes.flatMap(n=>n.links)));}
