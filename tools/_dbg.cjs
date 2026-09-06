const { runtime, THREE } = require('./animation-test-runtime.cjs');
const V = (x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const pos=(v,n)=>v.knochen[n].getWorldPosition(V());
const nx=1,nz=0;
const RATE=Number(process.env.RATE||9);
const r=runtime(); r.env.WAND_ROLL_TEMPO=RATE; const v=r.makeVisual(['idle','kriechen','run','wandkriech_v']);
const plane=-63, normal=V(nx,0,nz), right=V(-nz,0,nx);
v.root.rotation.y=Math.atan2(-nx,-nz);
v.root.position.set(plane+nx*0.26,20,0);
const kasten={x0:-1e3,x1:plane,z0:-1e3,z1:1e3,y0:0,h:1e3};
const drin=(p)=>(p.x>kasten.x0&&p.x<kasten.x1&&p.z>kasten.z0&&p.z<kasten.z1)?kasten:null;
let vorher=null; const gross=[];
for(let i=0;i<420;i++){
  const v3 = i<120?V(0,2.6,0): i<180?V(): i<300?right.clone().multiplyScalar(4.4):V(0,-2.6,0);
  const tempo=v3.length();
  const quer=-v3.x*nz+v3.z*nx;
  const roll=process.env.NOROLL?0:(tempo>0.9?Math.atan2(-quer,v3.y):0);
  v.root.position.addScaledVector(v3,1/60);
  r.env.player.pos.copy(v.root.position);
  v.play('climb',{wandModus:'kriechen',wandKriechen:true,wandKontakt:false,tempo:process.env.NOSTOP?2.4:(tempo===0?0:2.4),speed:0},1/60);
  v.wandKriechen(1,0.3,roll,false,false,1/60);
  v.root.position.addScaledVector(normal, plane*(nx||nz)+0.26-pos(v,'hips').dot(normal));
  v.wandGriff(nx,nz,plane,0.9,null,false);
  v.ausHaus(drin,0.05);
  const jetzt={};
  for(const n of ['lefthand','righthand','leftfoot','rightfoot','head','hips']){
    jetzt[n]=pos(v,n).clone().sub(v.root.position);
    if(vorher&&i>30){const d=jetzt[n].distanceTo(vorher[n]); if(d>0.19) gross.push([i,n,+d.toFixed(3)]);}
  }
  vorher=jetzt;
}
console.log('rate',RATE,'faelle',gross.length,'groesster',gross.length?Math.max(...gross.map(g=>g[2])):0, JSON.stringify(gross.slice(0,40)));
