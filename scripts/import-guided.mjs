import {readdir,access} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const prompt=createInterface({input:process.stdin,output:process.stdout});
const run=(args)=>spawnSync(process.execPath,args,{stdio:'inherit'}).status===0;
try{
 console.log('\nTRASFERIMENTO DELLA CAMPAGNA\nIl sito nuovo deve avere un database vuoto. Il sito precedente non viene modificato.\n');
 await access('.env.netlify.local').catch(()=>{throw new Error('Manca .env.netlify.local. Apri INIZIA-QUI.html, passo 3, scarica la configurazione e spostala nella cartella del sito.');});
 const files=(await readdir('backups').catch(()=>[])).filter(f=>f.endsWith('.json')).sort().map(f=>'backups/'+f);
 if(!files.length)throw new Error('Crea la cartella backups dentro il sito e mettici le esportazioni JSON della campagna.');
 console.log('File trovati:');for(const f of files)console.log('  '+f);
 if(!run(['scripts/import-backups.mjs',...files]))throw new Error('Verifica non riuscita. Correggi il problema indicato sopra e riprova.');
 console.log('\nSe sono indicate esportazioni mancanti, potrebbero mancare appunti privati.');
 const answer=(await prompt.question('Scrivi IMPORTA per trasferire tutti gli archivi, oppure IMPORTA PARZIALE per accettare quelli mancanti. Invio annulla: ')).trim();
 if(!['IMPORTA','IMPORTA PARZIALE'].includes(answer))console.log('Annullato. Nessun trasferimento eseguito.');
 else if(!run(['--env-file=.env.netlify.local','scripts/import-backups.mjs',...files,'--apply',...(answer==='IMPORTA PARZIALE'?['--allow-partial']:[])]))throw new Error('Importazione non completata. Leggi il messaggio sopra; il programma non sovrascrive database popolati.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{prompt.close();}
