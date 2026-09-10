import React,{useMemo,useState} from 'react';
import {Swords,Clock3} from 'lucide-react';
import {ACTION_KINDS,OUTCOMES,effectLabel,type CombatEvent} from '@/lib/combat';

export default function CombatLog({events,compact=false}:{events:CombatEvent[];compact?:boolean}){
 const [all,setAll]=useState(false);
 const shown=useMemo(()=>compact&&!all?events.slice(-30):events,[events,compact,all]);
 return <section className="combat-log" aria-label="Registro delle azioni">
  <div className="row-between"><h3><Swords size={18}/>Registro delle azioni</h3><span className="count">{events.length} eventi</span></div>
  {!events.length&&<p className="help-text">Le azioni registrate e i cambi di turno compariranno qui, nell’ordine in cui sono avvenuti.</p>}
  {compact&&events.length>30&&<button className="text-button" onClick={()=>setAll(v=>!v)}>{all?'Mostra gli ultimi 30 eventi':'Mostra l’intero registro'}</button>}
  <ol className="combat-log-events">{shown.map(e=><li key={e.id} className={e.kind==='turn'?'combat-log-turn':''}>
   <div className="combat-event-index"><span>R{e.round}</span><Clock3 size={12}/></div>
   <div className="combat-event-body"><div className="combat-event-meta"><span>{e.kind==='turn'?'CAMBIO TURNO':ACTION_KINDS[e.kind as keyof typeof ACTION_KINDS]||'PREPARAZIONE'}</span>{e.kind!=='turn'&&e.turnName&&<span>Turno di {e.turnName}</span>}<time dateTime={new Date(e.at).toISOString()}>{new Date(e.at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</time></div>
    <h4>{e.kind==='turn'?e.label:<><strong>{e.sourceName}</strong> · {e.label}</>}</h4>
    {!!e.targets.length&&<p className="combat-targets">Bersagli: {e.targets.join(', ')}</p>}
    {(e.outcome||e.roll||e.damageType)&&<div className="combat-outcome">{e.outcome&&<span>{OUTCOMES[e.outcome as keyof typeof OUTCOMES]||e.outcome}</span>}{e.roll&&<span>Tiro: {e.roll}</span>}{e.damageType&&<span>{e.damageType}</span>}</div>}
    {!!e.effects.length&&<ul>{e.effects.map((effect,i)=><li key={i}>{effectLabel(effect)}</li>)}</ul>}
    {e.detail&&<p className="combat-event-detail">{e.detail}</p>}
   </div>
  </li>)}</ol>
 </section>;
}
