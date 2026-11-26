import * as Crypto from 'expo-crypto';
// Secure random bytes and SHA-256 for Supabase PKCE in React Native.
if(!globalThis.crypto)globalThis.crypto={};
if(typeof globalThis.crypto.getRandomValues!=='function')globalThis.crypto.getRandomValues=Crypto.getRandomValues;
if(!globalThis.crypto.subtle)globalThis.crypto.subtle={};
if(typeof globalThis.crypto.subtle.digest!=='function')globalThis.crypto.subtle.digest=(algorithm,data)=>Crypto.digest(typeof algorithm==='string'?algorithm:algorithm.name,data);
