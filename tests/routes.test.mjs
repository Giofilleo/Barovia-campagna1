import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['lib/routes.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/routes.mjs'});
const {routeAnchors,sampleRoute,routeLength,pointAt,partialRoute,nearbyPlace}=await import(resolve('.sites-runtime/tests/routes.mjs'));
const point=(x,y)=>({x,y});const event=(data)=>({kind:'event',data});
await test('Legacy drawings and new control points retain the same endpoints',()=>{
 const prev=event(point(.1,.1));const next=event({...point(.8,.7),path:[point(.1,.1),point(.3,.6),point(.8,.7)]});
 const anchors=routeAnchors(next,prev);assert.deepEqual(anchors,[point(.1,.1),point(.3,.6),point(.8,.7)]);
 const v2=event({...point(.8,.7),path:[point(.3,.6)],routeVersion:2});assert.deepEqual(routeAnchors(v2,prev),anchors);
});
await test('Curves pass through control points and playback follows the measured curve',()=>{
 const points=[point(.1,.2),point(.3,.7),point(.7,.3),point(.9,.6)];const sampled=sampleRoute(points,true);
 assert.deepEqual(sampled[0],points[0]);assert.deepEqual(sampled.at(-1),points.at(-1));
 for(const p of points)assert(sampled.some(q=>Math.abs(q.x-p.x)<1e-9&&Math.abs(q.y-p.y)<1e-9));
 assert(routeLength(sampled)>routeLength([points[0],points.at(-1)]));
 const middle=pointAt(sampled,.5);assert.deepEqual(partialRoute(sampled,.5).at(-1),middle);
 assert.deepEqual(pointAt(sampled,0),points[0]);assert.deepEqual(pointAt(sampled,1),points.at(-1));
});
await test('A location name is shown only inside its configured radius',()=>{
 const place={id:'vallaki',kind:'pin',title:'Vallaki',data:point(.4,.3)};
 assert.equal(nearbyPlace(point(.4,.3),[place],20,.25)?.title,'Vallaki');
 assert.equal(nearbyPlace(point(.5,.3),[place],20,.25),null);
 assert.equal(nearbyPlace(point(.5,.3),[place],20,3)?.title,'Vallaki');
 assert.equal(nearbyPlace(point(.4,.3),[],20,.25),null);
});

await test('A journey returning to the same location still has distinct start and end handles',()=>{
 const prev=event(point(.4,.3));const next=event({...point(.4,.3),path:[],routeVersion:2});
 assert.equal(routeAnchors(next,prev).length,2);
});

await test('Ruler distances respect square, portrait and landscape map proportions',()=>{
 assert.equal(routeLength([point(0,0),point(0,1)],1),1);
 assert.equal(routeLength([point(0,0),point(0,1)],.5),2);
 assert.equal(routeLength([point(0,0),point(0,1)],2),.5);
 assert.equal(routeLength([point(0,0),point(1,0)],.5),1);
});
