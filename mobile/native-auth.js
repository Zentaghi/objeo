import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { db } from './supabase';
const scheme=Constants.expoConfig?.extra?.authScheme||'objeo-native-preview';
export const authURL=kind=>scheme+'://auth/'+kind;
const pending=new Map();
export async function handleAuthURL(value){
 if(!value)return null;const url=new URL(value);
 if(url.protocol!==scheme+':'||url.hostname!=='auth'||!['/callback','/recovery','/confirm'].includes(url.pathname))return null;
 const error=url.searchParams.get('error_description')||url.searchParams.get('error');
 if(error)throw Error(error);
 const code=url.searchParams.get('code');if(!code)return null;
 if(!pending.has(code)){const p=db.auth.exchangeCodeForSession(code).then(r=>{if(r.error)throw r.error;return url.pathname==='/recovery'?'recovery':'success'});pending.set(code,p);if(pending.size>8)pending.delete(pending.keys().next().value)}
 return pending.get(code);
}
export async function googleLogin(){const redirectTo=authURL('callback');const {data,error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true}});if(error)throw error;if(!data?.url)throw Error('Connexion Google indisponible');const r=await WebBrowser.openAuthSessionAsync(data.url,redirectTo);if(r.type==='success')return handleAuthURL(r.url);return null}
