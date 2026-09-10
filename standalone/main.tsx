import React from 'react';
import {createRoot} from 'react-dom/client';
import CampaignApp from '../app/campaign-app';
import '../app/globals.css';
import '../app/chronicles.css';
createRoot(document.getElementById('root')!).render(<CampaignApp/>);
/* Installazione come app e lettura senza rete. Il worker non conserva mai le
   richieste /api/*, quindi i dati della campagna restano sempre quelli veri.
   Registrato dopo il caricamento per non rallentare il primo avvio. */
if('serviceWorker'in navigator&&location.protocol==='https:'){
 window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>undefined);});
}
