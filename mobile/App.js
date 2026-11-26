import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, Image, FlatList, ScrollView, StyleSheet, ActivityIndicator, StatusBar, KeyboardAvoidingView, Share, BackHandler, Linking } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { db, bindRefresh, photoUrl } from './supabase';
import { NativePersonal, NativePro } from './NativeFeatures';
import { LegalModal } from './LegalModal';
import { authURL, handleAuthURL, googleLogin, clearGoogleSession } from './native-auth';
import * as SplashScreen from 'expo-splash-screen';
SplashScreen.preventAutoHideAsync().catch(()=>{});

const orange='#ff6e14', ink='#222b37';
const columns='id,kind,title,category,city,happened_on,description,photo_path,status,created_at';
const logo=require('./assets/brand.png');
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const kindLabel=k=>k==='lost'?'Perdu':'Trouvé';
function Button({title,onPress,secondary=false,disabled=false}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[s.button,secondary&&s.secondary,disabled&&{opacity:.5}]}>
    <Text style={[s.buttonText,secondary&&{color:ink}]}>{title}</Text>
  </Pressable>;
}
function Brand(){return <View style={s.brand}><Image source={logo} style={{width:46,height:46}} resizeMode="contain"/><Text style={s.word}>Objeo</Text></View>}
function Field({label,...props}){return <View style={{gap:6}}><Text style={s.label}>{label}</Text><TextInput placeholderTextColor="#737b85" style={s.input} {...props}/></View>}
function ErrorText({value}){return value?<Text accessibilityRole="alert" style={s.error}>{value}</Text>:null}
function Auth(){
  const [legal,setLegal]=useState(null);
  const [mode,setMode]=useState('welcome'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function google(){if(busy)return;setBusy(true);setError('');try{await googleLogin()}catch(e){setError(e.message||'Connexion Google indisponible.')}finally{setBusy(false)}}
  async function submit(){
    if(busy)return;setError('');setNotice('');
    if(!email.trim()||!password||(mode==='signup'&&!name.trim())){setError('Renseignez tous les champs.');return}
    setBusy(true);
    try {
      const result=mode==='signup'?await db.auth.signUp({email:email.trim(),password,options:{data:{name:name.trim()},emailRedirectTo:authURL('confirm')}}):await db.auth.signInWithPassword({email:email.trim(),password});
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
    <Button title="Continuer avec Google" secondary disabled={busy} onPress={google}/>
    <Text style={s.small}>Google utilise le sélecteur de comptes Android. Si les services Google Play ne sont pas disponibles, connectez-vous par e-mail.</Text>
    <Button title="Mot de passe oublié" secondary disabled={busy} onPress={async()=>{if(!email.trim()){setMode('login');setError('Renseignez votre adresse e-mail.');return}try{const r=await db.auth.resetPasswordForEmail(email.trim(),{redirectTo:authURL('recovery')});if(r.error)throw r.error;setNotice('Consultez votre messagerie pour réinitialiser votre mot de passe.')}catch(e){setError(e.message)}}}/>
    <ErrorText value={error}/>{notice?<Text style={s.muted}>{notice}</Text>:null}
    <Text style={s.small}>Retrouvez vos objets et communiquez gratuitement avec la communauté.</Text>
    <Pressable onPress={()=>setLegal('cgu')}><Text style={s.link}>Conditions d’utilisation</Text></Pressable>
    <Pressable onPress={()=>setLegal('privacy')}><Text style={s.link}>Confidentialité</Text></Pressable>
  <LegalModal type={legal} onClose={()=>setLegal(null)}/></ScrollView></KeyboardAvoidingView>
}
function ResetPassword({done}){const [password,P]=useState(''),[confirmation,C]=useState(''),[busy,B]=useState(false),[error,E]=useState('');async function save(){if(busy)return;if(password.length<8||password!==confirmation){E('Choisissez au moins 8 caractères et confirmez le mot de passe.');return}B(true);E('');try{const r=await db.auth.updateUser({password});if(r.error)throw r.error;done()}catch(e){E(e.message)}finally{B(false)}}return <ScrollView contentContainerStyle={s.auth}><Brand/><Text style={s.h1}>Nouveau mot de passe</Text><Field label="Mot de passe" value={password} onChangeText={P} secureTextEntry/><Field label="Confirmer" value={confirmation} onChangeText={C} secureTextEntry/><ErrorText value={error}/><Button title="Enregistrer" onPress={save} disabled={busy}/><Button title="Annuler et se déconnecter" secondary onPress={async()=>{await db.auth.signOut();done()}}/></ScrollView>}
function Root(){
  const [session,setSession]=useState(undefined),[role,setRole]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[recovery,setRecovery]=useState(false),[linkError,setLinkError]=useState('');
  useEffect(()=>{let active=true;const handle=url=>handleAuthURL(url).then(result=>{if(active&&result==='recovery')setRecovery(true)}).catch(e=>{if(active)setLinkError(e.message)});Linking.getInitialURL().then(handle).catch(()=>{});const listener=Linking.addEventListener('url',e=>handle(e.url));return()=>{active=false;listener.remove()}},[]);
  useEffect(()=>{let mounted=true;const stop=bindRefresh();const {data:{subscription}}=db.auth.onAuthStateChange((_event,next)=>{if(mounted){setSession(next);if(_event==='PASSWORD_RECOVERY')setRecovery(true);if(_event==='SIGNED_OUT')clearGoogleSession()}});db.auth.getSession().then(({data,error:e})=>{if(mounted){if(e)setError(e.message);setSession(data.session)}}).catch(()=>{if(mounted){setError('Session indisponible.');setSession(null)}});return()=>{mounted=false;subscription.unsubscribe();stop()}},[]);
  useEffect(()=>{if(session!==undefined)SplashScreen.hideAsync().catch(()=>{})},[session]);
  const uid=session?.user?.id;
  useEffect(()=>{let active=true;setRole(null);setError('');if(uid){db.from('objeo_establishments').select('id').eq('owner_id',uid).limit(1).then(({data,error:e})=>{if(!active)return;if(e){setError('Impossible de vérifier le type de compte.');setRole('error')}else setRole(data?.length?'pro':'personal')}).catch(()=>{if(active){setRole('error');setError('Connexion indisponible.')}})}return()=>{active=false}},[uid,retry]);
  let content;
  if(session===undefined||(session&&!role&&!recovery))content=<View style={s.center}><Brand/><ActivityIndicator color={orange}/></View>;
  else if(!session)content=<Auth/>;
  else if(recovery)content=<ResetPassword done={()=>setRecovery(false)}/>;
  else if(role==='error')content=<View style={s.center}><ErrorText value={error}/><Button title="Réessayer" onPress={()=>setRetry(x=>x+1)}/><Button title="Se déconnecter" secondary onPress={()=>db.auth.signOut()}/></View>;
  else if(role==='pro')content=<NativePro key={uid} user={session.user} Brand={Brand}/>;
  else content=<NativePersonal key={uid} user={session.user} Brand={Brand}/>;
  return <SafeAreaView style={s.full}><StatusBar barStyle="dark-content"/>{linkError?<View style={{padding:12}}><ErrorText value={linkError}/><Button title="Fermer" secondary onPress={()=>setLinkError('')}/></View>:null}{content}</SafeAreaView>
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
