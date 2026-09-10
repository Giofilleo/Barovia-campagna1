import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

await mkdir('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['lib/combat.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/combat.mjs'});
const {cleanCombatants,recordCombatChange,removeCombatant,MAX_COMBAT_EVENTS}=await import(resolve('.sites-runtime/tests/combat.mjs'));
const creature=(id,name,values={})=>({id,name,initiative:12,ac:13,hp:10,maxHp:10,conditions:'',notes:'Nota privata',...values});
const legacy=()=>({round:3,turnId:'hero',combatants:[creature('hero','Lyria'),creature('enemy','Lupo',{hp:3})]});
const action=(values={})=>({kind:'attack',sourceId:'hero',sourceName:'Nome client da ignorare',label:'Spada lunga',outcome:'hit',roll:'17',damageType:'tagliente',detail:'',targets:['enemy'],...values});
const change=(board,id,values)=>({...board,combatants:board.combatants.map(c=>c.id===id?{...c,...values}:c)});

await test('A legacy encounter starts recording without inventing prior actions or changing its roster',()=>{
 const board=legacy(),before=structuredClone(board);
 const saved=recordCombatChange(board,board,undefined,1600);
 assert.deepEqual(board,before);
 assert.deepEqual(saved.combatants,before.combatants);
 assert.equal(saved.round,3);assert.equal(saved.turnId,'hero');assert.equal(saved.log.minutes,1600);
 assert(saved.log.id);assert.equal(saved.log.events.length,1);
 assert.match(saved.log.events[0].detail,/non sono ricostruibili/);
 assert.deepEqual(saved.log.events[0].effects.map(e=>e.targetName),['Lyria','Lupo']);
});

await test('Combatants clamp HP and reject duplicate identifiers, including invalid-value fallbacks',()=>{
 const values=cleanCombatants([creature('a','Ferito',{hp:-30}),creature('b','Curato',{hp:90,maxHp:4}),creature('c','Piccolo',{hp:undefined,maxHp:2})]);
 assert.equal(values[0].hp,0);assert.equal(values[1].hp,4);
 assert(values[2].hp>=0&&values[2].hp<=values[2].maxHp,'a missing HP value must respect maximum HP');
 assert.throws(()=>cleanCombatants([creature('a','Uno'),creature('a','Due')]),/identificativo distinto/);
 assert.throws(()=>cleanCombatants(Array.from({length:101},(_,i)=>creature(String(i),'Nemico'))),/100 combattenti/);
});

await test('Damage, healing and condition changes require a named action and valid source',()=>{
 const board=legacy();
 for(const values of [{hp:1},{hp:4},{conditions:'Avvelenato'}]){
  const next=change(board,'enemy',values);
  assert.throws(()=>recordCombatChange(board,next,undefined,1600),/fonte/);
  assert.throws(()=>recordCombatChange(board,next,action({sourceId:'missing'}),1600),/chi agisce/);
  assert.throws(()=>recordCombatChange(board,next,action({sourceId:'_other',sourceName:'  '}),1600),/chi agisce/);
  assert.throws(()=>recordCombatChange(board,next,action({label:'  '}),1600),/fonte/);
 }
});

await test('Combatant names come from the board, while environment and named external sources remain valid',()=>{
 const board=legacy(),next=change(board,'enemy',{hp:2});
 assert.equal(recordCombatChange(board,next,action(),1600).log.events.at(-1).sourceName,'Lyria');
 assert.equal(recordCombatChange(board,next,action({sourceId:'_environment',label:'Caduta'}),1600).log.events.at(-1).sourceName,'Ambiente');
 assert.equal(recordCombatChange(board,next,action({sourceId:'_other',sourceName:' Trappola della cripta '}),1600).log.events.at(-1).sourceName,'Trappola della cripta');
});

await test('Missed attacks and spells without consequences are recorded, and misses cannot change HP or conditions',()=>{
 const board=recordCombatChange(legacy(),legacy(),undefined,1600);
 const miss=recordCombatChange(board,board,action({outcome:'miss'}),1600);
 assert.equal(miss.log.events.length,board.log.events.length+1);
 assert.equal(miss.log.events.at(-1).outcome,'miss');assert.deepEqual(miss.log.events.at(-1).effects,[]);
 assert.deepEqual(miss.combatants,board.combatants);
 const spell=recordCombatChange(miss,miss,action({kind:'spell',label:'Luce',outcome:'success',targets:[]}),1600);
 assert.equal(spell.log.events.at(-1).label,'Luce');assert.deepEqual(spell.log.events.at(-1).effects,[]);
 for(const values of [{hp:0},{conditions:'Prono'}])assert.throws(()=>recordCombatChange(board,change(board,'enemy',values),action({outcome:'miss'}),1600),/mancato/);
});

await test('One multi-target action records actual clamped damage, healing and condition changes together',()=>{
 const board=legacy();board.combatants.push(creature('ally','Nier',{hp:8}));
 const next={...board,combatants:cleanCombatants(board.combatants.map(c=>c.id==='enemy'?{...c,hp:-7,conditions:'Stordito'}:c.id==='ally'?{...c,hp:30}:c))};
 const saved=recordCombatChange(board,next,action({kind:'spell',label:'Esplosione e sollievo',targets:['enemy','ally']}),1600);
 const event=saved.log.events.at(-1);
 assert.deepEqual(event.targets,['Lupo','Nier']);
 assert.equal(event.effects.find(e=>e.targetId==='enemy'&&e.kind==='damage').amount,3);
 assert.equal(event.effects.find(e=>e.targetId==='ally'&&e.kind==='heal').amount,2);
 assert.deepEqual(event.effects.find(e=>e.kind==='condition'),{targetId:'enemy',targetName:'Lupo',kind:'condition',before:'',after:'Stordito'});
 assert.equal(saved.combatants.find(c=>c.id==='enemy').hp,0);assert.equal(saved.combatants.find(c=>c.id==='ally').hp,10);
 const removed=recordCombatChange(saved,change(saved,'enemy',{conditions:''}),action({kind:'condition',label:'L’effetto termina'}),1600);
 assert.equal(removed.log.events.at(-1).effects[0].before,'Stordito');assert.equal(removed.log.events.at(-1).effects[0].after,'');
});

await test('Declared quantities survive clamping and zero-HP changes, while inconsistent consequences are rejected',()=>{
 const board=legacy();const damaged=recordCombatChange(board,change(board,'enemy',{hp:0}),action({requested:[{id:'enemy',kind:'damage',amount:100}]}),1600);
 const effect=damaged.log.events.at(-1).effects[0];assert.equal(effect.amount,3);assert.equal(effect.requested,100);
 const again=recordCombatChange(damaged,damaged,action({requested:[{id:'enemy',kind:'damage',amount:7}]}),1600);
 assert.equal(again.log.events.at(-1).effects[0].amount,0);assert.equal(again.log.events.at(-1).effects[0].requested,7);
 assert.throws(()=>recordCombatChange(board,change(board,'enemy',{hp:1}),action({requested:[{id:'enemy',kind:'damage',amount:8}]}),1600),/non corrispondono/);
 assert.throws(()=>recordCombatChange(board,board,action({detail:'x'.repeat(2001)}),1600),/2.000 caratteri/);
});

await test('History is append-only, ignores a replacement client log and preserves names after rename/removal',()=>{
 const board=legacy();const first=recordCombatChange(board,change(board,'enemy',{hp:2}),action(),1600);
 const before=structuredClone(first);const forged={...change(first,'enemy',{name:'Lupo rinominato'}),log:{id:'fake',events:[]}};
 const renamed=recordCombatChange(first,forged,undefined,1800);
 assert.deepEqual(first,before);assert.equal(renamed.log.id,first.log.id);assert.equal(renamed.log.minutes,1600);
 assert.deepEqual(renamed.log.events.slice(0,first.log.events.length),first.log.events);
 const removed=recordCombatChange(renamed,{...renamed,combatants:renamed.combatants.filter(c=>c.id!=='enemy')},undefined,1800);
 assert.equal(removed.log.events.find(e=>e.kind==='attack').effects[0].targetName,'Lupo');
 assert.equal(removed.log.events.at(-1).effects[0].kind,'leave');
});

await test('Round and turn changes append a new event without rewriting earlier rounds',()=>{
 const board=recordCombatChange(legacy(),legacy(),undefined,1600);
 const forward=recordCombatChange(board,{...board,round:4,turnId:'enemy'},undefined,1600);
 const backward=recordCombatChange(forward,{...forward,round:3,turnId:'hero'},undefined,1600);
 assert.deepEqual(backward.log.events.slice(0,board.log.events.length),board.log.events);
 assert.equal(backward.log.events.at(-2).round,4);assert.equal(backward.log.events.at(-2).turnName,'Lupo');
 assert.equal(backward.log.events.at(-1).round,3);assert.equal(backward.log.events.at(-1).turnName,'Lyria');
});

await test('The event limit rejects an action instead of silently losing history or mutating the board',()=>{
 const board=legacy();board.log={id:'full',startedAt:1,minutes:1600,events:Array.from({length:MAX_COMBAT_EVENTS},(_,i)=>({id:String(i),at:1,round:1,turnName:'',kind:'action',sourceName:'DM',label:'Passa',targets:[],effects:[]}))};
 const before=structuredClone(board);
 assert.throws(()=>recordCombatChange(board,change(board,'enemy',{hp:2}),action(),1600),/2.000 eventi/);
 assert.deepEqual(board,before);
});

await test('An oversized combat history is rejected without truncating saved actions',()=>{
 const board=legacy();board.log=recordCombatChange(board,board,undefined,1600).log;
 board.log.events[0].detail='x'.repeat(1200001);
 const before=structuredClone(board);
 assert.throws(()=>recordCombatChange(board,board,undefined,1600),/registro è molto lungo/);
 assert.deepEqual(board,before);
});

await test('Removing the active fighter follows initiative order and advances the round only on wrap',()=>{
 const board={round:2,turnId:'b',combatants:[creature('a','A',{initiative:5}),creature('b','B',{initiative:20}),creature('c','C',{initiative:10})]};
 const next=removeCombatant(board,'b');assert.equal(next.turnId,'c');assert.equal(next.round,2);assert.equal(board.combatants.length,3);
 const wrapped=removeCombatant({...board,turnId:'a'},'a');assert.equal(wrapped.turnId,'b');assert.equal(wrapped.round,3);
 const other=removeCombatant(board,'a');assert.equal(other.turnId,'b');assert.equal(other.round,2);
 const last=removeCombatant({round:2,turnId:'b',combatants:[board.combatants[1]]},'b');assert.equal(last.turnId,'');assert.equal(last.round,2);
 const recorded=recordCombatChange({...board,turnId:'a'},wrapped,undefined,0);
 assert.equal(recorded.log.events.at(-1).round,3);assert.equal(recorded.log.events.at(-1).turnName,'B');
});
