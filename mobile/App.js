import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, Image, FlatList, ScrollView, StyleSheet, ActivityIndicator, StatusBar, KeyboardAvoidingView, Share, BackHandler, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { db, bindRefresh, photoUrl } from './supabase';
import { NativePersonal, NativePro } from './NativeFeatures';
import { LegalModal } from './LegalModal';
import { establishmentsFor } from './ProTools';
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
function GoogleButton({onPress,disabled}){
  return <Pressable accessibilityRole="button" accessibilityLabel="Continuer avec Google" disabled={disabled} onPress={onPress} style={({pressed})=>[s.googleButton,(disabled||pressed)&&{opacity:disabled ? 0.5 : 0.8}]}>
    <View style={s.googleIcon} accessibilityElementsHidden importantForAccessibility="no">
      <Svg width={22} height={22} viewBox="0 0 48 48">
        <Path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.43h11.02a9.42 9.42 0 0 1-4.09 6.18v5.14h6.62c3.87-3.57 6.06-8.83 6.06-14.83z"/>
        <Path fill="#34A853" d="M24 44c5.4 0 9.92-1.79 13.55-4.71l-6.62-5.14c-1.83 1.23-4.17 1.96-6.93 1.96-5.22 0-9.65-3.52-11.23-8.25H5.94v5.31A20 20 0 0 0 24 44z"/>
        <Path fill="#FBBC05" d="M12.77 27.86a12.02 12.02 0 0 1 0-7.72v-5.31H5.94a20 20 0 0 0 0 18.34l6.83-5.31z"/>
        <Path fill="#EA4335" d="M24 11.89c3.01 0 5.7 1.04 7.83 3.08l5.87-5.87A19.63 19.63 0 0 0 24 4 20 20 0 0 0 5.94 14.83l6.83 5.31c1.58-4.73 6.01-8.25 11.23-8.25z"/>
      </Svg>
    </View><Text style={s.googleText}>Continuer avec Google</Text>
  </Pressable>;
}
function googleError(e){
  const message=String(e?.message||'');
  if(/services Google Play|Google Play services|PLAY_SERVICES/i.test(message))return 'La connexion Google est indisponible sur cet appareil. Utilisez votre adresse e-mail.';
  if(/network|fetch|connexion réseau/i.test(message))return 'Vérifiez votre connexion Internet, puis réessayez.';
  return 'Impossible de se connecter avec Google pour le moment. Réessayez ou utilisez votre adresse e-mail.';
}
function Brand(){return <View style={s.brand}><Image source={logo} style={{width:46,height:46}} resizeMode="contain"/><Text style={s.word}>Objeo</Text></View>}
function Field({label,...props}){return <View style={{gap:6}}><Text style={s.label}>{label}</Text><TextInput placeholderTextColor="#737b85" style={s.input} {...props}/></View>}
function ErrorText({value}){return value?<Text accessibilityRole="alert" style={s.error}>{value}</Text>:null}
function Auth(){
  const [legal,setLegal]=useState(null);
  const [mode,setMode]=useState('welcome'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function google(){if(busy)return;setBusy(true);setError('');setNotice('');try{await googleLogin()}catch(e){setError(googleError(e))}finally{setBusy(false)}}
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
    <GoogleButton disabled={busy} onPress={google}/>
    <View style={s.authDivider}><View style={s.dividerLine}/><Text style={s.dividerText}>ou par e-mail</Text><View style={s.dividerLine}/></View>
    {mode==='welcome'?<><Button title="S’identifier" disabled={busy} onPress={()=>{setMode('login');setError('');setNotice('')}}/><Button title="Créer un compte gratuit" secondary disabled={busy} onPress={()=>{setMode('signup');setError('');setNotice('')}}/></>:<>
    {mode==='signup'&&<Field label="Nom" value={name} onChangeText={setName} autoComplete="name"/>}
    <Field label="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/>
    <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode==='signup'?'new-password':'current-password'}/>
    <Button title={busy?'Connexion en cours…':mode==='signup'?'Créer mon compte':'Se connecter'} disabled={busy} onPress={submit}/>
    <Button title="Retour" secondary onPress={()=>{setMode('welcome');setError('');setNotice('')}}/>
    </>}
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
  useEffect(()=>{let active=true;setRole(null);setError('');if(uid){establishmentsFor({id:uid}).then(data=>{if(active)setRole({uid,retry,kind:data.length?'pro':'personal'})}).catch(()=>{if(active){setRole({uid,retry,kind:'error'});setError('Impossible de vérifier le type de compte.')}})}return()=>{active=false}},[uid,retry]);
  let content;
  if(session===undefined||(session&&(!role||role.uid!==uid||role.retry!==retry)&&!recovery))content=<View style={s.center}><Brand/><ActivityIndicator color={orange}/></View>;
  else if(!session)content=<Auth/>;
  else if(recovery)content=<ResetPassword done={()=>setRecovery(false)}/>;
  else if(role?.kind==='error')content=<View style={s.center}><ErrorText value={error}/><Button title="Réessayer" onPress={()=>setRetry(x=>x+1)}/><Button title="Se déconnecter" secondary onPress={()=>db.auth.signOut()}/></View>;
  else if(role?.kind==='pro')content=<NativePro key={uid} user={session.user} Brand={Brand}/>;
  else content=<NativePersonal key={uid} user={session.user} Brand={Brand} onRoleChange={()=>setRetry(x=>x+1)}/>;
  return <SafeAreaView style={s.full}><StatusBar barStyle="dark-content"/>{linkError?<View style={{padding:12}}><ErrorText value={linkError}/><Button title="Fermer" secondary onPress={()=>setLinkError('')}/></View>:null}{content}</SafeAreaView>
}
export default function App(){return <SafeAreaProvider><Root/></SafeAreaProvider>}
const s=StyleSheet.create({
  full:{flex:1,backgroundColor:'#fff'},auth:{flexGrow:1,justifyContent:'center',padding:24,gap:16},
  center:{flex:1,justifyContent:'center',padding:24,gap:18},brand:{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start'},word:{fontSize:34,fontWeight:'900',color:ink,letterSpacing:-1.6},
  h1:{fontSize:27,fontWeight:'800',color:ink,letterSpacing:-.8},body:{fontSize:16,lineHeight:24,color:ink},muted:{fontSize:14,color:'#626b78'},small:{fontSize:12,color:'#626b78',lineHeight:18},label:{fontSize:13,fontWeight:'600',color:ink},
  button:{backgroundColor:orange,padding:15,borderRadius:12,alignItems:'center'},secondary:{backgroundColor:'#fff',borderColor:'#dfe3e8',borderWidth:1},buttonText:{color:'#fff',fontSize:16,fontWeight:'700'},input:{padding:13,borderWidth:1,borderColor:'#dfe3e8',borderRadius:12,backgroundColor:'#fff',fontSize:15,color:ink},
  googleButton:{minHeight:54,borderWidth:1,borderColor:'#747775',borderRadius:12,backgroundColor:'#fff',flexDirection:'row',alignItems:'center',justifyContent:'center',paddingHorizontal:46,paddingVertical:14},googleIcon:{position:'absolute',left:17},googleText:{color:'#1f1f1f',fontSize:15,fontWeight:'600',textAlign:'center'},authDivider:{flexDirection:'row',alignItems:'center',gap:12},dividerLine:{flex:1,height:1,backgroundColor:'#e4e7eb'},dividerText:{color:'#626b78',fontSize:13},
  error:{color:'#b42318',fontSize:14},link:{color:'#ad4800',fontSize:15,fontWeight:'600'},header:{paddingHorizontal:18,paddingVertical:8,borderBottomWidth:1,borderColor:'#eee'},page:{padding:20,gap:16},pageTop:{padding:18,gap:10},
  chips:{flexDirection:'row',gap:8},chip:{paddingHorizontal:15,paddingVertical:9,borderRadius:18,backgroundColor:'#f0f1f3'},activeChip:{backgroundColor:orange},list:{paddingHorizontal:18,paddingBottom:16,gap:10},card:{borderWidth:1,borderColor:'#e7e9ed',borderRadius:14,flexDirection:'row',padding:10,gap:12,alignItems:'center'},thumb:{width:88,height:88,borderRadius:10,backgroundColor:'#f4f4f5'},placeholder:{alignItems:'center',justifyContent:'center'},tag:{color:'#b94d08',fontSize:12,fontWeight:'700'},cardTitle:{fontSize:16,fontWeight:'700',color:ink},heroImage:{width:'100%',height:250,borderRadius:12,backgroundColor:'#f4f4f5'},
  nav:{flexDirection:'row',borderTopWidth:1,borderColor:'#e7e9ed',paddingVertical:8},navItem:{flex:1,alignItems:'center',gap:3},navIcon:{fontSize:24,color:ink}
});
