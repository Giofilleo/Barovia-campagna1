'use client';
import React,{useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,BellRing,BookOpen,Check as CheckIcon,ChevronRight,Clock3,Feather,Map,Sparkles,Swords} from 'lucide-react';
import {Choice} from './ui';
import {KINDS,dateLabel,type Entry,type State} from '@/lib/campaign';
const ICON_ORDER=['pin','event','note','character','journal','treasure','faction','map','table','combat','secret'];
function ago(at:number){
 const minutes=Math.max(0,Math.round((Date.now()-at)/60000));
 if(minutes<1)return 'poco fa';if(minutes<60)return minutes+(minutes===1?' minuto fa':' minuti fa');
 const hours=Math.round(minutes/60);if(hours<24)return hours+(hours===1?' ora fa':' ore fa');
 const days=Math.round(hours/24);if(days<30)return days+(days===1?' giorno fa':' giorni fa');
 return new Date(at).toLocaleDateString('it-IT',{day:'numeric',month:'long'});
}
function excerpt(text:string){return text.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,(_token,_id,label)=>label||'riferimento').replace(/^#+\s*/gm,'').replace(/\s+/g,' ').trim();}
export default function NewsView({state,openEntry,onSeen,busy,onNavigate}:{state:State;openEntry:(e:Entry)=>void;onSeen:(at:number)=>Promise<void>;busy:boolean;onNavigate:(view:string)=>void}){
 const [kind,setKind]=useState('all');const [limit,setLimit]=useState(30);const seen=state.user.seen||0;
 const authors=useMemo(()=>new globalThis.Map(state.users.map(u=>[u.id,u.name])),[state.users]);
 const all=useMemo(()=>state.records.filter(r=>r.kind!=='folder').sort((a,b)=>b.updated-a.updated),[state.records]);
 const entries=useMemo(()=>all.filter(r=>kind==='all'||r.kind===kind),[all,kind]);
 const fresh=entries.filter(r=>r.updated>seen&&r.editor!==state.user.id);const older=entries.filter(r=>!(r.updated>seen&&r.editor!==state.user.id));
 const newest=all[0]?.updated||Date.now();const journal=useMemo(()=>all.filter(r=>r.kind==='journal').sort((a,b)=>(b.data.session||0)-(a.data.session||0)||b.updated-a.updated)[0],[all]);
 const combat=useMemo(()=>all.filter(r=>r.kind==='combat').sort((a,b)=>(b.data.minutes||0)-(a.data.minutes||0)||b.updated-a.updated)[0],[all]);
 const renderRows=(rows:Entry[],isNew:boolean)=>rows.map(r=>{
  const image=r.data.images?.[0]?.id||(r.kind==='character'?r.data.image:null);const Icon=r.kind==='combat'?Swords:r.kind==='journal'?BookOpen:r.kind==='pin'||r.kind==='map'?Map:Feather;
  return <button className={'news-row'+(isNew?' unread':'')} key={r.id} onClick={()=>openEntry(r)}>
   <span className={'news-illustration '+(image?'has-image':'')} aria-hidden="true">{image?<img src={'/api/media/'+image} alt="" loading="lazy" decoding="async"/>:<Icon size={21} strokeWidth={1.3}/>}</span>
   <span className="news-body"><span className="news-top"><span className="news-kind">{KINDS[r.kind].label}</span>{isNew&&<span className="news-unread-dot">Da leggere</span>}</span><strong className="news-title">{r.title}</strong>{r.body&&<span className="news-excerpt">{excerpt(r.body).slice(0,140)}</span>}<span className="news-meta">{authors.get(r.editor)||'qualcuno'}<i/> {ago(r.updated)}</span></span><ChevronRight size={17}/>
  </button>;
 });
 return <div className="content-page news-page">
  <header className="chronicle-welcome"><div><span className="eyebrow">TRA UNA SESSIONE E L’ALTRA</span><h1>Il filo della<br/><em>vostra storia.</em></h1><p>Ritrova l’ultimo capitolo, rileggi una scoperta, aggiungi ciò che non vuoi dimenticare.</p></div><div className="welcome-index"><span>IL TEMPO A BAROVIA</span><strong>{dateLabel(state.settings.minutes,state.settings.months)}</strong><button onClick={()=>onNavigate('map')}>Torna nell’atlante<ArrowUpRight size={15}/></button></div></header>
  <div className="chronicle-feature-grid">
   <section className="latest-chapter"><img className="chapter-atlas" src={journal?.data.images?.[0]?.id?'/api/media/'+journal.data.images[0].id:'/barovia-map.webp'} alt="" decoding="async"/><div className="chapter-shade"/><div className="chapter-content"><span className="eyebrow"><BookOpen size={15}/>{journal?'L’ULTIMA SESSIONE':'IL DIARIO DEL GRUPPO'}</span>{journal?<><span className="chapter-number">CAPITOLO {String(journal.data.session||1).padStart(2,'0')}</span><h2>{journal.title}</h2><p>{excerpt(journal.body).slice(0,190)||'Una tappa della campagna da rileggere e completare insieme.'}</p><button className="btn primary" onClick={()=>openEntry(journal)}>Riprendi il racconto<ArrowRight size={17}/></button></>:<><h2>Le Nebbie non<br/>trattengono i ricordi.</h2><p>Il diario raccoglie ciò che accade, sessione dopo sessione.</p><button className="btn primary" onClick={()=>onNavigate('journal')}>Apri il diario<ArrowRight size={17}/></button></>}</div></section>
   <aside className="chronicle-side"><section className="latest-battle"><div className="row-between"><span className="eyebrow">DAL CAMPO ALLA CRONACA</span><Swords size={24} strokeWidth={1.2}/></div><h2>{combat?combat.title:'Le battaglie, ricordate.'}</h2><p>{combat?excerpt(combat.body).slice(0,125)||'Le azioni e le conseguenze di questo incontro sono nel registro.':'I combattimenti condivisi dal DM diventano parte della storia del gruppo.'}</p>{combat&&<span className="latest-battle-meta">{combat.data.rounds||1} round · {dateLabel(combat.data.minutes||0,state.settings.months)}</span>}<button className="text-button" onClick={()=>combat?openEntry(combat):onNavigate('combat')}>{combat?'Leggi il resoconto':'Esplora i Combat Log'}<ArrowUpRight size={16}/></button></section><nav className="chronicle-shortcuts" aria-label="Riprendi la campagna"><button onClick={()=>onNavigate('journal')}><BookOpen size={18}/><span>Il diario<span>Tutti i capitoli del viaggio</span></span><ChevronRight size={15}/></button><button onClick={()=>onNavigate('character')}><Feather size={18}/><span>Il glossario<span>Volti, luoghi e scoperte</span></span><ChevronRight size={15}/></button></nav></aside>
  </div>
  <div className="news-feed-heading"><div><span className="eyebrow">L’ARCHIVIO SI ARRICCHISCE</span><h2>Novità dalla campagna</h2></div><button className="btn outline" disabled={busy||!fresh.length||kind!=='all'} onClick={()=>void onSeen(newest)}><CheckIcon size={16}/>Segna tutto come letto</button></div>
  <div className="collection-toolbar news-filterbar"><span className="outlined-badge"><BellRing size={15}/>{fresh.length?fresh.length+(fresh.length===1?' voce nuova':' voci nuove'):'Sei in pari'}</span><Choice label="Tipo di contenuto" value={kind} onChange={v=>{setKind(v);setLimit(30);}} options={[{value:'all',label:'Tutti i contenuti'},...ICON_ORDER.filter(k=>all.some(r=>r.kind===k)).map(k=>({value:k,label:KINDS[k as keyof typeof KINDS].plural}))]}/><span className="muted small">{seen?'Segnalibro: '+ago(seen):'Il tuo primo sguardo all’archivio'}</span></div>
  {kind!=='all'&&<p className="help-text">Torna a «Tutti i contenuti» per segnare lette tutte le novità. Il filtro non modifica il segnalibro.</p>}
  {!!fresh.length&&<section className="news-block"><div className="news-block-head"><Sparkles size={15}/><span className="eyebrow">DA LEGGERE</span><span className="rule"/></div><div className="news-list">{renderRows(fresh.slice(0,limit),true)}</div>{fresh.length>limit&&<button className="text-button news-show-more" onClick={()=>setLimit(n=>n+30)}>Mostra altre novità ({fresh.length-limit})<ChevronRight size={15}/></button>}</section>}
  <section className="news-block"><div className="news-block-head"><Clock3 size={15}/><span className="eyebrow">{fresh.length?'GIÀ VISTE':'CRONOLOGIA DELLE MODIFICHE'}</span><span className="rule"/></div>{older.length?<><div className="news-list">{renderRows(older.slice(0,limit),false)}</div>{older.length>limit&&<button className="text-button news-show-more" onClick={()=>setLimit(n=>n+30)}>Sfoglia altre modifiche<ChevronRight size={15}/></button>}</>:<div className="news-quiet"><Feather size={25} strokeWidth={1}/><p>{fresh.length?'Le nuove pagine aspettano di essere lette.':'Le prossime scoperte del gruppo compariranno qui.'}</p></div>}</section>
  <p className="page-footnote">Le novità sono personali e includono solo le pagine che puoi leggere. Una modifica fatta da un compagno resta in evidenza finché non la segni come letta.</p>
 </div>;
}
