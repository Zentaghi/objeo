import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
// Android Keystore-backed session storage. Chunked values avoid large-value limits.
const size=1000;
const safe=k=>k.replace(/[^A-Za-z0-9._-]/g,'_');
const meta=k=>safe(k)+'.meta';
async function manifest(k){const raw=await SecureStore.getItemAsync(meta(k));if(!raw)return null;try{const m=JSON.parse(raw);return typeof m.gen==='string'&&Number.isInteger(m.n)&&m.n>=0&&m.n<=256?m:null}catch{return null}}
const part=(k,m,i)=>safe(k)+'.'+m.gen+'.'+i;
async function removeParts(k,m){if(m)for(let i=0;i<m.n;i++)await SecureStore.deleteItemAsync(part(k,m,i)).catch(()=>{})}
export const secureStorage={
 async getItem(k){const m=await manifest(k);if(!m)return null;const p=[];for(let i=0;i<m.n;i++){const value=await SecureStore.getItemAsync(part(k,m,i));if(value===null)return null;p.push(value)}return JSON.parse(p.join(''))},
 async setItem(k,value){const old=await manifest(k);const encoded=JSON.stringify(value).replace(/[^\x20-\x7e]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));const m={gen:Crypto.randomUUID(),n:Math.ceil(encoded.length/size)};if(m.n>256)throw Error('Session trop volumineuse');try{for(let i=0;i<m.n;i++)await SecureStore.setItemAsync(part(k,m,i),encoded.slice(i*size,(i+1)*size));await SecureStore.setItemAsync(meta(k),JSON.stringify(m))}catch(e){await removeParts(k,m);throw e}await removeParts(k,old)},
 async removeItem(k){const m=await manifest(k);await SecureStore.deleteItemAsync(meta(k));await removeParts(k,m)}
};
