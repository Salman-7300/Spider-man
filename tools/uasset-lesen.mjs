#!/usr/bin/env node
/* Erkundung: Kopf, Namenstabelle und Exporte einer .uasset-Datei. */
import fs from 'node:fs';

export class Leser {
  constructor(buf) { this.b = buf; this.p = 0; }
  i32() { const v = this.b.readInt32LE(this.p); this.p += 4; return v; }
  u32() { const v = this.b.readUInt32LE(this.p); this.p += 4; return v; }
  i64() { const v = Number(this.b.readBigInt64LE(this.p)); this.p += 8; return v; }
  u16() { const v = this.b.readUInt16LE(this.p); this.p += 2; return v; }
  u8()  { const v = this.b.readUInt8(this.p); this.p += 1; return v; }
  f32() { const v = this.b.readFloatLE(this.p); this.p += 4; return v; }
  guid() { const g = this.b.slice(this.p, this.p + 16).toString('hex'); this.p += 16; return g; }
  str() {
    const n = this.i32();
    if (n === 0) return '';
    if (n > 0) { const s = this.b.slice(this.p, this.p + n - 1).toString('latin1'); this.p += n; return s; }
    const m = -n; const s = this.b.slice(this.p, this.p + (m - 1) * 2).toString('utf16le'); this.p += m * 2; return s;
  }
}

export function leseKopf(b) {
  const r = new Leser(b);
  const tag = r.u32();
  if (tag !== 0x9E2A83C1) throw new Error('kein .uasset');
  const legacy = r.i32();
  r.i32();                                  // LegacyUE3Version
  const verUE4 = r.i32();
  r.i32();                                  // LicenseeVersion
  const cvAnz = r.i32();                    // CustomVersions
  for (let i = 0; i < cvAnz; i++) { r.guid(); r.i32(); }
  const kopfGroesse = r.i32();
  r.str();                                  // FolderName
  const paketFlags = r.u32();
  const nameAnz = r.i32(), nameOff = r.i32();
  /* Ab 4.23 (VER_UE4_ADDED_PACKAGE_SUMMARY_LOCALIZATION_ID = 516) steht
     hier eine Lokalisierungs-Kennung. Ohne sie verrutscht ab dieser
     Stelle ALLES - die Exporttabelle stand dann bei Byte 843 Millionen. */
  if (verUE4 >= 516 && !(paketFlags & 0x80000000)) r.str();
  const gatherAnz = r.i32(), gatherOff = r.i32();
  const exportAnz = r.i32(), exportOff = r.i32();
  const importAnz = r.i32(), importOff = r.i32();
  return { legacy, verUE4, kopfGroesse, nameAnz, nameOff,
           exportAnz, exportOff, importAnz, importOff, nachKopf: r.p };
}

export function leseNamen(b, k) {
  const r = new Leser(b); r.p = k.nameOff;
  const namen = [];
  for (let i = 0; i < k.nameAnz; i++) {
    const s = r.str();
    r.u16(); r.u16();                       // Hashes (ab VER_UE4_NAME_HASHES_SERIALIZED)
    namen.push(s);
  }
  return namen;
}

export function leseExporte(b, k, namen) {
  const r = new Leser(b); r.p = k.exportOff;
  const fname = () => { const i = r.i32(); const nr = r.i32(); return nr ? `${namen[i]}_${nr - 1}` : namen[i]; };
  const aus = [];
  for (let i = 0; i < k.exportAnz; i++) {
    const e = {};
    e.classIndex = r.i32(); e.superIndex = r.i32(); e.templateIndex = r.i32(); e.outerIndex = r.i32();
    e.name = fname();
    e.flags = r.u32();
    e.serialSize = r.i64(); e.serialOffset = r.i64();
    e.forced = r.i32(); e.notForClient = r.i32(); e.notForServer = r.i32();
    r.guid();
    e.packageFlags = r.u32();
    e.notAlwaysLoaded = r.i32();
    e.isAsset = r.i32();
    e.firstDep = r.i32(); e.serBeforeSer = r.i32(); e.createBeforeSer = r.i32();
    e.serBeforeCreate = r.i32(); e.createBeforeCreate = r.i32();
    aus.push(e);
  }
  return aus;
}

export function leseImporte(b, k, namen) {
  const r = new Leser(b); r.p = k.importOff;
  const fname = () => { const i = r.i32(); const nr = r.i32(); return nr ? `${namen[i]}_${nr - 1}` : namen[i]; };
  const aus = [];
  for (let i = 0; i < k.importAnz; i++) {
    aus.push({ paket: fname(), klasse: fname(), outer: r.i32(), name: fname() });
  }
  return aus;
}

