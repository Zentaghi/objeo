import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo';
import * as Crypto from 'expo-crypto';
import {Platform} from 'react-native';
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
// Native Android Credential Manager only. No fallback to a browser.
export async function googleLogin(){
 if(Platform.OS!=='android')throw Error('Connexion Google native disponible sur Android. Utilisez votre e-mail sur les autres plateformes.');
 const native=requireOptionalNativeModule('ObjeoGoogle');
 if(!native)throw Error('Cette version ne contient pas le module Google natif. Installez le nouvel APK.');
 const clientId=Constants.expoConfig?.extra?.googleWebClientId;
 if(!clientId||!clientId.endsWith('.apps.googleusercontent.com'))throw Error('La configuration Google est indisponible.');
 const rawNonce=Array.from(await Crypto.getRandomBytesAsync(32),v=>v.toString(16).padStart(2,'0')).join('');
 const hash=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,rawNonce);
 const credential=await native.signIn(clientId,hash);
 if(credential?.cancelled)return null;
 if(!credential?.idToken)throw Error('Google n’a pas fourni de jeton. Utilisez votre e-mail ou vérifiez les services Google Play.');
 const {data,error}=await db.auth.signInWithIdToken({provider:'google',token:credential.idToken,nonce:rawNonce});
 if(error)throw error;
 return data.session;
}
export async function clearGoogleSession(){try{await requireOptionalNativeModule('ObjeoGoogle')?.clearSession()}catch{}}
