import React,{useEffect,useState} from 'react';
import {View,Text,Pressable} from 'react-native';
import Constants from 'expo-constants';
import mobileAds,{AdsConsent,BannerAd,BannerAdSize,TestIds} from 'react-native-google-mobile-ads';
const enabled=Constants.expoConfig?.extra?.adsEnabled===true;
let initialized=false,pending;
async function prepare(){if(!enabled)return false;if(!pending)pending=(async()=>{try{const info=await AdsConsent.gatherConsent();if(!info.canRequestAds)return false;await mobileAds().initialize();initialized=true;return true}catch{return false}})();return pending}
export function AdBanner(){const [ready,R]=useState(false);useEffect(()=>{let active=true;prepare().then(v=>{if(active)R(v)});return()=>{active=false}},[]);if(!ready||!initialized)return null;return <View style={{alignItems:'center',paddingTop:3}}><Text style={{fontSize:10,color:'#69717c'}}>Publicité</Text><BannerAd unitId={Constants.expoConfig?.extra?.adBannerId||TestIds.BANNER} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{requestNonPersonalizedAdsOnly:true}}/></View>}
export function AdsPrivacy(){const [error,E]=useState('');if(!enabled)return null;return <View><Pressable accessibilityRole="button" onPress={async()=>{try{await AdsConsent.showPrivacyOptionsForm();const info=await AdsConsent.getConsentInfo();if(!info.canRequestAds){initialized=false;pending=Promise.resolve(false)}}catch{E('Préférences indisponibles pour le moment.')}} style={{padding:13,borderWidth:1,borderColor:'#dfe3e8',borderRadius:12}}><Text style={{textAlign:'center',fontWeight:'700'}}>Préférences publicitaires</Text></Pressable>{error?<Text>{error}</Text>:null}</View>}
