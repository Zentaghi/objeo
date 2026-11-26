// Never replace the Play app until the exact package/version is confirmed.
module.exports=({config})=>{
  const googleWebClientId=process.env.OBJEO_GOOGLE_WEB_CLIENT_ID||'145880135367-7ccem9ronic2vle55el38ngo3h30q09e.apps.googleusercontent.com';
  config={...config,extra:{...config.extra,googleWebClientId}};
  if(process.env.OBJEO_RELEASE!=='1')return config;
  const id=process.env.OBJEO_PLAY_PACKAGE, code=Number(process.env.OBJEO_PLAY_VERSION_CODE);
  if(!['online.objeo.app','online.objeo.twa'].includes(id)||!Number.isSafeInteger(code)||code<2||code>2100000000)throw new Error('Production: renseigner OBJEO_PLAY_PACKAGE et OBJEO_PLAY_VERSION_CODE depuis Play Console.');
  return {...config,name:'Objeo',scheme:'objeo',extra:{...config.extra,authScheme:'objeo',checkoutLive:process.env.OBJEO_ENABLE_LIVE_CHECKOUT==='1'},version:process.env.OBJEO_PLAY_VERSION||'1.0.0',android:{...config.android,package:id,versionCode:code}};
};
