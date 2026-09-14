#!/usr/bin/env node
/* =========================================================================
   Schrittweite einer vorhandenen Laufbewegung vergroessern.

   Warum: Der Sprintclip des Projekts traegt gemessen 3,96 m/s. Die Figur
   sprintet aber 11 m/s, der Clip muesste also 2,78-fach laufen und haengt
   dabei am Anschlag von 3,0 - mit nur noch drei Bildern Bodenkontakt je
   Schritt. Eine Datei mit groesserer natuerlicher Schrittweite wuerde
   dasselbe Tempo mit rund 1,8-fach tragen.

   Was hier passiert: Jede Drehspur wird um ihre EIGENE Ruhelage
   gestreckt. Die Ruhelage ist der Mittelwert aller Schluesselbilder der
   Spur; jedes Schluesselbild wird von dort aus weiter hinausgedreht
     q' = slerp(mittel, q, faktor)
   Bei faktor 1 bleibt alles wie es war, bei 1,4 schwingt das Gelenk 40
   Prozent weiter. Der Takt der Bewegung bleibt dabei unveraendert - es
   wird also nichts beschleunigt, sondern nur weiter ausgeholt.

   Je Gelenk ein eigener Faktor: die Huefte darf weit ausholen, das Knie
   nur wenig (sonst ueberstreckt es), Fuss und Hand bleiben unveraendert,
   damit der Bodenkontakt nicht verdreht wird.

   Aufruf:
     node tools/anim-schrittweite.mjs <ein.glb> <aus.glb> [faktor]
   ========================================================================= */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { NodeIO } = require('@gltf-transform/core');

const [,, ein, aus, faktorArg] = process.argv;
if (!ein || !aus) {
  console.error('Aufruf: node tools/anim-schrittweite.mjs <ein.glb> <aus.glb> [faktor]');
  process.exit(1);
}
const GRUND = faktorArg ? Number(faktorArg) : 1.4;

/* Wie weit welches Gelenk zusaetzlich ausholt. Namen werden klein und
   ohne Trennzeichen verglichen, damit "mixamorig:LeftUpLeg" passt. */
const FAKTOR = [
  [/upleg|thigh/, 1.00],          // Oberschenkel: der eigentliche Schritt
  [/leg$|calf|shin/, 0.45],       // Knie: nur wenig, sonst ueberstreckt es
  [/foot|ankle/, 0.25],
  [/toe/, 0.0],
  [/arm$|shoulder/, 0.70],        // Arme schwingen mit, sonst wirkt es steif
  [/forearm|elbow/, 0.35],
  [/hand/, 0.0],
  [/spine|hips|neck|head/, 0.0],  // Rumpf unveraendert: sonst kippt die Figur
];
const anteil = (name) => {
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  for (const [re, a] of FAKTOR) if (re.test(n)) return a;
  return 0;
};

function mittelQuat(q) {
  /* Mittelwert ueber alle Schluesselbilder, Vorzeichen am ersten
     ausgerichtet - sonst heben sich q und -q gegenseitig auf. */
  let x=0,y=0,z=0,w=0;
  const n = q.length / 4;
  for (let i=0;i<n;i++){
    let a=q[i*4],b=q[i*4+1],c=q[i*4+2],d=q[i*4+3];
    if (a*q[0]+b*q[1]+c*q[2]+d*q[3] < 0) { a=-a;b=-b;c=-c;d=-d; }
    x+=a;y+=b;z+=c;w+=d;
  }
  const l = Math.hypot(x,y,z,w) || 1;
  return [x/l,y/l,z/l,w/l];
}
function slerp(a, b, t) {
  let [ax,ay,az,aw]=a, [bx,by,bz,bw]=b;
  let dot = ax*bx+ay*by+az*bz+aw*bw;
  if (dot < 0) { bx=-bx;by=-by;bz=-bz;bw=-bw; dot=-dot; }
  if (dot > 0.9995) {
    const x=ax+(bx-ax)*t, y=ay+(by-ay)*t, z=az+(bz-az)*t, w=aw+(bw-aw)*t;
    const l=Math.hypot(x,y,z,w)||1; return [x/l,y/l,z/l,w/l];
  }
  const th0=Math.acos(dot), th=th0*t;
  const s0=Math.cos(th)-dot*Math.sin(th)/Math.sin(th0), s1=Math.sin(th)/Math.sin(th0);
  return [ax*s0+bx*s1, ay*s0+by*s1, az*s0+bz*s1, aw*s0+bw*s1];
}

const io = new NodeIO();
const doc = await io.read(ein);
let geaendert = 0, gesehen = 0;
for (const anim of doc.getRoot().listAnimations()) {
  for (const ch of anim.listChannels()) {
    if (ch.getTargetPath() !== 'rotation') continue;
    const knoten = ch.getTargetNode();
    const smp = ch.getSampler();
    if (!knoten || !smp) continue;
    gesehen++;
    const a = anteil(knoten.getName() || '');
    if (a <= 0) continue;
    const k = 1 + (GRUND - 1) * a;
    const acc = smp.getOutput();
    const q = Array.from(acc.getArray());
    const mitte = mittelQuat(q);
    const neu = new Float32Array(q.length);
    for (let i=0;i<q.length/4;i++){
      const r = slerp(mitte, [q[i*4],q[i*4+1],q[i*4+2],q[i*4+3]], k);
      neu[i*4]=r[0]; neu[i*4+1]=r[1]; neu[i*4+2]=r[2]; neu[i*4+3]=r[3];
    }
    acc.setArray(neu);
    geaendert++;
  }
}
await io.write(aus, doc);
console.log(`Drehspuren gesehen ${gesehen}, veraendert ${geaendert}, Grundfaktor ${GRUND}`);
console.log(`geschrieben: ${aus}`);
