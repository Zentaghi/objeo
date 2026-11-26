import {useState,useEffect,useCallback,useRef} from 'react';
import {AppState,Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {db} from './supabase';
const keyOf=a=>(a.pro?'pro:':'ad:')+a.id;
const check=r=>{if(r.error)throw r.error;return r.data};
export function useFavorites(user){
 const [favorites,F]=useState([]),[ready,Y]=useState(false),[error,E]=useState(''),[loading,L]=useState(false);
 const lock=useRef(false),seq=useRef(0);const cache='objeo:favorites:'+user.id,flag=cache+':migrated';
 const load=useCallback(async()=>{if(lock.current)return;const ticket=++seq.current;L(true);E('');try{
 let rows=check(await db.from('objeo_favorites').select('ad_id,is_pro').eq('user_id',user.id).order('created_at',{ascending:false}));
 if(!(await AsyncStorage.getItem(flag))){
   let old=[];try{old=JSON.parse(await AsyncStorage.getItem(cache)||'[]')}catch{}
   for(const item of old.slice(0,200)){if(!item?.id||rows.some(r=>r.ad_id===item.id&&r.is_pro===!!item.pro))continue;const r=await db.from('objeo_favorites').insert({user_id:user.id,ad_id:item.id,is_pro:!!item.pro});if(r.error&&!['23505','42501'].includes(r.error.code))throw r.error}
   await AsyncStorage.setItem(flag,'1');rows=check(await db.from('objeo_favorites').select('ad_id,is_pro').eq('user_id',user.id).order('created_at',{ascending:false}));
 }
 const personal=rows.filter(x=>!x.is_pro).map(x=>x.ad_id),pro=rows.filter(x=>x.is_pro).map(x=>x.ad_id);
 const [x,y]=await Promise.all([personal.length?db.from('ads').select('id,title,kind,city,category,photo_path,status').in('id',personal):{data:[]},pro.length?db.from('objeo_establishment_items').select('id,title,kind,category,photo_path,status,objeo_establishments(city)').in('id',pro):{data:[]}]);
 const map=new Map([...check(x),...check(y).map(a=>({...a,pro:true,city:a.objeo_establishments?.city}))].map(a=>[keyOf(a),a]));
 if(ticket===seq.current){F(rows.map(r=>map.get((r.is_pro?'pro:':'ad:')+r.ad_id)).filter(Boolean));Y(true)}
 }catch(e){if(ticket===seq.current)E(e.message||'Favoris indisponibles')}finally{if(ticket===seq.current)L(false)}},[user.id]);
 useEffect(()=>{load();const a=AppState.addEventListener('change',s=>{if(s==='active')load()});return()=>{seq.current++;a.remove()}},[load]);
 async function toggle(ad){if(!ready||!ad||lock.current)return;lock.current=true;seq.current++;try{const exists=favorites.some(a=>keyOf(a)===keyOf(ad));const q=db.from('objeo_favorites');check(exists?await q.delete().eq('user_id',user.id).eq('ad_id',ad.id).eq('is_pro',!!ad.pro):await q.insert({user_id:user.id,ad_id:ad.id,is_pro:!!ad.pro}));F(old=>exists?old.filter(a=>keyOf(a)!==keyOf(ad)):[ad,...old])}catch(e){Alert.alert('Favoris',e.message||'Modification impossible')}finally{lock.current=false;load()}}
 return {favorites,ready,error,loading,load,toggle,has:ad=>favorites.some(a=>keyOf(a)===keyOf(ad))};
}
