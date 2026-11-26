// Keep Gradle 9 compatible after npm install. Idempotent.
const fs=require('node:fs');const path=require('node:path');
const f=path.join(__dirname,'..','node_modules','@react-native','gradle-plugin','settings.gradle.kts');
if(fs.existsSync(f)){const old=fs.readFileSync(f,'utf8');const next=old.replace(/(foojay-resolver-convention[^\n]*?)(0\.5\.0)/g,(_match,prefix)=>prefix+'1.0.0');if(next!==old){fs.writeFileSync(f,next);console.log('Gradle Foojay 1.0.0 compatibility applied.');}}
