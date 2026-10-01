/** Lightweight per-instance cache used for Google Sheets reads and request deduplication.
 * Persistent application data, notification history and push subscriptions live in Google Sheets.
 * Redis is optional and not required by this application build.
 */
export interface KV {
  get(k: string): Promise<string | null>;
  set(k: string, v: string, ttl?: number): Promise<void>;
  del(...k: string[]): Promise<void>;
  incr(k: string): Promise<number>;
  lpushCap(k: string, v: string, cap: number, ttl: number): Promise<void>;
  lrange(k: string, s: number, e: number): Promise<string[]>;
  sadd(k: string, ttl: number, ...v: string[]): Promise<void>;
  smembers(k: string): Promise<string[]>;
  hset(k: string, f: string, v: string, ttl: number): Promise<void>;
  hgetall(k: string): Promise<Record<string, string>>;
  hdel(k: string, ...f: string[]): Promise<void>;
}
type Item={v:any;exp:number};
class MemKV implements KV {
 private m=new Map<string,Item>(); private live(k:string){const i=this.m.get(k);if(i&&i.exp&&i.exp<Date.now()){this.m.delete(k);return undefined;}return i;} private put(k:string,v:any,ttl?:number){this.m.set(k,{v,exp:ttl?Date.now()+ttl*1000:0});}
 async get(k:string){const i=this.live(k);return i?String(i.v):null;} async set(k:string,v:string,ttl?:number){this.put(k,v,ttl);} async del(...k:string[]){k.forEach(x=>this.m.delete(x));}
 async incr(k:string){const n=Number(this.live(k)?.v??0)+1;this.put(k,String(n));return n;}
 async lpushCap(k:string,v:string,cap:number,ttl:number){const l=[v,...((this.live(k)?.v as string[])??[])].slice(0,cap);this.put(k,l,ttl);}
 async lrange(k:string,s:number,e:number){const l=(this.live(k)?.v as string[])??[];return l.slice(s,e<0?undefined:e+1);}
 async sadd(k:string,ttl:number,...v:string[]){const set=new Set<string>((this.live(k)?.v as string[])??[]);v.forEach(x=>set.add(x));this.put(k,[...set],ttl);}
 async smembers(k:string){return [...((this.live(k)?.v as string[])??[])];}
 async hset(k:string,f:string,v:string,ttl:number){this.put(k,{...((this.live(k)?.v as Record<string,string>)??{}),[f]:v},ttl);}
 async hgetall(k:string){return {...((this.live(k)?.v as Record<string,string>)??{})};}
 async hdel(k:string,...f:string[]){const i=this.live(k);if(!i)return;const h={...(i.v as Record<string,string>)};f.forEach(x=>delete h[x]);this.m.set(k,{v:h,exp:i.exp});}
}
const mem=new MemKV();
export const kv={
 get:(k:string)=>mem.get(k),set:(k:string,v:string,ttl?:number)=>mem.set(k,v,ttl),del:(...k:string[])=>mem.del(...k),incr:(k:string)=>mem.incr(k),lpushCap:(k:string,v:string,c:number,t:number)=>mem.lpushCap(k,v,c,t),lrange:(k:string,s:number,e:number)=>mem.lrange(k,s,e),sadd:(k:string,t:number,...v:string[])=>mem.sadd(k,t,...v),smembers:(k:string)=>mem.smembers(k),hset:(k:string,f:string,v:string,t:number)=>mem.hset(k,f,v,t),hgetall:(k:string)=>mem.hgetall(k),
 async getJSON<T>(k:string):Promise<T|null>{const s=await mem.get(k);if(!s)return null;try{return JSON.parse(s) as T}catch{return null;}},
 setJSON:(k:string,v:unknown,ttl?:number)=>mem.set(k,JSON.stringify(v),ttl),
 async mode():Promise<'redis'|'memory'>{return 'memory';},
};
const inflight=new Map<string,Promise<unknown>>();
export function singleflight<T>(key:string,fn:()=>Promise<T>):Promise<T>{const cur=inflight.get(key) as Promise<T>|undefined;if(cur)return cur;const p=fn().finally(()=>inflight.delete(key));inflight.set(key,p);return p;}
