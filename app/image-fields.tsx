'use client';
import React,{useState} from 'react';
import {ImagePlus,Trash2,LoaderCircle,Expand,X} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {IconButton} from './ui';
import type {GalleryImage} from '@/lib/campaign';
import {toast} from 'sonner';
const MAX_BYTES=4194304;const MAX_SIDE=1600;
/** Le foto scattate col telefono superano quasi sempre il limite del server.
 *  Le riduciamo qui, così chi carica non riceve un rifiuto e tutti scaricano meno. */
export async function prepareImage(file:File):Promise<File>{
 if(!/^image\/(png|jpeg|webp)$/.test(file.type))return file;
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file);}catch{return file;}
 const scale=Math.min(1,MAX_SIDE/Math.max(bitmap.width,bitmap.height));
 if(scale===1&&file.size<=MAX_BYTES){bitmap.close();return file;}
 const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d');
 if(!context){bitmap.close();return file;}
 context.drawImage(bitmap,0,0,width,height);bitmap.close();
 const type=file.type==='image/png'?'image/png':'image/webp';
 for(const quality of [.86,.72,.6]){
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,type,quality));
  if(!blob)return file;
  if(blob.size<=MAX_BYTES)return new File([blob],file.name.replace(/\.[^.]+$/,'')+(type==='image/png'?'.png':'.webp'),{type});
  if(type==='image/png')break;
 }
 return file;
}
export async function uploadImage(input:File){const file=await prepareImage(input);if(file.size>MAX_BYTES)throw Error('Immagine troppo grande anche dopo la riduzione: usane una più piccola.');const form=new FormData();form.append('file',file);const response=await fetch('/api/upload',{method:'POST',body:form});const data=await response.json();if(!response.ok)throw Error(data.error);return data.id as string;}
export function ImageField({value,onChange,label,disabled=false,onBusy}:{value:string;onChange:(s:string)=>void;label:string;disabled?:boolean;onBusy?:(v:boolean)=>void}){const [busy,setBusy]=useState(false);return <div className="single-image-field">{value?<img src={'/api/media/'+value} alt={label}/>:<div className="image-placeholder"><ImagePlus size={24}/></div>}<div><label className="btn outline upload-label">{busy?<LoaderCircle size={16} className="spin"/>:<ImagePlus size={16}/>} {value?'Sostituisci immagine':label}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy||disabled} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);onBusy?.(true);try{onChange(await uploadImage(file));}catch(err){toast.error((err as Error).message);}finally{setBusy(false);onBusy?.(false);e.target.value='';}}}/></label><p className="help-text">PNG, JPEG o WebP · massimo 4 MB</p>{value&&<button type="button" className="text-button" disabled={busy||disabled} onClick={()=>onChange('')}>Rimuovi</button>}</div></div>;}
export function GalleryEditor({images,onChange,onBusy}:{images:GalleryImage[];onChange:(v:GalleryImage[])=>void;onBusy?:(v:boolean)=>void}){const [busy,setBusy]=useState(false);return <section className="gallery-editor"><div className="row-between"><label>Immagini <span className="count">{images.length}/12</span></label><label className="btn outline compact upload-label">{busy?<LoaderCircle size={16} className="spin"/>:<ImagePlus size={16}/>}Aggiungi<input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy||images.length>=12} onChange={async e=>{const list=Array.from(e.target.files||[]).slice(0,12-images.length);setBusy(true);onBusy?.(true);let next=[...images];try{for(const file of list){next=[...next,{id:await uploadImage(file),caption:''}];onChange(next);}}catch(err){toast.error((err as Error).message);}finally{setBusy(false);onBusy?.(false);e.target.value='';}}}/></label></div>{images.length?<div className="gallery-edit-grid">{images.map((img,i)=><div className="gallery-edit-card" key={img.id}><img src={'/api/media/'+img.id} alt={img.caption||'Immagine '+(i+1)}/><IconButton label="Rimuovi immagine" onClick={()=>onChange(images.filter((_,j)=>j!==i))}><Trash2 size={16}/></IconButton><input aria-label={'Didascalia immagine '+(i+1)} placeholder="Didascalia facoltativa" maxLength={240} value={img.caption} onChange={e=>onChange(images.map((v,j)=>j===i?{...v,caption:e.target.value}:v))}/></div>)}</div>:<p className="help-text">Allega mappe locali, fotografie o riferimenti. Le immagini seguono la visibilità della pagina.</p>}</section>;}
export function ImageGallery({images}:{images:GalleryImage[]}){const [selected,setSelected]=useState<GalleryImage|null>(null);return <><div className="read-gallery">{images.map((img,i)=><figure key={img.id}><button onClick={()=>setSelected(img)} aria-label={'Ingrandisci '+(img.caption||'immagine '+(i+1))}><img src={'/api/media/'+img.id} alt={img.caption||'Immagine allegata '+(i+1)}/><Expand size={17}/></button>{img.caption&&<figcaption>{img.caption}</figcaption>}</figure>)}</div><Dialog open={!!selected} onOpenChange={v=>{if(!v)setSelected(null);}}><DialogContent className="lightbox"><DialogHeader><DialogTitle>Immagine allegata</DialogTitle><DialogDescription>{selected?.caption||'Visualizzazione completa'}</DialogDescription></DialogHeader>{selected&&<img src={'/api/media/'+selected.id} alt={selected.caption||'Immagine allegata'}/>}</DialogContent></Dialog></>;}
