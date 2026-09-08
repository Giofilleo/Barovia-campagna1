/* Service worker della campagna.
   Regole d'oro:
   - le richieste /api/* non vengono MAI conservate: i dati devono essere sempre freschi
     e non devono restare nella cache di un dispositivo condiviso;
   - il programma del sito si prende sempre dalla rete quando c'è, così una nuova
     pubblicazione su Netlify arriva subito e non resta bloccata una versione vecchia;
   - restano in cache solo la pagina, la mappa e i file con impronta nel nome, che
     per costruzione non cambiano mai contenuto a parità di nome.
   Per disattivare tutto basta togliere la registrazione in standalone/main.tsx:
   al caricamento successivo il worker si cancella da solo. */
const VERSION='barovia-v1';
const SHELL=['/','/barovia-map.webp','/favicon.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL).catch(()=>undefined)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{if(event.data==='disattiva')self.registration.unregister();});
function cacheable(url){
 if(url.origin!==self.location.origin)return false;
 if(url.pathname.startsWith('/api/'))return false;
 return url.pathname==='/'||url.pathname.startsWith('/assets/')||SHELL.includes(url.pathname);
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return; // sempre dalla rete, mai conservate
 if(!cacheable(url))return;
 // I file con impronta nel nome non cambiano mai: si prendono dalla cache se ci sono.
 const immutable=url.pathname.startsWith('/assets/')||url.pathname==='/barovia-map.webp';
 if(immutable){
  event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(VERSION).then(c=>c.put(request,copy));}
   return response;
  })));
  return;
 }
 // La pagina: prima la rete, la copia salvata serve solo quando manca la connessione.
 event.respondWith(fetch(request).then(response=>{
  if(response.ok){const copy=response.clone();caches.open(VERSION).then(c=>c.put(request,copy));}
  return response;
 }).catch(()=>caches.match(request).then(hit=>hit||caches.match('/'))));
});
