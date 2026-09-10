export const MAIN_MAP={id:'',title:'Barovia',src:'/barovia-map.webp',ratio:1558/1000};
export const MONTHS=['Yinvar','Fivral','Mart','Apryl','Mai','Iyune','Iyule','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
export type Kind='pin'|'note'|'character'|'journal'|'secret'|'treasure'|'faction'|'event'|'folder'|'map'|'table'|'combat';
export type Member={id:string;name:string;role:'dm'|'player';active:number;changed?:number;seen?:number};
export type Point={x:number;y:number};
export type Entry={id:string;kind:Kind;title:string;body:string;owner:string;audience:string[];folder:string;data:Record<string,any>;links:string[];version:number;updated:number;editor:string};
export type Settings={title:string;minutes:number;party:Point;mapWidthMiles:number;speed:number;mapCalibrated?:boolean;partyImage?:string;locationRadiusMiles?:number;months:string[];pinScale?:number;pinLabels?:'sempre'|'passaggio'|'mai';pinLabelScale?:number};
export type State={user:Member;users:Member[];records:Entry[];settings:Settings;settingsVersion:number;supplies:Supplies;suppliesVersion:number;dmBoard?:DMBoard;dmBoardVersion?:number;bestiary?:Bestiary;bestiaryVersion?:number};
export const DEFAULTS:Settings={title:'Curse of Strahd',minutes:480,party:{x:.925,y:.548},mapWidthMiles:20,speed:3,months:MONTHS,pinScale:1,pinLabels:'sempre',pinLabelScale:1};
/** Aspetto dei segnalini: valori della campagna, uguali per tutti finche qualcuno
 *  non li adatta al proprio schermo. La preferenza personale resta nel browser. */
export const PIN_LABEL_MODES=[{value:'sempre',label:'Sempre visibili'},{value:'passaggio',label:'Al passaggio del puntatore'},{value:'mai',label:'Nascoste'}];
export const KINDS:Record<Kind,{label:string;plural:string;color:string}>={combat:{label:'Combattimento',plural:'Combat Log',color:'#c88979'},pin:{label:'Luogo',plural:'Luoghi',color:'#b49b8e'},note:{label:'Appunto',plural:'Appunti',color:'#9099a8'},character:{label:'Personaggio',plural:'Glossario',color:'#b19dae'},journal:{label:'Sessione',plural:'Diario',color:'#b6a79a'},secret:{label:'Nota del DM',plural:'Schermo del DM',color:'#a8575a'},treasure:{label:'Oggetto',plural:'Tesoro',color:'#b9ad8c'},faction:{label:'Fazione',plural:'Reputazione',color:'#829cb0'},event:{label:'Evento',plural:'Cronologia',color:'#aa8160'},folder:{label:'Cartella',plural:'Cartelle',color:'#969aa3'},map:{label:'Mappa',plural:'Mappe',color:'#8fa9a0'},table:{label:'Tabella',plural:'Tabelle casuali',color:'#a89870'}};
export function dateParts(minutes:number){const day=Math.floor(minutes/1440);return{year:735+Math.floor(day/336),month:Math.floor((day%336)/28),day:day%28+1,hour:Math.floor((minutes%1440)/60),minute:minutes%60};}
export function toMinutes(year:number,month:number,day:number,hour:number,minute:number){return(((year-735)*336+month*28+day-1)*1440+hour*60+minute);}
export function dateLabel(minutes:number,months=MONTHS){const p=dateParts(minutes);return `${p.day} ${months[p.month]} ${p.year} BC`;}
export function timeLabel(minutes:number){const p=dateParts(minutes);return `${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;}
export function visible(record:Entry,user:Member){return record.kind==='secret'||record.kind==='table'?user.role==='dm':record.owner===user.id||record.audience.includes('*')||record.audience.includes(user.id);}
export function editable(record:Entry,user:Member){return visible(record,user)&&(!['secret','faction','table','map','combat'].includes(record.kind)||user.role==='dm');}
export function deletable(record:Entry,user:Member){return editable(record,user)&&(record.owner===user.id||user.role==='dm');}
export function visibilityLabel(r:Entry,users:Member[]){if(r.kind==='secret')return 'Solo DM';if(r.audience.includes('*'))return 'Tutto il gruppo';const ids=new Set([r.owner,...r.audience]);return ids.size===1?'Personale':Array.from(ids).map(id=>users.find(u=>u.id===id)?.name).filter(Boolean).join(', ');}

/* --- Glossario ----------------------------------------------------------------
   Il glossario non è un archivio a parte: è un indice che raccoglie in un unico
   elenco le voci che il gruppo incontra, qualunque sia la sezione in cui vivono.
   I luoghi sono gli stessi segnalini della mappa — compresi quelli che hanno una
   mappa propria, che restano luoghi a tutti gli effetti — quindi non esistono due
   copie da tenere allineate: una modifica fatta qui è la stessa che si vede là.
   Personaggi, creature e voci generiche condividono invece un solo tipo di
   record e si distinguono per un sottotipo salvato nei dati della voce. */
export const GLOSSARY_KINDS:Kind[]=['character','pin','map','faction'];
/** Sottotipo delle voci di tipo «personaggio». Le voci salvate prima di questo
 *  aggiornamento non hanno il campo: valgono come «personaggio», come sempre. */
export const CHARACTER_TYPES=['personaggio','creatura','altro'] as const;
export type CharacterType=typeof CHARACTER_TYPES[number];
export type GlossaryType=CharacterType|'luogo'|'fazione';
export function characterType(data:Record<string,any>):CharacterType{const value=data?.glossaryType;return (CHARACTER_TYPES as readonly string[]).includes(value)?value as CharacterType:'personaggio';}
export function glossaryType(r:Entry):GlossaryType{return r.kind==='pin'||r.kind==='map'?'luogo':r.kind==='faction'?'fazione':characterType(r.data);}
/** Quale icona mostrare: un luogo con mappa propria si distingue dagli altri. */
export function glossaryIcon(r:Entry){return r.kind==='map'?'mappa':glossaryType(r);}
export function inGlossary(r:Entry){return GLOSSARY_KINDS.includes(r.kind);}
/** Le sezioni del glossario, nell'ordine in cui compaiono. «kind» dice in quale
 *  tipo di record finisce una voce nuova; «dmOnly» le sezioni che solo il DM
 *  può creare, perché sono gli stessi permessi che valgono già altrove. */
export const GLOSSARY_SECTIONS:{id:GlossaryType;kind:Kind;label:string;plural:string;hint:string;dmOnly?:boolean}[]=[
 {id:'personaggio',kind:'character',label:'Personaggio',plural:'Personaggi',hint:'Chi avete incontrato: alleati, avversari, comparse e i personaggi del gruppo.'},
 {id:'creatura',kind:'character',label:'Creatura',plural:'Creature e mostri',hint:'Bestie, non morti e mostri affrontati o soltanto avvistati.'},
 {id:'luogo',kind:'pin',label:'Luogo',plural:'Luoghi',hint:'Gli stessi segnalini della mappa, comprese le mappe di dettaglio. Un luogo può restare senza posizione finché non sapete dov’è.'},
 {id:'fazione',kind:'faction',label:'Fazione',plural:'Fazioni',hint:'Gruppi, casate e ordini, con la reputazione gestita in «Reputazione».',dmOnly:true},
 {id:'altro',kind:'character',label:'Voce generica',plural:'Altre voci',hint:'Oggetti, usanze, leggende, termini in barovo: tutto ciò che non rientra altrove.'},
];
export const GLOSSARY_SECTION=Object.fromEntries(GLOSSARY_SECTIONS.map(s=>[s.id,s])) as Record<GlossaryType,typeof GLOSSARY_SECTIONS[number]>;
/** Un luogo o una mappa possono esistere nel glossario senza stare sulla mappa:
 *  è il caso di un posto di cui si conosce il nome ma non ancora la posizione.
 *  Il campo è al negativo di proposito: le voci salvate prima di questo
 *  aggiornamento non lo hanno e restano quindi posizionate esattamente com'erano. */
export function placed(r:Entry){return (r.kind!=='pin'&&r.kind!=='map')||r.data.unplaced!==true;}
/** Come si chiama una voce quando la si nomina da sola: per il glossario vale il
 *  sottotipo («Creatura», «Luogo»…), per tutto il resto l'etichetta di sempre. */
export function entryLabel(r:Entry){return inGlossary(r)?GLOSSARY_SECTION[glossaryType(r)].label:KINDS[r.kind].label;}
/** L'immagine che rappresenta una voce del glossario, se ne ha una. */
export function glossaryImage(r:Entry){return (r.kind==='pin'?r.data.markerImage:r.kind==='map'?(r.data.markerImage||r.data.image):r.data.image)||'';}
/** La targhetta sull'immagine nelle schede del glossario. */
export function glossaryStatus(r:Entry){
 if(r.kind==='map')return placed(r)?'Con mappa propria':'Posizione sconosciuta';
 if(r.kind==='pin')return placed(r)?'Sulla mappa':'Posizione sconosciuta';
 if(r.kind==='faction')return 'Reputazione '+((r.data.reputation??0)>0?'+':'')+(r.data.reputation??0);
 return characterType(r.data)==='altro'?'Voce del glossario':(r.data.status||'Sconosciuto');
}
/** La riga sotto il titolo nelle schede del glossario. */
export function glossarySubtitle(r:Entry){
 if(r.kind==='pin'||r.kind==='map'){const tipo=r.data.category?String(r.data.category).replace(/^./,c=>c.toUpperCase()):'Luogo';return r.kind==='map'?tipo+' · con mappa':tipo;}
 if(r.kind==='faction')return r.data.subtitle||'Fazione';
 return r.data.subtitle||GLOSSARY_SECTION[characterType(r.data)].label;
}

export type GalleryImage={id:string;caption:string};
export type Supplies={rations:number;partySize:number;foodPerPerson:number;targetDays:number;history:{id:string;at:number;by:string;note:string;rations:number;before:{rations:number};reversed?:boolean}[]};
export const DEFAULT_SUPPLIES:Supplies={rations:0,partySize:6,foodPerPerson:1,targetDays:7,history:[]};
export type Combatant={id:string;name:string;initiative:number;ac:number;hp:number;maxHp:number;conditions:string;notes:string};
export type DMBoard={round:number;turnId:string;combatants:Combatant[];log?:import('./combat').CombatHistory};
export const DEFAULT_DM_BOARD:DMBoard={round:1,turnId:'',combatants:[]};
/** Avversari salvati dal DM per rimetterli in campo senza ridigitarli. */
export type Bestiary={creatures:{id:string;name:string;ac:number;maxHp:number;initiative:number;conditions:string;notes:string}[]};
export const DEFAULT_BESTIARY:Bestiary={creatures:[]};
export function imageIds(data:Record<string,any>){return Array.from(new Set([data.image,data.markerImage,...(Array.isArray(data.images)?data.images.map((x:any)=>x.id):[])].filter((x):x is string=>typeof x==='string'&&!!x)));}
export function inlineReferences(body:string){return Array.from(body.matchAll(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)).map(m=>({id:m[1],label:m[2],token:m[0]}));}
export function supplyDays(s:Supplies){const daily=s.partySize*s.foodPerPerson;const days=daily>0?s.rations/daily:0;return{food:days,days};}
/** Read existing supplies while dropping retired water fields, including history. */
export function readSupplies(raw:Partial<Supplies>={}):Supplies{return {rations:raw.rations??DEFAULT_SUPPLIES.rations,partySize:raw.partySize??DEFAULT_SUPPLIES.partySize,foodPerPerson:raw.foodPerPerson??DEFAULT_SUPPLIES.foodPerPerson,targetDays:raw.targetDays??DEFAULT_SUPPLIES.targetDays,history:(raw.history||[]).map(m=>({id:m.id,at:m.at,by:m.by,note:m.note,rations:m.rations,before:{rations:m.before.rations},reversed:m.reversed}))};}

/* --- Meteo e luna della valle -------------------------------------------------
   Il calendario della campagna ha mesi di 28 giorni: la fase lunare segue il
   giorno del mese, così la luna piena cade sempre a metà mese. Il tempo è
   ricavato dal numero del giorno con una funzione deterministica: tutti al
   tavolo vedono lo stesso cielo, e riavvolgendo l'orologio il tempo torna
   quello di prima. */
export const MOON_PHASES=['Luna nuova','Luna crescente','Primo quarto','Gibbosa crescente','Luna piena','Gibbosa calante','Ultimo quarto','Luna calante'];
export function moonPhase(minutes:number){const p=dateParts(minutes);const index=Math.round((p.day-1)/28*8)%8;return{index,label:MOON_PHASES[index],full:index===4};}
export type Weather={id:string;label:string;detail:string};
const WEATHER:Record<string,Weather>={
 nebbia:{id:'nebbia',label:'Nebbia fitta',detail:'Oltre una ventina di passi è oscurità pesante. Le Nebbie non lasciano vedere i confini della valle.'},
 foschia:{id:'foschia',label:'Foschia',detail:'Una bruma bassa attutisce i suoni e confonde le distanze.'},
 plumbeo:{id:'plumbeo',label:'Cielo plumbeo',detail:'Nuvole basse e immobili: nessuna luce diretta, nemmeno a mezzogiorno.'},
 pioggia:{id:'pioggia',label:'Pioggia gelida',detail:'Pioggia sottile e continua: svantaggio a chi ascolta, fuochi scoperti a rischio.'},
 vento:{id:'vento',label:'Vento tagliente',detail:'Raffiche fredde dai Balinok. Le fiamme scoperte si spengono.'},
 nevischio:{id:'nevischio',label:'Nevischio',detail:'I sentieri esposti diventano terreno difficile.'},
};
/** Tabella pesata: in Barovia la nebbia è la regola, il resto l'eccezione. */
const WEATHER_TABLE=['nebbia','nebbia','nebbia','foschia','foschia','plumbeo','plumbeo','pioggia','pioggia','vento','nevischio','foschia'];
function scramble(n:number){let x=Math.imul(n^0x9e3779b9,0x85ebca6b);x^=x>>>13;x=Math.imul(x,0xc2b2ae35);return (x^(x>>>16))>>>0;}
export function weatherAt(minutes:number):Weather{const day=Math.floor(minutes/1440);return WEATHER[WEATHER_TABLE[scramble(day)%WEATHER_TABLE.length]];}

/* --- Monete ------------------------------------------------------------------ */
export const COINS=[{id:'mr',label:'Rame',gold:.01},{id:'ma',label:'Argento',gold:.1},{id:'me',label:'Elettro',gold:.5},{id:'mo',label:'Oro',gold:1},{id:'mp',label:'Platino',gold:10}];
export function inGold(value:number,currency='mo'){return value*(COINS.find(c=>c.id===currency)?.gold??1);}
/** Converte un totale in oro nel taglio di monete più naturale da consegnare. */
export function splitCoins(gold:number){const out:{id:string;amount:number}[]=[];let rest=Math.round(gold*100)/100;
 for(const coin of [...COINS].sort((a,b)=>b.gold-a.gold)){const amount=Math.floor(rest/coin.gold+1e-9);if(amount>0){out.push({id:coin.id,amount});rest=Math.round((rest-amount*coin.gold)*100)/100;}}
 return out;}
