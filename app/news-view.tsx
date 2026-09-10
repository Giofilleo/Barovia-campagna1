'use client';
import React,{useMemo,useState} from 'react';
import {BellRing,Check as CheckIcon,ChevronRight,Clock3,Sparkles} from 'lucide-react';
import {Choice} from './ui';
import {KINDS,type Entry,type State} from '@/lib/campaign';
const ICON_ORDER=['pin','event','note','character','journal','treasure','faction','map','table','combat','secret'];
/** Quanto tempo reale è passato, detto come lo direbbe una persona. */
function ago(at:number){
 const minutes=Math.round((Date.now()-at)/60000);
 if(minutes<1)return 'poco fa';
 if(minutes<60)return minutes+(minutes===1?' minuto fa':' minuti fa');
 const hours=Math.round(minutes/60);
 if(hours<24)return hours+(hours===1?' ora fa':' ore fa');
 const days=Math.round(hours/24);
 if(days<30)return days+(days===1?' giorno fa':' giorni fa');
 return new Date(at).toLocaleDateString('it-IT',{day:'numeric',month:'long'});
}
export default function NewsView({state,openEntry,onSeen,busy}:{state:State;openEntry:(e:Entry)=>void;onSeen:(at:number)=>Promise<void>;busy:boolean}){
 const [kind,setKind]=useState('all');
 const seen=state.user.seen||0;
 const authors=useMemo(()=>new Map(state.users.map(u=>[u.id,u.name])),[state.users]);
 const entries=useMemo(()=>state.records.filter(r=>r.kind!=='folder'&&(kind==='all'||r.kind===kind)).sort((a,b)=>b.updated-a.updated),[state.records,kind]);
 const fresh=entries.filter(r=>r.updated>seen&&r.editor!==state.user.id);
 const older=entries.filter(r=>!(r.updated>seen&&r.editor!==state.user.id)).slice(0,40);
 const newest=entries[0]?.updated||Date.now();
 const row=(r:Entry,isNew:boolean)=>
  <button className={'news-row'+(isNew?' unread':'')} key={r.id} onClick={()=>openEntry(r)}>
   <span className="news-mark" style={{background:KINDS[r.kind].color}} aria-hidden="true"/>
   <span className="news-body">
    <span className="news-top"><strong>{r.title}</strong><span className="news-kind">{KINDS[r.kind].label}</span></span>
    <span className="news-meta">{ago(r.updated)} · {authors.get(r.editor)||'qualcuno'}{r.data?.tags?.length?' · '+r.data.tags.join(' · '):''}</span>
   </span>
   <ChevronRight size={16}/>
  </button>;
 return <div className="content-page news-page">
  <div className="page-heading">
   <div><div className="eyebrow">DALL’ULTIMA VOLTA</div><h1>Novità<span className="heading-dot">.</span></h1></div>
   <button className="btn primary" disabled={busy||!fresh.length||kind!=='all'} onClick={()=>void onSeen(newest)}><CheckIcon size={17}/>Segna tutto come letto</button>
  </div>
  <div className="collection-toolbar">
   <span className="outlined-badge"><BellRing size={16}/>{fresh.length?fresh.length+(fresh.length===1?' voce nuova':' voci nuove'):'Nessuna novità'}</span>
   <Choice label="Tipo di contenuto" value={kind} onChange={setKind} options={[{value:'all',label:'Tutti i contenuti'},...ICON_ORDER.filter(k=>state.records.some(r=>r.kind===k)).map(k=>({value:k,label:KINDS[k as keyof typeof KINDS].plural}))]}/>
   <span className="muted small">{seen?'Segnalibro: '+ago(seen):'Segnalibro non ancora impostato'}</span>
  </div>
  {kind!=='all'&&<p className="help-text">Torna a «Tutti i contenuti» per segnare lette tutte le novità. Il filtro non modifica il segnalibro.</p>}
  {fresh.length>0&&<section className="news-block">
   <div className="news-block-head"><Sparkles size={16}/><span className="eyebrow">DA LEGGERE</span><span className="rule"/></div>
   <div className="news-list">{fresh.map(r=>row(r,true))}</div>
  </section>}
  <section className="news-block">
   <div className="news-block-head"><Clock3 size={16}/><span className="eyebrow">{fresh.length?'GIÀ VISTE':'CRONOLOGIA DELLE MODIFICHE'}</span><span className="rule"/></div>
   {older.length?<div className="news-list">{older.map(r=>row(r,false))}</div>:<p className="help-text">Nessuna modifica registrata.</p>}
  </section>
  <p className="page-footnote">Compaiono solo i contenuti che il tuo account può leggere, le novità evidenziano le modifiche fatte dagli altri. Il segnalibro è personale e ti segue su ogni dispositivo.</p>
 </div>;
}