if (process.argv[1] && process.argv[1].endsWith('uasset-lesen.mjs')) {
  const b = fs.readFileSync(process.argv[2]);
  const k = leseKopf(b);
  const namen = leseNamen(b, k);
  const ex = leseExporte(b, k, namen);
  const im = leseImporte(b, k, namen);
  console.log('Kopf:', JSON.stringify(k));
  console.log('Namen:', k.nameAnz, '->', namen.slice(0, 12).join(', '), '...');
  console.log('Exporte:');
  for (const e of ex) {
    const kl = e.classIndex < 0 ? im[-e.classIndex - 1].name : (ex[e.classIndex - 1] || {}).name;
    console.log(`  ${e.name}  Klasse=${kl}  Offset=${e.serialOffset}  Groesse=${e.serialSize}`);
  }
  console.log('Datei:', b.length);
}

/* ---------- Getaggte Eigenschaften ----------
   UE4 schreibt Eigenschaften als Kette: Name, Typ, Groesse, Index, je nach
   Typ ein paar Zusatzangaben, dann der Wert. Die Kette endet mit dem Namen
   "None". Wir lesen nur, was wir brauchen, und ueberspringen den Rest
   anhand der Groesse. */
export function leseEigenschaften(r, namen) {
  const fname = () => { const i = r.i32(); const nr = r.i32(); return nr ? `${namen[i]}_${nr - 1}` : namen[i]; };
  const aus = {};
  for (;;) {
    const name = fname();
    if (name === 'None' || name === undefined) break;
    const typ = fname();
    const groesse = r.i32();
    r.i32();                                  // ArrayIndex
    let innerTyp = null, structName = null;
    if (typ === 'StructProperty') { structName = fname(); r.guid(); }
    else if (typ === 'BoolProperty') { r.u8(); }
    else if (typ === 'ByteProperty' || typ === 'EnumProperty') { fname(); }
    else if (typ === 'ArrayProperty') { innerTyp = fname(); }
    else if (typ === 'SetProperty' || typ === 'MapProperty') { fname(); if (typ === 'MapProperty') fname(); }
    r.u8();                                   // HasPropertyGuid
    const start = r.p;
    if (typ === 'FloatProperty') aus[name] = r.f32();
    else if (typ === 'IntProperty') aus[name] = r.i32();
    else if (typ === 'NameProperty') aus[name] = fname();
    else if (typ === 'ArrayProperty' && innerTyp === 'NameProperty') {
      const n = r.i32(); const l = [];
      for (let i = 0; i < n; i++) l.push(fname());
      aus[name] = l;
    }
    r.p = start + groesse;                    // immer sauber weiterspringen
    if (typ === 'BoolProperty') aus[name] = true;
  }
  return aus;
}

/* ---- Listen von FVector / FQuat ----
   ACHTUNG: diese Listen stehen im "Bulk"-Format, also ELEMENTGROESSE
   zuerst, dann die Anzahl, dann die Daten. Wer nur die Anzahl erwartet,
   liest die Groesse als Anzahl und laeuft sofort aus der Datei
   (gemessen: 12 statt 799 Schluessel). */
function liesListe(r, breite) {
  const gr = r.i32(), n = r.i32();
  if (gr !== breite * 4) throw new Error(`Elementgroesse ${gr}, erwartet ${breite * 4}`);
  const a = [];
  for (let i = 0; i < n; i++) {
    const v = [];
    for (let j = 0; j < breite; j++) v.push(r.f32());
    a.push(v);
  }
  return a;
}

/* ---------- Skelett ----------
   Nach den Eigenschaften folgt in USkeleton::Serialize die
   ReferenceSkeleton: erst die Knochenliste (Name, Elternindex,
   Exportname), dann die Ruhehaltung als FTransform je Knochen. */
