// Never replace the Play app until the exact package/version is confirmed.
module.exports=({config})=>{
  const googleWebClientId=process.env.OBJEO_GOOGLE_WEB_CLIENT_ID||'145880135367-a6pivuiv13chs4139iaq18c6rmt98ooh.apps.googleusercontent.com';
  config={...config,extra:{...config.extra,googleWebClientId}};
  const release=process.env.OBJEO_RELEASE==='1';
  const firebaseFile=process.env.OBJEO_GOOGLE_SERVICES_FILE;
  const appId=process.env.OBJEO_ADMOB_APP_ID, bannerId=process.env.OBJEO_ADMOB_BANNER_ID;
  const liveAds=release&&process.env.OBJEO_ENABLE_ADS==='1';
  if(liveAds&&(!/^ca-app-pub-\d+~\d+$/.test(appId||'')||!/^ca-app-pub-\d+\/\d+$/.test(bannerId||'')||appId.startsWith('ca-app-pub-3940256099942544')||bannerId.startsWith('ca-app-pub-3940256099942544')))throw Error('Identifiants AdMob de production manquants.');
  config={...config,android:{...config.android,...(firebaseFile?{googleServicesFile:firebaseFile}:{})},plugins:[...(config.plugins||[]),['expo-notifications',{color:'#ff6e14',defaultChannel:'objeo'}],['react-native-google-mobile-ads',{androidAppId:liveAds?appId:'ca-app-pub-3940256099942544~3347511713',delayAppMeasurementInit:true}]],extra:{...config.extra,pushConfigured:!!firebaseFile,adsEnabled:liveAds||(!release&&process.env.OBJEO_TEST_ADS==='1'),adBannerId:liveAds?bannerId:null}};
  if(!release)return config;
  const id=process.env.OBJEO_PLAY_PACKAGE, code=Number(process.env.OBJEO_PLAY_VERSION_CODE);
  if(!['online.objeo.app','online.objeo.twa'].includes(id)||!Number.isSafeInteger(code)||code<2||code>2100000000)throw new Error('Production: renseigner OBJEO_PLAY_PACKAGE et OBJEO_PLAY_VERSION_CODE depuis Play Console.');
  return {...config,name:'Objeo',scheme:'objeo',extra:{...config.extra,authScheme:'objeo',checkoutLive:process.env.OBJEO_ENABLE_LIVE_CHECKOUT==='1'},version:process.env.OBJEO_PLAY_VERSION||'1.0.0',android:{...config.android,package:id,versionCode:code}};
};
