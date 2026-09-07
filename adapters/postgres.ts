import type {Database,Statement} from '../db';

export type QueryResult={rows:Record<string,unknown>[];changes:number};
export type QueryExecutor={query:(sql:string,values:unknown[])=>Promise<QueryResult>;transaction:<T>(work:(tx:QueryExecutor)=>Promise<T>)=>Promise<T>};

// Only application-authored SQL enters this adapter. User values remain bound
// parameters. The schema is explicit so transaction pooling needs no SET state.
export function postgresQuery(source:string){
 let sql=source;
 const ignore=/^INSERT OR IGNORE INTO /i.test(sql);
 if(ignore)sql=sql.replace(/^INSERT OR IGNORE INTO /i,'INSERT INTO ')+' ON CONFLICT DO NOTHING';
 sql=sql.replace("json_extract(data,'$.image')", "data::jsonb ->> 'image'")
  .replace("json_extract(data,'$.markerImage')", "data::jsonb ->> 'markerImage'")
  .replace("EXISTS (SELECT 1 FROM json_each(records.data,'$.images') WHERE json_extract(value,'$.id') = ?)","EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(records.data::jsonb -> 'images','[]'::jsonb)) AS item WHERE item ->> 'id' = ?)");
 sql=sql.replace(/\b(FROM|JOIN|INTO|UPDATE) (users|sessions|attempts|records|settings|uploads)\b/g,'$1 barovia.$2');
 // PostgreSQL's UPSERT requires qualification to distinguish existing columns
 // from EXCLUDED. SQLite accepts the same logic without this qualification.
 if(sql.includes('ON CONFLICT(key) DO UPDATE'))sql=sql.replace(/CASE WHEN reset/g,'CASE WHEN attempts.reset').replace(/ELSE count \+ 1/g,'ELSE attempts.count + 1').replace(/ELSE reset END/g,'ELSE attempts.reset END');
 let n=0;
 sql=sql.replace(/'(?:[^']|'')*'|\?/g,token=>token==='?'?'$'+(++n):token);
 return sql;
}
class PostgresStatement implements Statement {
 constructor(readonly executor:QueryExecutor,readonly sql:string,readonly values:unknown[]=[]){ }
 bind(...values:unknown[]){return new PostgresStatement(this.executor,this.sql,values);}
 async first<T=Record<string,unknown>>(){return ((await this.executor.query(this.sql,this.values)).rows[0]||null) as T|null;}
 async all<T=Record<string,unknown>>(){return {success:true,results:(await this.executor.query(this.sql,this.values)).rows as T[]};}
 async run(){return {success:true,meta:{changes:(await this.executor.query(this.sql,this.values)).changes}};}
}
export class PostgresDatabase implements Database {
 constructor(readonly executor:QueryExecutor){}
 prepare(sql:string){return new PostgresStatement(this.executor,postgresQuery(sql));}
 async batch(statements:Statement[]){
  if(!statements.every(s=>s instanceof PostgresStatement&&s.executor===this.executor))throw new Error('Invalid database batch');
  return this.executor.transaction(async tx=>{const results=[];for(const s of statements as PostgresStatement[])results.push({success:true,meta:{changes:(await tx.query(s.sql,s.values)).changes}});return results;});
 }
}
