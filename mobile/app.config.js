// Never replace the Play app until the exact package/version is confirmed.
module.exports=({config})=>{
  const googleWebClientId=process.env.OBJEO_GOOGLE_WEB_CLIENT_ID||'145880135367-a6pivuiv13chs4139iaq18c6rmt98ooh.apps.googleusercontent.com';
  config={...config,extra:{...config.extra,googleWebClientId}};
  const release=process.env.OBJEO_RELEASE==='1';
  const id=release?(process.env.OBJEO_PLAY_PACKAGE||'online.objeo.app'):config.android.package;
  const code=Number(process.env.OBJEO_PLAY_VERSION_CODE||'3');
  if(release&&(id!=='online.objeo.app'||!Number.isSafeInteger(code)||code<3||code>2100000000))throw Error('Production: le package Play confirmé est online.objeo.app, avec versionCode >= 3.');
  const fs=require('fs'),path=require('path');
  let firebaseFile=process.env.OBJEO_GOOGLE_SERVICES_FILE||(!release?'./config/firebase-preview.json':undefined);
  if(release&&!firebaseFile){
    // The supplied Firebase JSON contains both registrations with identical client credentials.
    // Reconstruct only the confirmed production registration; never commit another API key.
    const source=JSON.parse(fs.readFileSync(path.join(__dirname,'config/firebase-preview.json'),'utf8'));
    if(source.project_info?.project_id!=='objeo-515101'||source.client?.length!==1||source.client[0].client_info.android_client_info.package_name!=='online.objeo.nativepreview')throw Error('Configuration Firebase source invalide.');
    source.client[0].client_info={mobilesdk_app_id:'1:145880135367:android:c475cb54dcf0b5227ef0e2',android_client_info:{package_name:id}};
    firebaseFile='./config/firebase-production.generated.json';
    fs.writeFileSync(path.resolve(__dirname,firebaseFile),JSON.stringify(source,null,2)+'\n',{mode:0o600});
  }
  if(firebaseFile){
    const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,firebaseFile),'utf8'));
    const expectedPackage=id;
    if(data.project_info?.project_id!=='objeo-515101'||!data.client?.some(c=>c.client_info?.android_client_info?.package_name===expectedPackage))throw Error('Le fichier Firebase ne correspond pas au package Android de ce build.');
  }
  const appId=process.env.OBJEO_ADMOB_APP_ID||'ca-app-pub-4859910650106234~8616753270', bannerId=process.env.OBJEO_ADMOB_BANNER_ID||'ca-app-pub-4859910650106234/5990589931';
  const liveAds=release&&process.env.OBJEO_ENABLE_ADS==='1';
  if(liveAds&&(!/^ca-app-pub-\d+~\d+$/.test(appId||'')||!/^ca-app-pub-\d+\/\d+$/.test(bannerId||'')||appId.startsWith('ca-app-pub-3940256099942544')||bannerId.startsWith('ca-app-pub-3940256099942544')))throw Error('Identifiants AdMob de production manquants.');
  config={...config,android:{...config.android,...(firebaseFile?{googleServicesFile:firebaseFile}:{})},plugins:[...(config.plugins||[]),['expo-notifications',{color:'#ff6e14',defaultChannel:'objeo'}],['react-native-google-mobile-ads',{androidAppId:release?appId:'ca-app-pub-3940256099942544~3347511713',delayAppMeasurementInit:true}]],extra:{...config.extra,pushConfigured:!!firebaseFile,adsEnabled:liveAds||(!release&&process.env.OBJEO_TEST_ADS==='1'),adBannerId:liveAds?bannerId:null}};
  if(!release)return config;
  return {...config,name:'Objeo',scheme:'objeo',extra:{...config.extra,authScheme:'objeo',checkoutLive:process.env.OBJEO_ENABLE_LIVE_CHECKOUT==='1'},version:process.env.OBJEO_PLAY_VERSION||'2.0.0',android:{...config.android,package:id,versionCode:code}};
};
