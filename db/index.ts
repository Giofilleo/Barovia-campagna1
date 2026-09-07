/** Minimal structural contract shared by Cloudflare D1 and the local integration adapter. */
export interface Statement {
  bind(...values:unknown[]):Statement;
  first<T=Record<string,unknown>>():Promise<T|null>;
  all<T=Record<string,unknown>>():Promise<{results:T[];success:boolean}>;
  run():Promise<{meta:{changes:number};success:boolean}>;
}
export interface Database {
  prepare(sql:string):Statement;
  batch(statements:Statement[]):Promise<unknown[]>;
}
export function getDb(env:{DB?:Database}):Database {
  if(!env.DB)throw new Error('Campaign database unavailable');
  return env.DB;
}
