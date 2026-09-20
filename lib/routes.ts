import {placed,type Point,type Entry} from './campaign';
export const MAP_RATIO=1558/1000;
export function mapDistance(a:Point,b:Point,ratio=MAP_RATIO){return Math.hypot(a.x-b.x,(a.y-b.y)/ratio);}
export function routeAnchors(event:Entry,previous?:Entry):Point[]{
 const end={x:event.data.x,y:event.data.y};if(!previous)return[end];
 const start={x:previous.data.x,y:previous.data.y};let points:Point[]=Array.isArray(event.data.path)?event.data.path.map((p:Point)=>({...p})):[];
 if(event.data.routeVersion!==2){if(points.length&&mapDistance(points[0],start)<.001)points.shift();if(points.length&&mapDistance(points.at(-1)!,end)<.001)points.pop();}
 return[start,...points,end].filter((p,i,a)=>!i||i===a.length-1||mapDistance(p,a[i-1])>.000001);
}
export function sampleRoute(points:Point[],curve:boolean):Point[]{
 if(!curve||points.length<3)return points;
 const result:Point[]=[];const clamp=(v:number)=>Math.max(0,Math.min(1,v));
 for(let i=0;i<points.length-1;i++){const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
 const steps=Math.max(2,Math.min(20,Math.floor(4000/points.length)));for(let k=0;k<steps;k++){const t=k/steps,t2=t*t,t3=t2*t;const component=(key:'x'|'y')=>clamp(.5*((2*p1[key])+(-p0[key]+p2[key])*t+(2*p0[key]-5*p1[key]+4*p2[key]-p3[key])*t2+(-p0[key]+3*p1[key]-3*p2[key]+p3[key])*t3));result.push({x:component('x'),y:component('y')});}}
 return[...result,points.at(-1)!];
}
export function routeLength(points:Point[],ratio=MAP_RATIO){return points.slice(1).reduce((sum,p,i)=>sum+mapDistance(p,points[i],ratio),0);}
export function pointAt(points:Point[],fraction:number){if(!points.length)return{x:.5,y:.5};if(points.length===1)return points[0];let remaining=routeLength(points)*Math.max(0,Math.min(1,fraction));for(let i=1;i<points.length;i++){const d=mapDistance(points[i-1],points[i]);if(remaining<=d){const t=d?remaining/d:0;return{x:points[i-1].x+(points[i].x-points[i-1].x)*t,y:points[i-1].y+(points[i].y-points[i-1].y)*t};}remaining-=d;}return points.at(-1)!;}
export function partialRoute(points:Point[],fraction:number){if(!points.length)return[];const length=routeLength(points)*Math.max(0,Math.min(1,fraction));let traversed=0;const result=[points[0]];for(let i=1;i<points.length;i++){const d=mapDistance(points[i-1],points[i]);if(traversed+d>length)break;result.push(points[i]);traversed+=d;}return[...result,pointAt(points,fraction)];}
/** I luoghi senza posizione non partecipano: esistono nel glossario ma non stanno
 *  da nessuna parte sulla mappa, quindi non possono essere «vicini» al gruppo. */
export function nearbyPlace(party:Point,records:Entry[],mapWidthMiles:number,radiusMiles=.25){const nearest=records.filter(r=>r.kind==='pin'&&placed(r)&&!r.data.map).map(r=>({record:r,miles:mapDistance(party,r.data as Point)*mapWidthMiles})).sort((a,b)=>a.miles-b.miles)[0];return nearest&&nearest.miles<=radiusMiles?nearest.record:null;}
