'use client';
import React,{useState} from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Tag } from 'lucide-react';
import { dateParts, toMinutes, type Settings } from '@/lib/campaign';
export function Choice({value,onChange,options,label,className='',disabled=false}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label?:string;className?:string;disabled?:boolean}){return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className={'choice '+className}><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;}
export function IconButton({label,children,active=false,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{label:string;active?:boolean}){return <Tooltip><TooltipTrigger asChild><button {...props} type="button" aria-label={label} aria-pressed={active} className={'icon-btn '+(active?'active ':'')+(props.className||'')}>{children}</button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;}
export function Check({checked,onChange,children,disabled=false}:{checked:boolean;onChange:(v:boolean)=>void;children:React.ReactNode;disabled?:boolean}){return <label className={'check-label '+(disabled?'muted':'')}><Checkbox checked={checked} disabled={disabled} onCheckedChange={v=>onChange(v===true)}/><span>{children}</span></label>;}
export function DateEditor({value,onChange,settings}:{value:number;onChange:(v:number)=>void;settings:Settings}){const p=dateParts(value);function set(k:string,v:number){const q={...p,[k]:v};onChange(Math.max(0,toMinutes(q.year,q.month,q.day,q.hour,q.minute)));}return <div className="date-editor"><label>Giorno<input type="number" min="1" max="28" value={p.day} onChange={e=>set('day',Math.max(1,Math.min(28,+e.target.value)))}/></label><label>Mese<Choice value={String(p.month)} onChange={v=>set('month',+v)} options={settings.months.map((m,i)=>({value:String(i),label:m}))}/></label><label>Anno BC<input type="number" min="735" max="1735" value={p.year} onChange={e=>set('year',Math.max(735,Math.min(1735,+e.target.value)))}/></label><label>Ora<input type="time" value={String(p.hour).padStart(2,'0')+':'+String(p.minute).padStart(2,'0')} onChange={e=>{const [hour,minute]=e.target.value.split(':').map(Number);if(Number.isFinite(hour)&&Number.isFinite(minute))onChange(toMinutes(p.year,p.month,p.day,hour,minute));}}/></label></div>;}
/** Etichette libere, uguali per ogni tipo di contenuto. Si scrivono e si confermano
 *  con Invio o con la virgola; il server le normalizza in minuscolo e toglie i doppioni. */
export function TagField({value,onChange,suggestions=[]}:{value:string[];onChange:(v:string[])=>void;suggestions?:string[]}){
 const [text,setText]=useState('');
 const add=(raw:string)=>{const tag=raw.trim().toLocaleLowerCase('it').slice(0,40);if(!tag||value.includes(tag)||value.length>=12)return;onChange([...value,tag]);};
 const unused=suggestions.filter(t=>!value.includes(t)).slice(0,8);
 return <div className="tag-field"><label><Tag size={16}/>Etichette <span className="count">{value.length}/12</span></label>
  <div className="tag-list">{value.map(tag=><span className="tag-chip" key={tag}>{tag}<button type="button" aria-label={'Togli l’etichetta '+tag} onClick={()=>onChange(value.filter(t=>t!==tag))}><X size={13}/></button></span>)}
   <input value={text} placeholder={value.length?'Aggiungi…':'Es. vistani, casa durst, da chiarire'} maxLength={40} disabled={value.length>=12}
    onChange={e=>{const v=e.target.value;if(v.endsWith(',')){add(v.slice(0,-1));setText('');}else setText(v);}}
    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add(text);setText('');}else if(e.key==='Backspace'&&!text&&value.length)onChange(value.slice(0,-1));}}
    onBlur={()=>{add(text);setText('');}}/></div>
  {!!unused.length&&<div className="tag-suggestions">{unused.map(tag=><button type="button" key={tag} onClick={()=>add(tag)}>+ {tag}</button>)}</div>}
 </div>;
}
