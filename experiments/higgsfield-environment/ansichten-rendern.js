/* Sichtprüfung der erzeugten GLB: vier Ansichten plus eine Dachaufsicht.
   Zahlen allein sagen nichts darüber, ob das Dach begehbar aussieht. */
const { chromium } = require('playwright');
const path=require('path'), fs=require('fs');
const HIER=__dirname, SPIEL='/home/user/Spider-man';
(async()=>{
  const datei=process.argv[2], name=process.argv[3];
  const b=await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await b.newPage({viewport:{width:900,height:700}});
  page.on('pageerror',e=>console.log('PAGEERROR:',e.message));
  page.on('console',m=>{ if(m.type()==='error') console.log('CONSOLE:',m.text()); });
  await page.route('http://pruef.test/**',(r)=>{
    const p=new URL(r.request().url()).pathname;
    if(p==='/'||p==='/index.html') return r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<html><body style="margin:0"></body></html>'});
    if(p==='/three.js') return r.fulfill({path:path.join(HIER,'../node_modules/three/build/three.min.js'),contentType:'application/javascript'});
    if(p==='/GLTFLoader.js') return r.fulfill({path:path.join(SPIEL,'lib/GLTFLoader.js'),contentType:'application/javascript'});
    if(p==='/modell.glb') return r.fulfill({path:datei,contentType:'model/gltf-binary'});
    return r.fulfill({status:404,body:'nf'});
  });
  await page.goto('http://pruef.test/');
  await page.addScriptTag({url:'http://pruef.test/three.js'});
  await page.addScriptTag({url:'http://pruef.test/GLTFLoader.js'});
  const info=await page.evaluate(async()=>{
    const sz=new THREE.Scene(); sz.background=new THREE.Color(0xdde3e8);
    sz.add(new THREE.HemisphereLight(0xffffff,0x666a70,1.1));
    const dl=new THREE.DirectionalLight(0xffffff,0.9); dl.position.set(3,6,4); sz.add(dl);
    const rend=new THREE.WebGLRenderer({antialias:true});
    rend.setSize(900,700); document.body.appendChild(rend.domElement);
    const kam=new THREE.PerspectiveCamera(35,900/700,0.01,200);
    const gltf=await new Promise((ok,f)=>new THREE.GLTFLoader().load('/modell.glb',ok,undefined,f));
    const o=gltf.scene; sz.add(o);
    const bb=new THREE.Box3().setFromObject(o); const gr=bb.getSize(new THREE.Vector3());
    const mi=bb.getCenter(new THREE.Vector3());
    window.__m={o,sz,rend,kam,bb,gr,mi};
    return { groesse:[+gr.x.toFixed(3),+gr.y.toFixed(3),+gr.z.toFixed(3)],
             mitte:[+mi.x.toFixed(3),+mi.y.toFixed(3),+mi.z.toFixed(3)],
             minY:+bb.min.y.toFixed(3) };
  });
  const blicke=[['vorn',0,0.25],['seite',Math.PI/2,0.25],['hinten',Math.PI,0.25],
                ['unten',0.6,-0.5],['dach',0.6,1.35]];
  for(const [bez,winkel,hoehe] of blicke){
    await page.evaluate(([w,h])=>{
      const {kam,gr,mi,rend,sz}=window.__m;
      const r=Math.max(gr.x,gr.y,gr.z)*2.1;
      kam.position.set(mi.x+Math.sin(w)*r, mi.y+gr.y*h, mi.z+Math.cos(w)*r);
      kam.lookAt(mi.x,mi.y,mi.z); kam.updateProjectionMatrix();
      rend.render(sz,kam);
    },[winkel,hoehe]);
    await page.screenshot({path:path.join(HIER,name+'_'+bez+'.png')});
  }
  console.log(JSON.stringify(info));
  await b.close();
})();
