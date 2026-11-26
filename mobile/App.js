import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, Image, FlatList, ScrollView, StyleSheet, ActivityIndicator, StatusBar, KeyboardAvoidingView, Share, BackHandler, Linking } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { db, bindRefresh, photoUrl } from './supabase';

const orange='#ff6e14', ink='#222b37';
const columns='id,kind,title,category,city,happened_on,description,photo_path,status,created_at';
const logo=require('./assets/splash.png');
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const kindLabel=k=>k==='lost'?'Perdu':'Trouvé';
function Button({title,onPress,secondary=false,disabled=false}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[s.button,secondary&&s.secondary,disabled&&{opacity:.5}]}>
    <Text style={[s.buttonText,secondary&&{color:ink}]}>{title}</Text>
  </Pressable>;
}
function Brand(){return <View style={s.brand}><Image source={logo} style={{width:50,height:50}}/><Text style={s.word}>Objeo</Text></View>}
function Field({label,...props}){return <View style={{gap:6}}><Text style={s.label}>{label}</Text><TextInput placeholderTextColor="#737b85" style={s.input} {...props}/></View>}
function ErrorText({value}){return value?<Text accessibilityRole="alert" style={s.error}>{value}</Text>:null}
function Auth(){
  const [mode,setMode]=useState('welcome'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function submit(){
    if(busy)return;setError('');setNotice('');
    if(!email.trim()||!password||(mode==='signup'&&!name.trim())){setError('Renseignez tous les champs.');return}
    setBusy(true);
    try {
      const result=mode==='signup'?await db.auth.signUp({email:email.trim(),password,options:{data:{name:name.trim()},emailRedirectTo:'https://objeo.online/'}}):await db.auth.signInWithPassword({email:email.trim(),password});
      if(result.error)throw result.error;
      if(mode==='signup'&&!result.data.session){setNotice('Vérifiez votre e-mail, puis revenez vous connecter.');setMode('login')}
    }catch(e){setError(e.message||'Connexion impossible.')}finally{setBusy(false)}
  }
  return <KeyboardAvoidingView style={s.full} behavior="height"><ScrollView contentContainerStyle={s.auth} keyboardShouldPersistTaps="handled">
    <Brand/><Text style={s.h1}>{mode==='welcome'?'Bienvenue sur Objeo':mode==='signup'?'Créer un compte':'Connexion'}</Text>
    <Text style={s.muted}>Retrouvez ce qui compte.</Text>
    {mode==='welcome'?<><Button title="S’identifier" onPress={()=>setMode('login')}/><Button title="Créer un compte gratuit" secondary onPress={()=>setMode('signup')}/></>:<>
    {mode==='signup'&&<Field label="Nom" value={name} onChangeText={setName} autoComplete="name"/>}
    <Field label="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/>
    <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode==='signup'?'new-password':'current-password'}/>
    <Button title={busy?'Connexion en cours…':mode==='signup'?'Créer mon compte':'Se connecter'} disabled={busy} onPress={submit}/>
    <Button title="Retour" secondary onPress={()=>{setMode('welcome');setError('');setNotice('')}}/>
    </>}
    <ErrorText value={error}/>{notice?<Text style={s.muted}>{notice}</Text>:null}
    <Text style={s.small}>Aperçu natif • connexion Google et espace professionnel en cours de migration.</Text>
    <Pressable onPress={()=>Linking.openURL('https://objeo.online/cgu.html')}><Text style={s.link}>Conditions d’utilisation</Text></Pressable>
    <Pressable onPress={()=>Linking.openURL('https://objeo.online/confidentialite.html')}><Text style={s.link}>Confidentialité</Text></Pressable>
  </ScrollView></KeyboardAvoidingView>
}
function Card({item,onPress}){const photo=photoUrl(item.photo_path);return <Pressable accessibilityRole="button" style={s.card} onPress={onPress}>
  {photo?<Image source={{uri:photo}} style={s.thumb}/>:<View style={[s.thumb,s.placeholder]}><Text style={{fontSize:26}}>⌕</Text></View>}
  <View style={{flex:1,gap:5}}><Text style={s.tag}>{kindLabel(item.kind)}{item.status==='resolved'?' · Clôturé':''}</Text><Text style={s.cardTitle}>{item.title}</Text><Text style={s.muted}>{[item.city,item.category].filter(Boolean).join(' · ')}</Text></View>
</Pressable>}
function Detail({ad,back}){const photo=photoUrl(ad.photo_path);return <ScrollView contentContainerStyle={s.page}>
  <Pressable onPress={back}><Text style={s.link}>‹ Retour</Text></Pressable>
  {photo&&<Image source={{uri:photo}} style={s.heroImage} resizeMode="contain"/>}
  <Text style={s.tag}>{kindLabel(ad.kind)}</Text><Text style={s.h1}>{ad.title}</Text><Text style={s.muted}>{ad.city} · {ad.category||'Autre'}</Text>
  {ad.happened_on&&<Text style={s.muted}>Date : {ad.happened_on}</Text>}
  <Text style={s.body}>{ad.description||'Aucune description.'}</Text>
  <Button title="Partager l’annonce" secondary onPress={()=>Share.share({message:ad.title+' — https://objeo.online/?annonce='+encodeURIComponent(ad.id)})}/>
</ScrollView>}
function Personal({user}){
  const [tab,setTab]=useState('home'),[rows,setRows]=useState([]),[mine,setMine]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[q,setQ]=useState(''),[city,setCity]=useState(''),[kind,setKind]=useState('all'),[ad,setAd]=useState(null);
  const seq=useRef(0);
  const load=useCallback(async()=>{
    const id=++seq.current;setLoading(true);setError('');
    try{
      const own=tab==='mine';
      let request=db.from('ads').select(columns).order('created_at',{ascending:false}).limit(100);
      request=own?request.eq('user_id',user.id):request.eq('status','open');
      if(!own&&kind!=='all')request=request.eq('kind',kind);
      if(!own&&city.trim())request=request.ilike('city','%'+city.trim().replace(/[%_]/g,'')+'%');
      const {data,error:e}=await request;if(e)throw e;
      if(seq.current===id)(own?setMine:setRows)(data||[]);
    }catch(e){if(seq.current===id)setError(e.message||'Chargement impossible.')}
    finally{if(seq.current===id)setLoading(false)}
  },[user.id,tab,kind,city]);
  useEffect(()=>{if(tab==='home'||tab==='mine')load();return()=>{seq.current++}},[load,tab]);
  useEffect(()=>{const h=BackHandler.addEventListener('hardwareBackPress',()=>{if(ad){setAd(null);return true}if(tab!=='home'){setTab('home');return true}return false});return()=>h.remove()},[ad,tab]);
  if(ad)return <Detail ad={ad} back={()=>setAd(null)}/>;
  const filtered=rows.filter(a=>!norm(q)||norm([a.title,a.description,a.category].join(' ')).includes(norm(q)));
  const list=tab==='mine'?mine:filtered;
  return <View style={s.full}><View style={s.header}><Brand/></View>
    {tab==='account'?<ScrollView contentContainerStyle={s.page}><Text style={s.h1}>Mon compte</Text><Text style={s.body}>{user.email}</Text><Button title="Se déconnecter" secondary onPress={()=>db.auth.signOut()}/><Text style={s.small}>Cette version de prévisualisation ne remplace pas encore le site. Les annonces, messages, objets personnels et paramètres complets restent disponibles sur Objeo.</Text></ScrollView>:<>
      <View style={s.pageTop}><Text style={s.h1}>{tab==='mine'?'Mes annonces':'Retrouvez ce qui compte'}</Text>
        {tab==='home'&&<><TextInput style={s.input} value={q} onChangeText={setQ} placeholder="Quel objet recherchez-vous ?" placeholderTextColor="#737b85"/>
        <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="Ville" placeholderTextColor="#737b85"/>
        <View style={s.chips}>{[['all','Tout'],['lost','Perdus'],['found','Trouvés']].map(([value,label])=><Pressable key={value} onPress={()=>setKind(value)} style={[s.chip,kind===value&&s.activeChip]}><Text style={{color:kind===value?'white':ink,fontWeight:'600'}}>{label}</Text></Pressable>)}</View>
        <Text style={s.small}>Recherche dans les 100 annonces les plus récentes correspondant aux filtres.</Text></>}
        <ErrorText value={error}/>
      </View>
      <FlatList data={list} keyExtractor={a=>String(a.id)} refreshing={loading} onRefresh={load} contentContainerStyle={s.list} renderItem={({item})=><Card item={item} onPress={()=>setAd(item)}/>} ListEmptyComponent={loading?<ActivityIndicator color={orange}/>:<Text style={s.muted}>Aucune annonce à afficher.</Text>}/>
    </>}
    <View style={s.nav}>{[['home','⌕','Rechercher'],['mine','▤','Mes annonces'],['account','○','Compte']].map(([value,icon,label])=><Pressable accessibilityRole="tab" accessibilityState={{selected:tab===value}} key={value} style={s.navItem} onPress={()=>setTab(value)}><Text style={[s.navIcon,tab===value&&{color:orange}]}>{icon}</Text><Text style={{fontSize:11,color:tab===value?orange:ink}}>{label}</Text></Pressable>)}</View>
  </View>
}
function Root(){
  const [session,setSession]=useState(undefined),[role,setRole]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{let mounted=true;const stop=bindRefresh();const {data:{subscription}}=db.auth.onAuthStateChange((_event,next)=>{if(mounted)setSession(next)});db.auth.getSession().then(({data,error:e})=>{if(mounted){if(e)setError(e.message);setSession(data.session)}}).catch(()=>{if(mounted){setError('Session indisponible.');setSession(null)}});return()=>{mounted=false;subscription.unsubscribe();stop()}},[]);
  const uid=session?.user?.id;
  useEffect(()=>{let active=true;setRole(null);setError('');if(uid){db.from('objeo_establishments').select('id').eq('owner_id',uid).limit(1).then(({data,error:e})=>{if(!active)return;if(e){setError('Impossible de vérifier le type de compte.');setRole('error')}else setRole(data?.length?'pro':'personal')}).catch(()=>{if(active){setRole('error');setError('Connexion indisponible.')}})}return()=>{active=false}},[uid,retry]);
  let content;
  if(session===undefined||(session&&!role))content=<View style={s.center}><Brand/><ActivityIndicator color={orange}/></View>;
  else if(!session)content=<Auth/>;
  else if(role==='error')content=<View style={s.center}><ErrorText value={error}/><Button title="Réessayer" onPress={()=>setRetry(x=>x+1)}/><Button title="Se déconnecter" secondary onPress={()=>db.auth.signOut()}/></View>;
  else if(role==='pro')content=<View style={s.center}><Brand/><Text style={s.h1}>Espace professionnel</Text><Text style={s.muted}>La version native professionnelle est en préparation. Votre espace actuel reste accessible sur le site.</Text><Button title="Ouvrir Objeo Pro" onPress={()=>Linking.openURL('https://objeo.online/etablissements.html')}/><Button title="Se déconnecter" secondary onPress={()=>db.auth.signOut()}/></View>;
  else content=<Personal key={uid} user={session.user}/>;
  return <SafeAreaView style={s.full}><StatusBar barStyle="dark-content"/>{content}</SafeAreaView>
}
export default function App(){return <SafeAreaProvider><Root/></SafeAreaProvider>}
const s=StyleSheet.create({
  full:{flex:1,backgroundColor:'#fff'},auth:{flexGrow:1,justifyContent:'center',padding:24,gap:16},
  center:{flex:1,justifyContent:'center',padding:24,gap:18},brand:{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start'},word:{fontSize:34,fontWeight:'900',color:ink,letterSpacing:-1.6},
  h1:{fontSize:27,fontWeight:'800',color:ink,letterSpacing:-.8},body:{fontSize:16,lineHeight:24,color:ink},muted:{fontSize:14,color:'#626b78'},small:{fontSize:12,color:'#626b78',lineHeight:18},label:{fontSize:13,fontWeight:'600',color:ink},
  button:{backgroundColor:orange,padding:15,borderRadius:12,alignItems:'center'},secondary:{backgroundColor:'#fff',borderColor:'#dfe3e8',borderWidth:1},buttonText:{color:'#fff',fontSize:16,fontWeight:'700'},input:{padding:13,borderWidth:1,borderColor:'#dfe3e8',borderRadius:12,backgroundColor:'#fff',fontSize:15,color:ink},
  error:{color:'#b42318',fontSize:14},link:{color:'#ad4800',fontSize:15,fontWeight:'600'},header:{paddingHorizontal:18,paddingVertical:8,borderBottomWidth:1,borderColor:'#eee'},page:{padding:20,gap:16},pageTop:{padding:18,gap:10},
  chips:{flexDirection:'row',gap:8},chip:{paddingHorizontal:15,paddingVertical:9,borderRadius:18,backgroundColor:'#f0f1f3'},activeChip:{backgroundColor:orange},list:{paddingHorizontal:18,paddingBottom:16,gap:10},card:{borderWidth:1,borderColor:'#e7e9ed',borderRadius:14,flexDirection:'row',padding:10,gap:12,alignItems:'center'},thumb:{width:88,height:88,borderRadius:10,backgroundColor:'#f4f4f5'},placeholder:{alignItems:'center',justifyContent:'center'},tag:{color:'#b94d08',fontSize:12,fontWeight:'700'},cardTitle:{fontSize:16,fontWeight:'700',color:ink},heroImage:{width:'100%',height:250,borderRadius:12,backgroundColor:'#f4f4f5'},
  nav:{flexDirection:'row',borderTopWidth:1,borderColor:'#e7e9ed',paddingVertical:8},navItem:{flex:1,alignItems:'center',gap:3},navIcon:{fontSize:24,color:ink}
});
