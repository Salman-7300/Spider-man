/* GLB-Pruefung ohne Three.js: JSON-Chunk lesen und die Zahlen nennen,
   die im MODEL-BRIEF stehen - Dreiecke, Knoten, Materialien, Masse. */
const fs=require('fs');
const f=process.argv[2];
const b=fs.readFileSync(f);
if(b.readUInt32LE(0)!==0x46546C67){ console.log('kein GLB'); process.exit(1); }
let off=12, json=null;
while(off<b.length){
  const len=b.readUInt32LE(off), typ=b.readUInt32LE(off+4);
  if(typ===0x4E4F534A) json=JSON.parse(b.slice(off+8,off+8+len).toString('utf8'));
  off+=8+len;
}
const g=json;
let tris=0, verts=0;
const acc=g.accessors||[];
for(const m of (g.meshes||[])) for(const p of m.primitives){
  const modus=p.mode===undefined?4:p.mode;
  if(p.indices!==undefined){ const n=acc[p.indices].count; if(modus===4) tris+=n/3; }
  else if(p.attributes.POSITION!==undefined){ const n=acc[p.attributes.POSITION].count; if(modus===4) tris+=n/3; }
  if(p.attributes.POSITION!==undefined) verts+=acc[p.attributes.POSITION].count;
}
/* Grenzen aus den POSITION-Accessoren (min/max sind Pflicht) */
let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
for(const a of acc){ if(a.type==='VEC3'&&a.min&&a.max){
  for(let i=0;i<3;i++){ if(a.min[i]<mn[i])mn[i]=a.min[i]; if(a.max[i]>mx[i])mx[i]=a.max[i]; } } }
const groesse=[mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]].map(v=>+v.toFixed(3));
console.log(JSON.stringify({
  datei:f.split('/').pop(),
  bytes:b.length,
  dreiecke:Math.round(tris), eckpunkte:verts,
  meshes:(g.meshes||[]).length,
  knoten:(g.nodes||[]).map(n=>n.name||'(ohne Namen)'),
  materialien:(g.materials||[]).map(m=>m.name||'(ohne Namen)'),
  texturen:(g.images||[]).length,
  animationen:(g.animations||[]).length,
  skins:(g.skins||[]).length,
  groesseXYZ:groesse,
  minY:+mn[1].toFixed(3), maxY:+mx[1].toFixed(3)
},null,1));
