export const MONTHS=['Yinvar','Fivral','Mart','Apryl','Mai','Iyune','Iyule','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
export type Kind='pin'|'note'|'character'|'journal'|'secret'|'treasure'|'faction'|'event'|'folder';
export type Member={id:string;name:string;role:'dm'|'player';active:number;changed?:number};
export type Point={x:number;y:number};
export type Entry={id:string;kind:Kind;title:string;body:string;owner:string;audience:string[];folder:string;data:Record<string,any>;links:string[];version:number;updated:number;editor:string};
export type Settings={title:string;minutes:number;party:Point;mapWidthMiles:number;speed:number;mapCalibrated?:boolean;partyImage?:string;locationRadiusMiles?:number;months:string[]};
export type State={user:Member;users:Member[];records:Entry[];settings:Settings;settingsVersion:number;supplies:Supplies;suppliesVersion:number;dmBoard?:DMBoard;dmBoardVersion?:number};
export const DEFAULTS:Settings={title:'Curse of Strahd',minutes:480,party:{x:.925,y:.548},mapWidthMiles:20,speed:3,months:MONTHS};
export const KINDS:Record<Kind,{label:string;plural:string;color:string}>={pin:{label:'Luogo',plural:'Luoghi',color:'#b49b8e'},note:{label:'Appunto',plural:'Appunti',color:'#9099a8'},character:{label:'Personaggio',plural:'Glossario',color:'#b19dae'},journal:{label:'Sessione',plural:'Diario',color:'#b6a79a'},secret:{label:'Nota del DM',plural:'Schermo del DM',color:'#a8575a'},treasure:{label:'Oggetto',plural:'Tesoro',color:'#b9ad8c'},faction:{label:'Fazione',plural:'Reputazione',color:'#829cb0'},event:{label:'Evento',plural:'Cronologia',color:'#aa8160'},folder:{label:'Cartella',plural:'Cartelle',color:'#969aa3'}};
export function dateParts(minutes:number){const day=Math.floor(minutes/1440);return{year:735+Math.floor(day/336),month:Math.floor((day%336)/28),day:day%28+1,hour:Math.floor((minutes%1440)/60),minute:minutes%60};}
export function toMinutes(year:number,month:number,day:number,hour:number,minute:number){return(((year-735)*336+month*28+day-1)*1440+hour*60+minute);}
export function dateLabel(minutes:number,months=MONTHS){const p=dateParts(minutes);return `${p.day} ${months[p.month]} ${p.year} BC`;}
export function timeLabel(minutes:number){const p=dateParts(minutes);return `${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;}
export function visible(record:Entry,user:Member){return record.kind==='secret'?user.role==='dm':record.owner===user.id||record.audience.includes('*')||record.audience.includes(user.id);}
export function editable(record:Entry,user:Member){return visible(record,user)&&(!['secret','faction'].includes(record.kind)||user.role==='dm');}
export function deletable(record:Entry,user:Member){return editable(record,user)&&(record.owner===user.id||user.role==='dm');}
export function visibilityLabel(r:Entry,users:Member[]){if(r.kind==='secret')return 'Solo DM';if(r.audience.includes('*'))return 'Tutto il gruppo';const ids=new Set([r.owner,...r.audience]);return ids.size===1?'Personale':Array.from(ids).map(id=>users.find(u=>u.id===id)?.name).filter(Boolean).join(', ');}

export type GalleryImage={id:string;caption:string};
export type Supplies={rations:number;partySize:number;foodPerPerson:number;targetDays:number;history:{id:string;at:number;by:string;note:string;rations:number;before:{rations:number};reversed?:boolean}[]};
export const DEFAULT_SUPPLIES:Supplies={rations:0,partySize:6,foodPerPerson:1,targetDays:7,history:[]};
export type Combatant={id:string;name:string;initiative:number;ac:number;hp:number;maxHp:number;conditions:string;notes:string};
export type DMBoard={round:number;turnId:string;combatants:Combatant[]};
export const DEFAULT_DM_BOARD:DMBoard={round:1,turnId:'',combatants:[]};
export function imageIds(data:Record<string,any>){return Array.from(new Set([data.image,data.markerImage,...(Array.isArray(data.images)?data.images.map((x:any)=>x.id):[])].filter((x):x is string=>typeof x==='string'&&!!x)));}
export function inlineReferences(body:string){return Array.from(body.matchAll(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)).map(m=>({id:m[1],label:m[2],token:m[0]}));}
export function supplyDays(s:Supplies){const daily=s.partySize*s.foodPerPerson;const days=daily>0?s.rations/daily:0;return{food:days,days};}
/** Read existing supplies while dropping retired water fields, including history. */
export function readSupplies(raw:Partial<Supplies>={}):Supplies{return {rations:raw.rations??DEFAULT_SUPPLIES.rations,partySize:raw.partySize??DEFAULT_SUPPLIES.partySize,foodPerPerson:raw.foodPerPerson??DEFAULT_SUPPLIES.foodPerPerson,targetDays:raw.targetDays??DEFAULT_SUPPLIES.targetDays,history:(raw.history||[]).map(m=>({id:m.id,at:m.at,by:m.by,note:m.note,rations:m.rations,before:{rations:m.before.rations},reversed:m.reversed}))};}
