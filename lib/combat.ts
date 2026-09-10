import type {Combatant,DMBoard} from './campaign';

export const ACTION_KINDS={attack:'Attacco',spell:'Magia',damage:'Danno',heal:'Cura',condition:'Condizione',action:'Altra azione',correction:'Correzione'};
export const OUTCOMES={hit:'Colpito',miss:'Mancato',success:'Riuscito',failure:'Fallito',other:'Annotato'};
export type CombatAction={kind:keyof typeof ACTION_KINDS;sourceId:string;sourceName:string;label:string;outcome:keyof typeof OUTCOMES;roll:string;damageType:string;detail:string;targets:string[];amount?:number;requested?:{id:string;kind:'damage'|'heal';amount:number}[]};
export type CombatEffect={targetId:string;targetName:string;kind:'damage'|'heal'|'condition'|'join'|'leave'|'edit';amount?:number;requested?:number;before?:string;after?:string};
export type CombatEvent={id:string;at:number;round:number;turnName:string;kind:string;sourceName:string;label:string;outcome?:string;roll?:string;damageType?:string;detail?:string;targets:string[];effects:CombatEffect[]};
export type CombatHistory={id:string;startedAt:number;minutes:number;events:CombatEvent[]};
export const MAX_COMBAT_EVENTS=2000;
const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
export function cleanCombatants(raw:unknown):Combatant[]{
 if(!Array.isArray(raw)||raw.length>100)throw new Error('Usa al massimo 100 combattenti.');
 const num=(v:unknown,min:number,max:number,otherwise:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):otherwise;
 const result=raw.map(c=>{if(!c||typeof c!=='object')throw new Error('Combattente non valido.');const maxHp=num(c.maxHp,1,100000,10);return{id:text(c.id,80)||crypto.randomUUID(),name:text(c.name,100)||'Combattente',initiative:num(c.initiative,-100,100,0),ac:num(c.ac,0,100,10),hp:num(c.hp,0,maxHp,Math.min(10,maxHp)),maxHp,conditions:text(c.conditions,250),notes:text(c.notes,1000)};});
 if(new Set(result.map(c=>c.id)).size!==result.length)throw new Error('Ogni combattente deve avere un identificativo distinto.');
 return result;
}
/** Removing the active combatant follows initiative order, including round rollover. */
export function removeCombatant(board:DMBoard,id:string):DMBoard{
 const sorted=[...board.combatants].sort((a,b)=>b.initiative-a.initiative||a.name.localeCompare(b.name));
 const current=sorted.findIndex(c=>c.id===(board.turnId||sorted[0]?.id));
 const combatants=board.combatants.filter(c=>c.id!==id);
 if(current<0||sorted[current].id!==id)return {...board,combatants};
 const successor=combatants.length?sorted[(current+1)%sorted.length]:undefined;
 return {...board,combatants,turnId:successor?.id||'',round:board.round+(successor&&current===sorted.length-1?1:0)};
}
/** Derive consequences from persisted values, never from a client-written log. */
export function recordCombatChange(previous:DMBoard,next:DMBoard,input:unknown,minutes:number):DMBoard{
 const at=Date.now();const current=previous.combatants.find(c=>c.id===previous.turnId)||[...previous.combatants].sort((a,b)=>b.initiative-a.initiative||a.name.localeCompare(b.name))[0];
 const log:CombatHistory=previous.log?{...previous.log,events:[...previous.log.events]}:{id:crypto.randomUUID(),startedAt:at,minutes,events:[]};
 const event=(values:Partial<CombatEvent>):CombatEvent=>({id:crypto.randomUUID(),at,round:previous.round,turnName:current?.name||'',kind:'setup',sourceName:'DM',label:'Preparazione incontro',targets:[],effects:[],...values});
 if(!previous.log&&previous.combatants.length)log.events.push(event({label:'Inizio registrazione dell’incontro esistente',detail:'Le azioni precedenti a questo aggiornamento non sono ricostruibili.',effects:previous.combatants.map(c=>({targetId:c.id,targetName:c.name,kind:'join',after:c.conditions}))}));
 const effects:CombatEffect[]=[];
 for(const c of next.combatants){const old=previous.combatants.find(x=>x.id===c.id);
  if(!old){effects.push({targetId:c.id,targetName:c.name,kind:'join',after:c.conditions});continue;}
  if(c.hp!==old.hp)effects.push({targetId:c.id,targetName:c.name,kind:c.hp<old.hp?'damage':'heal',amount:Math.abs(c.hp-old.hp)});
  if(c.conditions!==old.conditions)effects.push({targetId:c.id,targetName:c.name,kind:'condition',before:old.conditions,after:c.conditions});
  if(c.name!==old.name||c.initiative!==old.initiative||c.ac!==old.ac||c.maxHp!==old.maxHp)effects.push({targetId:c.id,targetName:c.name,kind:'edit',before:old.name,after:c.name});
 }
 for(const c of previous.combatants)if(!next.combatants.some(x=>x.id===c.id))effects.push({targetId:c.id,targetName:c.name,kind:'leave'});
 const needsSource=effects.some(e=>['damage','heal','condition'].includes(e.kind));
 const a=input&&typeof input==='object'?input as Record<string,any>:null;
 if(needsSource&&(!a||!text(a.label,160)||!text(a.sourceId,80)))throw new Error('Indica la fonte e il nome dell’attacco, della magia o dell’effetto.');
 if(a){
  if(typeof a.detail==='string'&&a.detail.length>2000)throw new Error('La descrizione supera 2.000 caratteri: abbreviala prima di salvare.');
  if(Array.isArray(a.requested))for(const requested of a.requested){
   const old=previous.combatants.find(c=>c.id===requested.id),after=next.combatants.find(c=>c.id===requested.id);
   if(!old||!after||!['damage','heal'].includes(requested.kind)||!Number.isFinite(requested.amount)||requested.amount<0||requested.amount>100000)throw new Error('Quantità o bersaglio non valido.');
   const expected=requested.kind==='damage'?Math.max(0,old.hp-requested.amount):Math.min(after.maxHp,old.hp+requested.amount);
   if(after.hp!==expected)throw new Error('I punti ferita non corrispondono alla quantità indicata.');
   const effect=effects.find(e=>e.targetId===old.id&&e.kind===requested.kind);
   if(effect)effect.requested=requested.amount;else effects.push({targetId:old.id,targetName:after.name,kind:requested.kind,amount:0,requested:requested.amount});
  }
  if(!Object.hasOwn(ACTION_KINDS,a.kind)||!Object.hasOwn(OUTCOMES,a.outcome))throw new Error('Tipo di azione o esito non valido.');
  const source=previous.combatants.find(c=>c.id===a.sourceId)||next.combatants.find(c=>c.id===a.sourceId);
  const sourceName=source?.name||(a.sourceId==='_environment'?'Ambiente':a.sourceId==='_other'?text(a.sourceName,100):'');
  if(!sourceName||!text(a.label,160))throw new Error('Indica chi agisce e quale azione compie.');
  if(a.outcome==='miss'&&needsSource)throw new Error('Un attacco mancato non modifica PF o condizioni. Registra separatamente eventuali altri effetti.');
  const roster=[...previous.combatants,...next.combatants];const targets=Array.isArray(a.targets)?a.targets.map((id:unknown)=>roster.find(c=>c.id===id)?.name).filter((n:unknown):n is string=>typeof n==='string'):[];
  log.events.push(event({kind:a.kind,sourceName,label:text(a.label,160),outcome:a.outcome,roll:text(a.roll,100),damageType:text(a.damageType,80),detail:text(a.detail,2000),targets:Array.from(new Set(targets)),effects}));
 }else if(effects.length)log.events.push(event({effects}));
 if(next.round!==previous.round||next.turnId!==previous.turnId){const turn=next.combatants.find(c=>c.id===next.turnId);log.events.push(event({round:next.round,kind:'turn',label:turn?'Turno di '+turn.name:'Ordine dei turni aggiornato',turnName:turn?.name||''}));}
 if(log.events.length>MAX_COMBAT_EVENTS)throw new Error('Il registro ha raggiunto 2.000 eventi. Archivia questa parte prima di proseguire. Nessuna azione è stata cancellata.');
 if(JSON.stringify(log).length>1200000)throw new Error('Questo registro è molto lungo. Archivia questa parte prima di proseguire: le azioni già registrate restano conservate.');
 return {...next,log};
}
export function effectLabel(e:CombatEffect){
 if(e.kind==='damage')return `${e.targetName}: −${e.amount} PF${e.requested!==undefined?' ('+e.requested+' danni dichiarati)':''}`;
 if(e.kind==='heal')return `${e.targetName}: +${e.amount} PF${e.requested!==undefined?' ('+e.requested+' PF di cura dichiarati)':''}`;
 if(e.kind==='condition')return `${e.targetName}: ${e.before||'nessuna condizione'} → ${e.after||'nessuna condizione'}`;
 if(e.kind==='join')return `${e.targetName} entra nell’incontro${e.after?' ('+e.after+')':''}`;
 if(e.kind==='leave')return `${e.targetName} esce dall’incontro`;
 return `${e.targetName}: scheda aggiornata${e.before!==e.after?' (prima: '+e.before+')':''}`;
}
