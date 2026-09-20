import './combat-reader.css';
import React,{useId,useMemo,useState} from 'react';
import {ArrowDown,ArrowRight,ArrowUp,BookOpen,Check,ChevronDown,ChevronUp,Clock3,Heart,RotateCcw,Search,Settings2,Sparkles,Swords,Target,Users,X} from 'lucide-react';
import {ACTION_KINDS,OUTCOMES,effectLabel,type CombatEffect,type CombatEvent} from '@/lib/combat';

const PAGE_SIZE=50;
const RECENT_SIZE=12;
const technical=(event:CombatEvent)=>event.kind==='turn'||event.kind==='setup';
const number=(value:number)=>value.toLocaleString('it-IT',{maximumFractionDigits:2});
const amount=(effect:CombatEffect)=>typeof effect.amount==='number'&&Number.isFinite(effect.amount)?effect.amount:0;
const kindLabel=(event:CombatEvent)=>ACTION_KINDS[event.kind as keyof typeof ACTION_KINDS]||(event.kind==='turn'?'Cambio turno':'Preparazione');
const outcomeLabel=(event:CombatEvent)=>OUTCOMES[event.outcome as keyof typeof OUTCOMES]||event.outcome;
const searchable=(event:CombatEvent)=>[event.sourceName,event.label,event.detail,event.turnName,event.roll,event.damageType,kindLabel(event),outcomeLabel(event),...event.targets,...event.effects.map(effectLabel)].filter(Boolean).join(' ').toLocaleLowerCase('it');
function totals(events:CombatEvent[]){return events.reduce((sum,event)=>{
 if(!technical(event))sum.actions++;
 if(event.outcome==='miss'||event.outcome==='failure')sum.failed++;
 for(const effect of event.effects){if(effect.kind==='damage')sum.damage+=amount(effect);if(effect.kind==='heal')sum.healing+=amount(effect);if(effect.kind==='condition')sum.conditions++;}
 return sum;
},{actions:0,damage:0,healing:0,failed:0,conditions:0});}
type IndexedEvent={event:CombatEvent;index:number};
type Chapter={id:string;round:number;revisited:boolean;rows:IndexedEvent[]};
/** Group the original sequence before filtering: a later return to a round is a separate chapter. */
function chapters(events:CombatEvent[]):Chapter[]{
 const result:Chapter[]=[];const visited=new Set<number>();
 events.forEach((event,index)=>{let chapter=result[result.length-1];if(!chapter||chapter.round!==event.round){chapter={id:event.id+':'+index,round:event.round,revisited:visited.has(event.round),rows:[]};result.push(chapter);visited.add(event.round);}chapter.rows.push({event,index});});
 return result;
}
function EventIcon({kind}:{kind:string}){const Icon=kind==='spell'?Sparkles:kind==='heal'?Heart:kind==='attack'||kind==='damage'?Swords:kind==='condition'?Target:kind==='correction'?RotateCcw:kind==='turn'?Clock3:kind==='setup'?Users:BookOpen;return <Icon size={16} aria-hidden="true"/>;}
function EventTime({at}:{at:number}){const date=new Date(at);return Number.isNaN(date.getTime())?null:<time dateTime={date.toISOString()} title={date.toLocaleString('it-IT')}>{date.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</time>;}
function Consequence({effect}:{effect:CombatEffect}){
 if(effect.kind==='damage'||effect.kind==='heal')return <li className={'battle-effect battle-effect--'+effect.kind}>
  <span className="battle-effect-value">{effect.kind==='damage'?<ArrowDown size={14}/>:<ArrowUp size={14}/>}<strong>{number(amount(effect))}</strong><small>PF</small></span>
  <span><strong>{effect.targetName}</strong>{effect.requested!==undefined&&<small>{number(effect.requested)} {effect.kind==='damage'?'danni dichiarati':'PF di cura dichiarati'}{effect.requested!==amount(effect)?' · applicati '+number(amount(effect))+' PF':''}</small>}</span>
 </li>;
 if(effect.kind==='condition')return <li className="battle-effect battle-effect--condition"><Target size={16} aria-hidden="true"/><span><strong>{effect.targetName}</strong><span className="battle-condition-change"><span>{effect.before||'Nessuna condizione'}</span><ArrowRight size={12} aria-label="diventa"/><b>{effect.after||'Nessuna condizione'}</b></span></span></li>;
 return <li className="battle-effect battle-effect--note"><Users size={14} aria-hidden="true"/><span>{effectLabel(effect)}</span></li>;
}
function EventCard({row}:{row:IndexedEvent}){
 const e=row.event;
 return <li className={'battle-event '+(technical(e)?'battle-event--technical ':'')+(e.kind==='correction'?'battle-event--correction':'')}>
  <div className="battle-event-rail"><span className={'battle-event-icon battle-event-icon--'+e.kind}><EventIcon kind={e.kind}/></span><span className="battle-event-number" title="Posizione nel registro">{String(row.index+1).padStart(2,'0')}</span></div>
  <article className="battle-event-card">
   <div className="battle-event-top"><span className="battle-kind">{kindLabel(e)}</span>{e.turnName&&e.kind!=='turn'&&<span className="battle-turn">Turno di {e.turnName}</span>}<EventTime at={e.at}/></div>
   {e.sourceName&&!technical(e)&&<p className="battle-source">{e.sourceName}</p>}
   <h4>{e.label}</h4>
   {(e.outcome||e.roll||e.damageType)&&<div className="battle-outcomes">{e.outcome&&<span className={'battle-outcome battle-outcome--'+e.outcome}>{e.outcome==='hit'||e.outcome==='success'?<Check size={12}/>:e.outcome==='miss'||e.outcome==='failure'?<X size={12}/>:null}{outcomeLabel(e)}</span>}{e.roll&&<span className="battle-roll">Tiro: <strong>{e.roll}</strong></span>}{e.damageType&&<span>{e.damageType}</span>}</div>}
   {!!e.targets.length&&<p className="battle-targets"><ArrowRight size={13} aria-hidden="true"/><span><span className="battle-sr-only">Bersagli: </span>{e.targets.join(' · ')}</span></p>}
   {!!e.effects.length&&<ul className="battle-effects" aria-label="Conseguenze registrate">{e.effects.map((effect,index)=><Consequence key={index} effect={effect}/>)}</ul>}
   {e.detail&&<p className="battle-detail">{e.detail}</p>}
  </article>
 </li>;
}
function RoundChapter({chapter,compact=false}:{chapter:Chapter;compact?:boolean}){
 const [collapsed,setCollapsed]=useState(false);const contentId=useId();const summary=totals(chapter.rows.map(row=>row.event));
 return <section className={'battle-chapter '+(collapsed?'is-collapsed':'')} aria-label={'Round '+chapter.round+(chapter.revisited?', ripresa':'')}>
  <button type="button" className="battle-chapter-heading" onClick={()=>setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-controls={contentId}>
   <span className="battle-round-number"><small>Round</small><strong>{String(chapter.round).padStart(2,'0')}</strong></span>
   <span className="battle-chapter-title"><strong>{chapter.revisited?'Ripresa del round':'Cronaca del round'}</strong><small>{summary.actions?summary.actions+' '+(summary.actions===1?'azione':'azioni'):'Preparazione e turni'}{!compact&&summary.damage>0?' · −'+number(summary.damage)+' PF':''}{!compact&&summary.healing>0?' · +'+number(summary.healing)+' PF':''}</small></span>
   <span className="battle-chapter-toggle">{collapsed?'Apri':'Chiudi'}<ChevronDown size={16}/></span>
  </button>
  <ol id={contentId} className="battle-events" hidden={collapsed}>{!collapsed&&chapter.rows.map(row=><EventCard key={row.event.id+':'+row.index} row={row}/>)}</ol>
 </section>;
}
export default function CombatLog({events,compact=false}:{events:CombatEvent[];compact?:boolean}){
 const [query,setQuery]=useState('');const [source,setSource]=useState('');const [showTechnical,setShowTechnical]=useState(false);const [limit,setLimit]=useState(PAGE_SIZE);const [recentLimit,setRecentLimit]=useState(RECENT_SIZE);const [summaryOpen,setSummaryOpen]=useState(false);
 const searchId=useId();const sourceId=useId();const summaryId=useId();
 const allChapters=useMemo(()=>chapters(events),[events]);const summary=useMemo(()=>totals(events),[events]);
 const sources=useMemo(()=>Array.from(new Set(events.filter(e=>!technical(e)).map(e=>e.sourceName).filter(Boolean))),[events]);
 const roundCount=useMemo(()=>new Set(events.map(e=>e.round)).size,[events]);
 const techCount=useMemo(()=>events.filter(technical).length,[events]);
 const filtered=useMemo(()=>{const search=query.trim().toLocaleLowerCase('it');return allChapters.map(chapter=>({...chapter,rows:chapter.rows.filter(({event})=>(showTechnical||!technical(event))&&(!source||event.sourceName===source)&&(!search||searchable(event).includes(search)))})).filter(chapter=>chapter.rows.length);},[allChapters,query,source,showTechnical]);
 const count=filtered.reduce((sum,chapter)=>sum+chapter.rows.length,0);
 const displayed=useMemo(()=>{let passed=0;const start=compact?Math.max(0,count-recentLimit):0;const end=compact?count:limit;return filtered.map(chapter=>({...chapter,rows:chapter.rows.filter(()=>{const index=passed++;return index>=start&&index<end;})})).filter(chapter=>chapter.rows.length);},[filtered,compact,count,recentLimit,limit]);
 const shownCount=displayed.reduce((sum,chapter)=>sum+chapter.rows.length,0);
 const reset=()=>{setQuery('');setSource('');setShowTechnical(false);setLimit(PAGE_SIZE);};
 const filtering=!!query.trim()||!!source;
 return <section className={'battle-reader '+(compact?'battle-reader--compact':'')} aria-label="Registro delle azioni">
  <header className="battle-reader-heading"><span className="battle-reader-seal"><Swords size={22} aria-hidden="true"/></span><div><p className="battle-eyebrow">{compact?'Incontro in corso':'Resoconto archiviato'}</p><h3>{compact?'Ultime azioni':'Registro delle azioni'}</h3></div><span className="battle-record-count">{events.length}<small>registrazioni</small></span></header>
  {!events.length?<div className="battle-empty"><BookOpen size={28} aria-hidden="true"/><h4>Nessuna azione registrata</h4><p>Attacchi, magie, condizioni e decisioni compariranno qui quando il DM li registra.</p></div>:<>
   {!compact&&<>
    <div className="battle-metrics" aria-label="Riepilogo dell’intero registro">
     <div><span><Swords size={14}/>Azioni registrate</span><strong>{number(summary.actions)}</strong><small>{summary.failed?summary.failed+' con esito mancato o fallito':'Attacchi, magie e altre azioni'}</small></div>
     <div className="battle-metric--damage"><span><ArrowDown size={14}/>PF persi</span><strong>{number(summary.damage)}</strong><small>Variazioni effettive</small></div>
     <div className="battle-metric--healing"><span><Heart size={14}/>PF recuperati</span><strong>{number(summary.healing)}</strong><small>Variazioni effettive</small></div>
     <div><span><Clock3 size={14}/>Round annotati</span><strong>{number(roundCount)}</strong><small>{sources.length} {sources.length===1?'fonte registrata':'fonti registrate'}</small></div>
    </div>
    <button type="button" className="battle-metric-explainer" aria-expanded={summaryOpen} aria-controls={summaryId} onClick={()=>setSummaryOpen(!summaryOpen)}>Come leggere questi numeri<ChevronDown size={13}/></button>
    <p id={summaryId} className="battle-metric-note" hidden={!summaryOpen}>Il riepilogo riguarda l’intero registro, anche quando usi i filtri. I PF sono quelli effettivamente tolti o recuperati, comprese eventuali correzioni: possono differire dalle quantità dichiarate nelle singole azioni. Preparazione e cambi turno non contano come azioni. Il registro conserva ciò che il DM ha annotato; non ricostruisce azioni mancanti.</p>
    <div className="battle-filters">
     <label className="battle-search" htmlFor={searchId}><Search size={17} aria-hidden="true"/><span className="battle-sr-only">Cerca nel combattimento</span><input id={searchId} type="search" placeholder="Cerca un’azione, una magia, un bersaglio…" value={query} onChange={event=>{setQuery(event.target.value);setLimit(PAGE_SIZE);}}/>{query&&<button type="button" aria-label="Cancella ricerca" onClick={()=>{setQuery('');setLimit(PAGE_SIZE);}}><X size={15}/></button>}</label>
     <label className="battle-source-filter" htmlFor={sourceId}><Users size={16} aria-hidden="true"/><span className="battle-sr-only">Filtra per fonte dell’azione</span><select id={sourceId} value={source} onChange={event=>{setSource(event.target.value);setLimit(PAGE_SIZE);}}><option value="">Tutte le fonti</option>{sources.map(name=><option value={name} key={name}>{name}</option>)}</select></label>
    </div>
   </>}
   <div className="battle-reading-controls"><label className="battle-technical-toggle"><input type="checkbox" checked={showTechnical} onChange={event=>{setShowTechnical(event.target.checked);setLimit(PAGE_SIZE);}}/><Settings2 size={14} aria-hidden="true"/><span>{compact?'Mostra cambi turno e preparazione':'Includi preparazione e cambi turno'}{!compact&&techCount>0&&<small> {techCount}</small>}</span></label>{filtering&&<button type="button" className="battle-reset" onClick={reset}><RotateCcw size={13}/>Azzera filtri</button>}</div>
   {!compact&&<p className="battle-result-count" role="status">{filtering?count+(count===1?' registrazione corrispondente':' registrazioni corrispondenti'):count+(count===1?' registrazione':' registrazioni')}{count>shownCount?' · mostrate '+shownCount:''}</p>}
   {compact&&count>recentLimit&&<button type="button" className="battle-load-previous" onClick={()=>setRecentLimit(value=>value+RECENT_SIZE)}><ChevronUp size={16}/>Mostra {Math.min(RECENT_SIZE,count-recentLimit)} registrazioni precedenti<span>{count-recentLimit} non mostrate</span></button>}
   {!count?<div className="battle-empty battle-empty--filtered"><Search size={25} aria-hidden="true"/><h4>{filtering?'Nessuna azione corrisponde ai filtri':'Nessuna azione registrata'}</h4><p>{filtering?'Prova un altro nome o una parola più breve.':'Sono presenti solo preparazione e cambi turno: puoi includerli nel registro con il controllo qui sopra.'}</p>{filtering&&<button type="button" className="battle-reset" onClick={reset}><RotateCcw size={14}/>Mostra tutte le azioni</button>}</div>:<div className="battle-chapters">{displayed.map(chapter=><RoundChapter key={chapter.id} chapter={chapter} compact={compact}/>)}</div>}
   {!compact&&count>limit&&<div className="battle-load-more"><span>Mostrate {shownCount} registrazioni su {count}</span><button type="button" onClick={()=>setLimit(value=>value+PAGE_SIZE)}>Mostra altre registrazioni<ChevronDown size={16}/><small>Altre {Math.min(PAGE_SIZE,count-limit)}</small></button></div>}
   {compact&&recentLimit>RECENT_SIZE&&count>RECENT_SIZE&&<button type="button" className="battle-reset battle-return-recent" onClick={()=>setRecentLimit(RECENT_SIZE)}>Torna alle ultime {RECENT_SIZE} registrazioni<ArrowDown size={13}/></button>}
   {!compact&&shownCount>0&&shownCount===count&&<div className="battle-endmark"><span/><BookOpen size={15} aria-hidden="true"/><span/><small>{filtering?'Fine dei risultati':'Fine del registro'}</small></div>}
  </>}
 </section>;
}
