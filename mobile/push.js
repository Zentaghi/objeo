import React,{useEffect,useRef,useState} from 'react';
import {AppState,Alert,Text,Pressable,View,Platform} from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import {db} from './supabase';
const enabled=Platform.OS==='android'&&Constants.expoConfig?.extra?.pushConfigured===true;
const key='objeo.native.push.token';
const check=r=>{if(r.error)throw r.error;return r.data};
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
export async function registerPush(user,ask=false){if(!enabled)throw Error('Firebase n’est pas encore configuré dans ce binaire.');
await Notifications.setNotificationChannelAsync('objeo',{name:'Alertes Objeo',importance:Notifications.AndroidImportance.DEFAULT});
let perm=await Notifications.getPermissionsAsync();if(!perm.granted&&ask)perm=await Notifications.requestPermissionsAsync();
if(!perm.granted)throw Error('Autorisation de notification refusée.');
const result=await Notifications.getDevicePushTokenAsync();if(result.type!=='android'||typeof result.data!=='string')throw Error('Jeton FCM indisponible.');
const prior=await SecureStore.getItemAsync(key);
if(prior&&prior!==result.data)check(await db.from('objeo_native_devices').delete().eq('user_id',user.id).eq('token',prior));
check(await db.from('objeo_native_devices').upsert({token:result.data,user_id:user.id,updated_at:new Date().toISOString()},{onConflict:'token'}));await SecureStore.setItemAsync(key,result.data);
}
export async function unregisterPush(user){const token=await SecureStore.getItemAsync(key);if(token){check(await db.from('objeo_native_devices').delete().eq('user_id',user.id).eq('token',token));await SecureStore.deleteItemAsync(key)}}
export async function signOutNative(user){try{await unregisterPush(user)}catch{Alert.alert('Notifications','La désactivation distante a échoué. Les alertes ne contiennent aucune donnée privée.');}await db.auth.signOut()}
export function PushSettings({user}){const [state,S]=useState(null),[busy,B]=useState(false),[error,E]=useState('');const lock=useRef(false);
async function load(){try{const token=await SecureStore.getItemAsync(key);if(!token){S(false);return}const r=await db.from('objeo_native_devices').select('token').eq('user_id',user.id).eq('token',token).maybeSingle();S(!!check(r))}catch(e){E(e.message)}}
useEffect(()=>{load()},[user.id]);
async function toggle(){if(lock.current)return;lock.current=true;B(true);E('');try{if(state)await unregisterPush(user);else await registerPush(user,true);await load()}catch(e){E(e.message)}finally{lock.current=false;B(false)}}
return <View style={{gap:6}}><Pressable accessibilityRole="button" disabled={!enabled||busy||state===null} onPress={toggle} style={{padding:13,borderWidth:1,borderRadius:12,borderColor:'#dfe3e8',opacity:enabled?1:0.55}}><Text style={{textAlign:'center',fontWeight:'700',color:'#222b37'}}>{busy?'Configuration…':state?'Désactiver les notifications push':'Activer les notifications push'}</Text></Pressable>{!enabled&&<Text style={{fontSize:12,color:'#69717c'}}>Notifications natives : configuration Firebase requise. Les alertes dans l’application restent disponibles.</Text>}{error?<Text style={{color:'#b42318'}}>{error}</Text>:null}</View>}
export function usePushRefresh(user){useEffect(()=>{if(!enabled)return;let active=true;async function refresh(){try{if(active&&await SecureStore.getItemAsync(key))await registerPush(user,false)}catch{}}refresh();const a=AppState.addEventListener('change',s=>{if(s==='active')refresh()});const t=Notifications.addPushTokenListener(()=>refresh());return()=>{active=false;a.remove();t.remove()}},[user.id])}