export function leseSkelett(datei) {
  const b = fs.readFileSync(datei);
  const k = leseKopf(b);
  const namen = leseNamen(b, k);
  const ex = leseExporte(b, k, namen);
  const im = leseImporte(b, k, namen);
  const e = ex.find((x) => (x.classIndex < 0 ? im[-x.classIndex - 1].name : '') === 'Skeleton');
  if (!e) throw new Error('kein Skeleton-Export');
  const r = new Leser(b); r.p = e.serialOffset;
  leseEigenschaften(r, namen);
  /* Wie bei der Bewegung wird die Anfangsstelle gesucht statt geraten:
     erst die Knochenliste (je Eintrag ein FName mit 8 Byte und der
     Elternindex, zusammen 12 Byte), dann noch einmal dieselbe Anzahl und
     je Knochen eine FTransform mit 40 Byte. Beides muss zusammenpassen. */
  const fname = () => { const i = r.i32(); const nr = r.i32(); return nr ? `${namen[i]}_${nr - 1}` : namen[i]; };
  /* Ein Eintrag der Knochenliste ist NICHT gleich lang: auf FName und
     Elternindex folgt noch der Exportname als Zeichenkette. Deshalb wird
     die Liste probeweise durchlaufen und geprueft, ob dahinter dieselbe
     Anzahl noch einmal steht - davor kommen die Ruhehaltungen. */
  let start = -1, anz = 0;
  for (let off = r.p - 8; off < r.p + 256 && off + 8 <= b.length; off++) {
    const n = b.readInt32LE(off);
    if (n < 2 || n > 4096) continue;
    if (b.readInt32LE(off + 4 + 8) !== -1) continue;      // erster Knochen ohne Elter
    const probe = new Leser(b); probe.p = off + 4;
    let gut = true;
    try {
      for (let i = 0; i < n; i++) { probe.i32(); probe.i32(); probe.i32(); probe.str(); }
    } catch (err) { gut = false; }
    if (!gut || probe.p + 4 > b.length || b.readInt32LE(probe.p) !== n) continue;
    start = off; anz = n; break;
  }
  if (start < 0) throw new Error('Referenzskelett nicht gefunden');
  r.p = start + 4;
  const knochen = [];
  for (let i = 0; i < anz; i++) {
    const nm = fname(); const eltern = r.i32(); r.str();
    knochen.push({ name: nm, eltern });
  }
  r.i32();                                    // Anzahl der Ruhehaltungen
  for (let i = 0; i < anz; i++) {
    knochen[i].r = [r.f32(), r.f32(), r.f32(), r.f32()];
    knochen[i].t = [r.f32(), r.f32(), r.f32()];
    knochen[i].s = [r.f32(), r.f32(), r.f32()];
  }
  return knochen;
}

/* ---------- Bewegung ----------
   In UAnimSequence::Serialize folgt nach den Eigenschaften ein
   FStripDataFlags (zwei Byte) und dann RawAnimationData: je Spur die
   Listen PosKeys, RotKeys und ScaleKeys. Genau diese Rohdaten wollen wir -
   sie sind unkomprimiert und brauchen keinen Decoder. */
export function leseBewegung(datei) {
  const b = fs.readFileSync(datei);
  const k = leseKopf(b);
  const namen = leseNamen(b, k);
  const ex = leseExporte(b, k, namen);
  const im = leseImporte(b, k, namen);
  const e = ex.find((x) => (x.classIndex < 0 ? im[-x.classIndex - 1].name : '') === 'AnimSequence');
  if (!e) throw new Error('kein AnimSequence-Export');
  const r = new Leser(b); r.p = e.serialOffset;
  const eig = leseEigenschaften(r, namen);
  const spurZahl = (eig.AnimationTrackNames || []).length;
  /* Zwischen den Eigenschaften und den Rohdaten stehen ein paar Bytes,
     deren genaue Bedeutung je nach Engine-Fassung wechselt (eine Kennung
     und die Strip-Flags). Statt das zu raten, wird die Anfangsstelle
     GESUCHT: dort steht die Anzahl der Spuren, und von da aus muss sich
     die ganze Liste sauber bis zum Ende durchlaufen lassen. */
  const exEnde = e.serialOffset + e.serialSize;
  let start = -1;
  for (let off = r.p - 8; off < r.p + 128 && off + 4 <= b.length; off++) {
    if (b.readInt32LE(off) !== spurZahl) continue;
    const probe = new Leser(b); probe.p = off + 4;
    try {
      for (let i = 0; i < spurZahl; i++) { liesListe(probe, 3); liesListe(probe, 4); liesListe(probe, 3); }
      if (probe.p <= exEnde) { start = off; break; }
    } catch (err) { /* naechste Stelle */ }
  }
  if (start < 0) throw new Error('Rohdaten nicht gefunden');
  r.p = start + 4;
  const spuren = [];
  for (let i = 0; i < spurZahl; i++) {
    const pos = liesListe(r, 3);
    const rot = liesListe(r, 4);
    const skal = liesListe(r, 3);
    spuren.push({ pos, rot, skal });
  }
  return { name: e.name, eigenschaften: eig, spuren,
           knochen: eig.AnimationTrackNames || [],
           dauer: eig.SequenceLength, bilder: eig.NumFrames };
}
