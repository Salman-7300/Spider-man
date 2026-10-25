/* WEB HERO: native, offline 3D city assets. Geometry only; no gameplay state. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.WEB_HERO_VISUALS = factory(root.THREE);
})(typeof window === 'object' ? window : this, function (THREE) {
  'use strict';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const blend = (rate, dt) => 1 - Math.exp(-rate * Math.max(0, dt));
  const enabled = typeof location === 'undefined' || !/[?&]classicVisuals=1(?:&|$)/.test(location.search);
  const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const plane = new THREE.PlaneGeometry(1, 1).toNonIndexed();
  const up = new THREE.Vector3(0, 1, 0);
  const materials = {
    stone: new THREE.MeshLambertMaterial({ vertexColors: true }),
    /* Deckkraft 0,23 liess die Scheiben aus der Naehe verschwinden: beim
       Klettern hing die Figur scheinbar in einem schwarzen Loch statt an
       einer Fensterfront - im hochgeladenen Spielvideo war das der
       staerkste unrealistische Eindruck. Mit 0,42 lesen sich die Scheiben
       als Glas, der Raum dahinter bleibt aber sichtbar (Moebel, Lampen,
       Jalousien); der Regressionstest prueft genau das weiter. */
    glass: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 95, specular: 0xb6ceda,
      transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }),
    /* Die Scheiben der Hochhaeuser. Bei 0,42 und hellen Scheibenfarben las
       sich das Glas aus der Naehe als offenes Loch: im Human-Video (problem-3,
       Blocker 1) hing die Figur scheinbar mitten in einer Fensteroeffnung,
       obwohl sie 0,15 m vor der Scheibe klettert. Jetzt eigene, getoente
       Scheiben (Farbe je Turmstil) mit 0,7 Deckkraft und kraeftigem
       Glanzlicht - der Raum dahinter bleibt sichtbar, aber gedaempft. */
    fassadenGlas: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 110, specular: 0xd8e6ee,
      transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
    trim: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 32, specular: 0x596370 }),
    /* Die Scheiben der Hochhaeuser seit CITY V2 Stufe 8A: die Geschosse
       zeigen ihren Raum im Glas (innenraumPatch, Modus 1), die Lobby ist
       klares Glas vor dem echten, eingerichteten Raum (Modus 3). Deckkraft
       0,42 gilt fuer das klare Glas; die Raumscheiben decken im Shader. */
    innenGlas: new THREE.MeshPhongMaterial({ color: 0x0a0c0e, shininess: 110, specular: 0xd8e6ee,
      transparent: true, opacity: 0.42, depthWrite: false, side: THREE.FrontSide }),
    windows: new THREE.MeshPhongMaterial({ color: 0x718b99, transparent: true,
      opacity: 0.25, depthWrite: false, shininess: 45 }),
    light: new THREE.MeshBasicMaterial({ vertexColors: true }),
    /* Ausruestung an Figuren - Rucksaecke, Westen, Gurte. Bewusst ein
       eigenes Material: sobald stone eine Fassadentextur bekommt,
       haetten sonst alle Rucksaecke Mauerwerk.
       Phong statt Lambert, mit schwachem Glanz. Ein voellig mattes
       Material neben dem lackierten Anzug der Figuren las sich als
       Papier - das war der zweite Grund fuer den Karton-Eindruck. Ein
       Plattentraeger aus Ballistiknylon glaenzt schwach, nicht wie
       Metall; deshalb shininess 16 und ein dunkles Specular. */
    figur: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 13,
      specular: 0x232830 }),
  };

  /* Wie viele Meter eine Kachel der Oberflaechentextur abdeckt. Die UVs
     entstehen aus der Weltposition, nicht aus einer Auswicklung - fuer
     Mauerwerk ist das richtig so: zwei gleich hohe Haeuser bekommen
     dieselbe Steingroesse, und an keiner Kante entsteht eine Naht. */
  const TEXTUR_METER = 2.4;

  // One draw call per surface group, never one per window or brick.
  class Batch {
    constructor() { this.p = []; this.n = []; this.c = []; this.u = []; }
    /* Dreifachprojektion: jeder Eckpunkt wird entlang seiner staerksten
       Normalenachse auf eine Ebene projiziert. Damit braucht keine der
       Aufrufstellen eigene Texturkoordinaten, und Boxen, Loft-Koerper und
       Polygone werden gleich behandelt. */
    uv(x, y, z, nx, ny, nz) {
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      let u, v2;
      if (ay >= ax && ay >= az) { u = x; v2 = z; }        // Boden und Dach
      else if (ax >= az) { u = z; v2 = y; }               // Seitenwaende
      else { u = x; v2 = y; }                             // Vorder- und Rueckwand
      this.u.push(u / TEXTUR_METER, v2 / TEXTUR_METER);
    }
    geometry(g, color, matrix) {
      const p = g.attributes.position, n = g.attributes.normal;
      const v = new THREE.Vector3(), nn = new THREE.Vector3();
      const normal = new THREE.Matrix3().getNormalMatrix(matrix);
      const c = new THREE.Color(color);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(matrix);
        nn.fromBufferAttribute(n, i).applyMatrix3(normal).normalize();
        this.p.push(v.x, v.y, v.z); this.n.push(nn.x, nn.y, nn.z); this.c.push(c.r, c.g, c.b);
        this.uv(v.x, v.y, v.z, nn.x, nn.y, nn.z);
      }
    }
    box(w, h, d, x, y, z, color, ry = 0) {
      const q = new THREE.Quaternion().setFromAxisAngle(up, ry);
      this.geometry(box, color, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, d)));
    }
    softBox(w, h, d, x, y, z, color) {
      const b = new Batch();
      loft(b, [[-d / 2, w / 2, -h / 2, h / 2], [d / 2, w / 2, -h / 2, h / 2]], color);
      const geo = b.finish(); this.geometry(geo, color, new THREE.Matrix4().makeTranslation(x, y, z)); geo.dispose();
    }
    panel(w, h, x, y, z, color, ry = 0) {
      const q = new THREE.Quaternion().setFromAxisAngle(up, ry);
      this.geometry(plane, color, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, 1)));
    }
    quad(a, b, c, d, color) {
      this.polygon([a, b, c, d], color);
    }
    polygon(vertices, color) {
      const [a, b, c] = vertices;
      const n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a))
        .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a))).normalize();
      const col = new THREE.Color(color);
      for (let i = 1; i < vertices.length - 1; i++) for (const v of [a, vertices[i], vertices[i + 1]]) {
          this.p.push(...v); this.n.push(n.x, n.y, n.z); this.c.push(col.r, col.g, col.b);
          this.uv(v[0], v[1], v[2], n.x, n.y, n.z);
        }
    }
    beam(a, b, w, d, color) {
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), dir = end.clone().sub(start);
      this.geometry(box, color, new THREE.Matrix4().compose(start.add(end).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()), new THREE.Vector3(w, dir.length(), d)));
    }
    finish() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
      g.computeBoundingBox(); g.computeBoundingSphere(); return g;
    }
    mesh(mat, name) {
      const m = new THREE.Mesh(this.finish(), mat); m.name = name;
      m.castShadow = mat !== materials.windows && mat !== materials.light;
      m.receiveShadow = true; return m;
    }
  }

  /* ---- Innenraum hinter dem Glas (CITY V2, Stufe 8A) ----
     Eine Scheibe zeigt einen Raum, ohne dass dafuer Geometrie entsteht:
     der Blickstrahl laeuft im Fragment durch einen Kasten (Breite und Hoehe
     der Scheibe, Tiefe D, Boden und Decke je Geschoss) und trifft Rueckwand,
     Seitenwand, Boden oder Decke; davor stehen Moebel als Ebenen in fester
     Tiefe (Schreibtischreihe, Theke, Regal, Sofa, Vorhang, Jalousie). Die
     Parallaxe stimmt also - der Raum hat Tiefe, aus jedem Blickwinkel.
     Je Scheibe ein Hash (Raumart, Licht an oder aus, Jalousie, Moebel),
     nichts aus dem Stadtzufall.
     Eckpunktdaten (je Scheibe gleich, nur aIrLokal laeuft ueber die Flaeche):
       aIrLokal  Ort auf der Scheibe in Metern (u nach rechts, von aussen
                 gesehen = cross(oben, Normale); v nach oben)
       aIrMass   Breite, Hoehe, Raumtiefe, Hash
       aIrRaum   Boden und Decke relativ zur Scheibenunterkante, Stil, Modus
       aIrLicht  Farbe des Raumlichts (Tuerfarbe bei der Nische)
     Modus: 1 Raum, 2 Eingangsnische, 3 klares Glas (echter Raum dahinter,
     nur Spiegelung), 0 keine Scheibe (Flaeche - das macht der Aufrufer).
     Stil (Raum): 0 Buero, 1 Lobby, 2 Laden, 3 Wohnung, 4 Cafe.
     Stil (Nische): Laibung 0 dunkler Granit, 1 heller Stein, 2 Klinker,
     3 Putz.
     uIrNacht 0 (Tag) bis 1 (Nacht), uIrHimmel die Himmelsfarbe - beides
     setzt das Spiel je Bild (setzeInnenraumLicht). */
  const IR_UNIFORMS = { uIrNacht: { value: 0 }, uIrHimmel: { value: new THREE.Color(0x9fc4e8) } };
  const IR_VERT_KOPF = [
    'attribute vec2 aIrLokal;', 'attribute vec4 aIrMass;', 'attribute vec4 aIrRaum;', 'attribute vec3 aIrLicht;',
    'varying vec2 vIrLokal;', 'varying vec4 vIrMass;', 'varying vec4 vIrRaum;', 'varying vec3 vIrLicht;', 'varying vec3 vIrStrahl;',
  ].join('\n') + '\n';
  const IR_VERT_RUMPF = `
  {
    vec4 irW = modelMatrix * vec4( transformed, 1.0 );
    vec3 irN = normalize( mat3( modelMatrix ) * objectNormal );
    vec3 irX = cross( vec3( 0.0, 1.0, 0.0 ), irN );
    vec3 irT = length( irX ) > 1e-4 ? normalize( irX ) : vec3( 1.0, 0.0, 0.0 );
    /* Kameraort aus der Ansichtsmatrix: three.js laedt cameraPosition nur
       fuer Phong/Standard - beim Lambert der Erdgeschosse stand dort ein
       alter Wert, und der Blick lief schief durch den Raum. */
    mat3 irR = mat3( viewMatrix );
    vec3 irKam = -vec3( dot( irR[ 0 ], viewMatrix[ 3 ].xyz ), dot( irR[ 1 ], viewMatrix[ 3 ].xyz ), dot( irR[ 2 ], viewMatrix[ 3 ].xyz ) );
    vec3 irV = irW.xyz - irKam;
    vIrStrahl = vec3( dot( irV, irT ), irV.y, -dot( irV, irN ) );
    vIrLokal = aIrLokal; vIrMass = aIrMass; vIrRaum = aIrRaum; vIrLicht = aIrLicht;
  }
`;
  const IR_FRAG_KOPF = `
uniform float uIrNacht;
uniform vec3 uIrHimmel;
varying vec2 vIrLokal;
varying vec4 vIrMass;
varying vec4 vIrRaum;
varying vec3 vIrLicht;
varying vec3 vIrStrahl;
float irH( float n ) { return fract( sin( mod( n, 1000.0 ) * 12.9898 + 4.1414 ) * 43758.5453 ); }
float irR( vec2 p, vec2 a, vec2 b, float w ) {
  vec2 s = smoothstep( a - w, a + w, p ) * ( 1.0 - smoothstep( b - w, b + w, p ) );
  return s.x * s.y;
}
float irK( vec2 p, vec2 c, float r, float w ) { return 1.0 - smoothstep( r - w, r + w, length( p - c ) ); }
float irKantenW() {
#if __VERSION__ >= 300
  return clamp( 0.7 * length( fwidth( vIrLokal ) ), 0.006, 0.25 );
#else
  return 0.015;
#endif
}
/* Spiegelung: Himmel oben, gegenueberliegende Haeuser als dunkles Band
   am Horizont, Strasse unten. */
vec3 irSpiegel( vec3 rn ) {
  vec3 himmel = uIrHimmel;
  vec3 zenit = himmel * vec3( 0.78, 0.88, 1.06 );
  vec3 haeuser = himmel * 0.32 + vec3( 0.035 );
  vec3 strasse = vec3( 0.14, 0.15, 0.16 ) * ( 1.0 - 0.75 * uIrNacht );
  float y = rn.y;
  vec3 oben = mix( haeuser, mix( himmel, zenit, smoothstep( 0.3, 0.9, y ) ), smoothstep( 0.05, 0.4, y ) );
  vec3 unten = mix( haeuser, strasse, smoothstep( 0.0, 0.35, -y ) );
  return y > 0.0 ? oben : unten;
}
/* Ein Raum: Rueckgabe Farbe (schon mit Raumlicht), tief = Tiefe des Treffers */
vec3 irRaum( vec3 r, vec2 p, vec4 m, vec4 q, vec3 licht, float w ) {
  /* Hash ganzzahlig runden: interpoliert wackelt er um 1e-4, und sin()
     macht daraus sonst je Pixel einen anderen Raum (Rauschen). */
  float W = m.x, H = m.y, D = max( m.z, 0.3 ), s = floor( m.w + 0.5 );
  float yB = q.x, yD = q.y, stil = floor( q.z + 0.5 );
  float rz = max( r.z, 1e-4 );
  float quote = stil < 0.5 ? 0.64 : ( stil < 1.5 ? 1.0 : ( stil < 2.5 ? 0.93 : ( stil < 3.5 ? 0.6 : 0.88 ) ) );
  float an = step( irH( s * 3.7 + 1.3 ), quote );
  float tag = 1.0 - uIrNacht;
  /* Kasten */
  float tx = r.x > 1e-4 ? ( W - p.x ) / r.x : ( r.x < -1e-4 ? -p.x / r.x : 1e6 );
  float ty = r.y > 1e-4 ? ( yD - p.y ) / r.y : ( r.y < -1e-4 ? ( yB - p.y ) / r.y : 1e6 );
  float tz = D / rz;
  float t = min( tz, min( tx, ty ) );
  vec3 h = vec3( p, 0.0 ) + r * t;
  float hb = h.y - yB, RH = yD - yB;
  float tief = h.z / D;
  vec3 c = vec3( 0.7 );
  vec3 e = vec3( 0.0 );
  vec3 wand, boden, decke;
  if ( stil < 0.5 ) { wand = vec3( 0.70, 0.71, 0.72 ); boden = vec3( 0.20, 0.21, 0.23 ); decke = vec3( 0.80 ); }
  else if ( stil < 1.5 ) { wand = vec3( 0.74, 0.70, 0.63 ); boden = vec3( 0.52, 0.50, 0.47 ); decke = vec3( 0.86, 0.85, 0.83 ); }
  else if ( stil < 2.5 ) {
    /* Laeden: je Laden eine eigene Wand - warmgrau, dunkel oder hell */
    float lw = irH( s * 4.13 + 2.9 );
    wand = lw < 0.4 ? vec3( 0.62, 0.58, 0.53 ) : ( lw < 0.7 ? vec3( 0.30, 0.29, 0.28 ) : vec3( 0.74, 0.71, 0.66 ) );
    boden = vec3( 0.58, 0.47, 0.36 ); decke = vec3( 0.80, 0.79, 0.77 );
  }
  else if ( stil < 3.5 ) { wand = vec3( 0.80, 0.73, 0.62 ); boden = vec3( 0.44, 0.32, 0.23 ); decke = vec3( 0.88, 0.86, 0.82 ); }
  else { wand = vec3( 0.58, 0.46, 0.36 ); boden = vec3( 0.52, 0.48, 0.43 ); decke = vec3( 0.28, 0.25, 0.23 ); }
  float variante = irH( s * 1.91 + 7.0 );
  if ( tz <= tx && tz <= ty ) {
    /* Rueckwand */
    vec2 k = vec2( h.x, hb );
    c = wand;
    if ( stil < 0.5 ) {
      c *= 0.94 + 0.06 * step( 0.04, fract( k.x / 1.25 ) );
      float bild = irR( k, vec2( W * 0.3, 1.05 ), vec2( W * 0.7, 1.75 ), w );
      c = mix( c, variante < 0.5 ? vec3( 0.93, 0.94, 0.95 ) : vec3( 0.25, 0.32, 0.38 ), bild * step( 0.35, variante ) );
    } else if ( stil < 1.5 ) {
      c *= 0.92 + 0.08 * step( 0.03, fract( k.x / 1.5 ) );
      float feld = irR( k, vec2( W * 0.22, 0.6 ), vec2( W * 0.78, RH - 0.7 ), w );
      c = mix( c, vec3( 0.88, 0.83, 0.74 ), feld );
      e += feld * vec3( 1.0, 0.9, 0.75 ) * 0.35;
    } else if ( stil < 2.5 ) {
      for ( int i = 0; i < 5; i++ ) {
        float fy = 0.42 + float( i ) * 0.4;
        float brett = irR( k, vec2( 0.0, fy ), vec2( W, fy + 0.035 ), w );
        float zelle = floor( k.x / 0.26 );
        float hoch = 0.12 + 0.2 * irH( zelle * 3.1 + float( i ) * 7.7 + s );
        vec3 ware = mix( vec3( 0.72, 0.68, 0.6 ), vec3( 0.42, 0.47, 0.52 ), irH( zelle + float( i ) * 13.0 + s * 2.0 ) );
        ware = mix( ware, vec3( 0.55, 0.36, 0.3 ), step( 0.82, irH( zelle * 5.0 + float( i ) + s ) ) );
        float stueck = irR( vec2( fract( k.x / 0.26 ), k.y ), vec2( 0.12, fy + 0.035 ), vec2( 0.88, fy + 0.035 + hoch ), w / 0.26 );
        if ( k.y < 2.15 ) c = mix( mix( c, ware, stueck ), vec3( 0.3, 0.24, 0.19 ), brett );
      }
    } else if ( stil < 3.5 ) {
      float bild = irR( k, vec2( W * 0.35, 1.3 ), vec2( W * 0.65, 1.8 ), w );
      c = mix( c, vec3( 0.22, 0.2, 0.18 ), bild );
      c = mix( c, vec3( 0.62, 0.55, 0.46 ), irR( k, vec2( W * 0.38, 1.36 ), vec2( W * 0.62, 1.74 ), w ) );
    } else {
      c = mix( c, vec3( 0.38, 0.26, 0.18 ), step( k.y, 1.0 ) );
      float flaschen = step( 1.5, k.y ) * step( k.y, 2.1 ) * step( 0.55, fract( k.x / 0.12 ) );
      c = mix( c, vec3( 0.32, 0.4, 0.3 ), flaschen * step( 0.3, variante ) );
    }
  } else if ( tx <= ty ) {
    /* Seitenwand */
    c = wand * 0.86;
    if ( stil > 3.5 ) c = mix( c, vec3( 0.38, 0.26, 0.18 ), step( hb, 1.0 ) );
  } else if ( r.y < 0.0 ) {
    /* Boden */
    c = boden;
    vec2 f = vec2( h.x, h.z );
    if ( stil > 0.5 && stil < 1.5 ) c *= 0.9 + 0.1 * step( 0.03, fract( f.x / 1.2 ) ) * step( 0.03, fract( f.y / 1.2 ) );
    if ( stil > 1.5 && stil < 3.5 ) c *= 0.92 + 0.08 * step( 0.5, fract( f.x / 0.18 ) );
  } else {
    /* Decke mit Leuchten */
    c = decke;
    vec2 f = vec2( h.x, h.z );
    float lampe = 0.0;
    if ( stil < 0.5 ) lampe = irR( fract( f / vec2( 1.25, 1.2 ) ), vec2( 0.22, 0.25 ), vec2( 0.78, 0.75 ), w );
    else if ( stil < 1.5 ) lampe = irK( fract( f / 1.5 ), vec2( 0.5 ), 0.12, w / 1.5 );
    else if ( stil < 2.5 ) lampe = irK( fract( f / 0.9 ), vec2( 0.5 ), 0.08, w / 0.9 );
    else if ( stil < 3.5 ) lampe = irK( f, vec2( W * 0.5, D * 0.5 ), 0.22, w );
    else lampe = irK( fract( f / vec2( 1.3, 1.1 ) ), vec2( 0.5 ), 0.16, w / 1.2 );
    c = mix( c, vec3( 1.0 ), lampe );
    e += lampe * licht * ( 0.22 + 0.55 * an * ( 0.4 + 0.6 * uIrNacht ) );
  }
  /* Moebel: Ebenen von hinten nach vorn, weich ueberblendet */
  float zk; vec2 k; float a;
  if ( stil < 0.5 ) {
    bool besprechung = variante < 0.22;
    zk = clamp( D * 0.78, 1.2, D - 0.15 );
    if ( zk / rz < t ) {
      k = vec2( p.x + r.x * zk / rz, p.y + r.y * zk / rz - yB );
      float schrank = irR( k, vec2( W * irH( s + 2.0 ) * 0.4, 0.0 ), vec2( W * ( 0.55 + 0.4 * irH( s + 3.0 ) ), 1.05 ), w );
      float pflanze = irK( k, vec2( W * ( 0.15 + 0.7 * irH( s + 4.0 ) ), 1.25 ), 0.32, w );
      float topf = irR( k, vec2( W * ( 0.15 + 0.7 * irH( s + 4.0 ) ) - 0.18, 0.0 ), vec2( W * ( 0.15 + 0.7 * irH( s + 4.0 ) ) + 0.18, 0.5 ), w );
      c = mix( c, vec3( 0.62, 0.6, 0.57 ), schrank * step( 0.4, irH( s + 5.0 ) ) );
      c = mix( c, vec3( 0.25, 0.38, 0.24 ), clamp( pflanze, 0.0, 1.0 ) * step( 0.55, irH( s + 6.0 ) ) );
      c = mix( c, vec3( 0.2, 0.2, 0.21 ), topf * step( 0.55, irH( s + 6.0 ) ) );
    }
    zk = clamp( D * 0.42, 0.8, D - 0.6 );
    if ( zk / rz < t ) {
      k = vec2( p.x + r.x * zk / rz, p.y + r.y * zk / rz - yB );
      if ( besprechung ) {
        float tisch = irR( k, vec2( W * 0.12, 0.7 ), vec2( W * 0.88, 0.76 ), w );
        float bein = irR( k, vec2( W * 0.48, 0.0 ), vec2( W * 0.52, 0.72 ), w );
        c = mix( c, vec3( 0.36, 0.27, 0.2 ), max( tisch, bein ) );
      } else {
        float raster = 1.6, x0 = mod( k.x + raster * irH( s + 8.0 ), raster );
        float platte = irR( vec2( x0, k.y ), vec2( 0.08, 0.71 ), vec2( 1.48, 0.76 ), w );
        float wange = irR( vec2( x0, k.y ), vec2( 0.1, 0.0 ), vec2( 0.16, 0.71 ), w ) + irR( vec2( x0, k.y ), vec2( 1.4, 0.0 ), vec2( 1.46, 0.71 ), w );
        float schirm = irR( vec2( x0, k.y ), vec2( 0.52, 0.82 ), vec2( 1.04, 1.16 ), w );
        float fuss = irR( vec2( x0, k.y ), vec2( 0.76, 0.76 ), vec2( 0.8, 0.82 ), w );
        c = mix( c, vec3( 0.86, 0.85, 0.82 ), platte );
        c = mix( c, vec3( 0.3, 0.31, 0.33 ), clamp( wange + fuss, 0.0, 1.0 ) );
        c = mix( c, vec3( 0.06, 0.07, 0.08 ), schirm );
        e += schirm * vec3( 0.25, 0.35, 0.5 ) * ( 0.15 + 0.6 * an * uIrNacht );
      }
    }
    zk = max( 0.35, clamp( D * 0.42, 0.8, D - 0.6 ) - 0.5 );
    if ( zk / rz < t ) {
      k = vec2( p.x + r.x * zk / rz, p.y + r.y * zk / rz - yB );
      float raster = 1.6, x0 = mod( k.x + raster * irH( s + 8.0 ) + 0.18, raster );
      float lehne = irR( vec2( x0, k.y ), vec2( 0.62, 0.5 ), vec2( 1.06, 1.02 ), w );
      float sitz = irR( vec2( x0, k.y ), vec2( 0.6, 0.44 ), vec2( 1.08, 0.5 ), w );
      float bein = irR( vec2( x0, k.y ), vec2( 0.82, 0.05 ), vec2( 0.86, 0.44 ), w );
      c = mix( c, vec3( 0.11, 0.12, 0.13 ), clamp( lehne + sitz + bein, 0.0, 1.0 ) * step( 0.25, irH( s + 9.0 ) ) );
    }
  } else if ( stil < 1.5 ) {
    zk = D * 0.55;
    if ( zk / rz < t ) {
      k = vec2( p.x + r.x * zk / rz, p.y + r.y * zk / rz - yB );
      float theke = irR( k, vec2( W * 0.22, 0.0 ), vec2( W * 0.78, 1.08 ), w );
      float kante = irR( k, vec2( W * 0.21, 1.03 ), vec2( W * 0.79, 1.1 ), w );
      c = mix( c, vec3( 0.82, 0.79, 0.73 ), theke );
      c = mix( c, vec3( 0.95, 0.94, 0.9 ), kante );
      float topf = irR( k, vec2( W * 0.06, 0.0 ), vec2( W * 0.06 + 0.5, 0.55 ), w );
      float blatt = irK( k, vec2( W * 0.06 + 0.25, 1.15 ), 0.5, w );
      c = mix( c, vec3( 0.22, 0.34, 0.22 ), blatt * step( 0.3, variante ) );
      c = mix( c, vec3( 0.16, 0.16, 0.17 ), topf * step( 0.3, variante ) );
    }
    zk = D * 0.3;
    if ( zk / rz < t ) {
      k = vec2( p.x + r.x * zk / rz, p.y + r.y * zk / rz - yB );
      float pendel = irK( vec2( fract( k.x / 1.4 ) * 1.4, k.y ), vec2( 0.7, RH - 1.0 ), 0.13, w );
      c = mix( c, vec3( 1.0, 0.95, 0.85 ), pendel );
      e += pendel * licht * 1.4;
    }
  } else if ( stil < 2.5 ) {
    zk = D * 0.45;
    if ( zk / rz < t ) {
      k = vec2( p.x + r.x * zk / rz, p.y + r.y * zk / rz - yB );
      float art = irH( s + 11.0 );
      if ( art < 0.4 ) {
        float x0 = mod( k.x + 0.3, 1.1 );
        float rumpf = irK( vec2( x0, k.y * 0.55 ), vec2( 0.55, 1.22 * 0.55 ), 0.19, w );
        float kopf = irK( vec2( x0, k.y ), vec2( 0.55, 1.68 ), 0.1, w );
        float bein = irR( vec2( x0, k.y ), vec2( 0.47, 0.12 ), vec2( 0.63, 0.92 ), w );
        float sockel = irR( vec2( x0, k.y ), vec2( 0.35, 0.0 ), vec2( 0.75, 0.12 ), w );
        vec3 stoff = mix( vec3( 0.18, 0.2, 0.24 ), vec3( 0.62, 0.52, 0.42 ), irH( floor( ( k.x + 0.3 ) / 1.1 ) + s ) );
        c = mix( c, stoff, clamp( rumpf + bein, 0.0, 1.0 ) );
        c = mix( c, vec3( 0.88, 0.86, 0.82 ), max( kopf, sockel ) );
      } else if ( art < 0.75 ) {
        float stange = irR( k, vec2( 0.2, 1.48 ), vec2( W - 0.2, 1.52 ), w );
        float zelle = floor( k.x / 0.11 );
        float kleid = irR( k, vec2( 0.2, 0.62 + 0.25 * irH( zelle + s ) ), vec2( W - 0.2, 1.48 ), w ) * step( 0.25, fract( k.x / 0.11 ) );
        vec3 stoff = mix( vec3( 0.2, 0.22, 0.27 ), vec3( 0.7, 0.64, 0.56 ), irH( zelle * 1.7 + s ) );
        c = mix( mix( c, stoff, kleid ), vec3( 0.75 ), stange );
      } else {
        float podest = irR( k, vec2( W * 0.15, 0.0 ), vec2( W * 0.85, 0.8 ), w );
        float stueck = irR( vec2( fract( k.x / 0.45 ), k.y ), vec2( 0.25, 0.8 ), vec2( 0.75, 1.0 + 0.2 * irH( floor( k.x / 0.45 ) + s ) ), w / 0.45 ) * step( 0.8, k.y );
        c = mix( c, vec3( 0.9, 0.89, 0.86 ), podest );
        c = mix( c, vec3( 0.36, 0.3, 0.26 ), stueck * step( k.x, W * 0.85 ) * step( W * 0.15, k.x ) );
      }
    }
  } else if ( stil < 3.5 ) {
    zk = D * 0.55;
    if ( zk / rz < t ) {
      k = vec2( p.x + r.x * zk / rz, p.y + r.y * zk / rz - yB );
      float sofa = irR( k, vec2( W * 0.1, 0.0 ), vec2( W * 0.72, 0.82 ), w + 0.03 );
      float lampe = irR( k, vec2( W * 0.84 - 0.015, 0.0 ), vec2( W * 0.84 + 0.015, 1.4 ), w );
      float schirm = irR( k, vec2( W * 0.84 - 0.17, 1.38 ), vec2( W * 0.84 + 0.17, 1.66 ), w );
      vec3 stoff = mix( vec3( 0.36, 0.38, 0.34 ), vec3( 0.52, 0.36, 0.3 ), variante );
      c = mix( c, stoff, sofa );
      c = mix( c, vec3( 0.25 ), lampe );
      c = mix( c, vec3( 0.95, 0.88, 0.72 ), schirm );
      e += schirm * licht * ( 0.2 + 1.4 * an * uIrNacht );
    }
  } else {
    zk = D * 0.8;
    if ( zk / rz < t ) {
      k = vec2( p.x + r.x * zk / rz, p.y + r.y * zk / rz - yB );
      float theke = irR( k, vec2( 0.0, 0.0 ), vec2( W, 1.05 ), w );
      float maschine = irR( k, vec2( W * 0.6, 1.05 ), vec2( W * 0.6 + 0.55, 1.5 ), w );
      c = mix( c, vec3( 0.3, 0.2, 0.14 ), theke );
      c = mix( c, vec3( 0.62, 0.62, 0.6 ), maschine );
    }
    zk = D * 0.42;
    if ( zk / rz < t ) {
      k = vec2( p.x + r.x * zk / rz, p.y + r.y * zk / rz - yB );
      float x0 = mod( k.x + 0.2, 1.5 );
      float platte = irR( vec2( x0, k.y ), vec2( 0.4, 0.72 ), vec2( 1.1, 0.76 ), w );
      float fuss = irR( vec2( x0, k.y ), vec2( 0.73, 0.0 ), vec2( 0.77, 0.72 ), w );
      float stuhl = irR( vec2( x0, k.y ), vec2( 1.18, 0.0 ), vec2( 1.22, 0.9 ), w ) + irR( vec2( x0, k.y ), vec2( 1.1, 0.44 ), vec2( 1.42, 0.48 ), w );
      c = mix( c, vec3( 0.86, 0.84, 0.8 ), platte );
      c = mix( c, vec3( 0.18, 0.17, 0.16 ), clamp( fuss + stuhl, 0.0, 1.0 ) );
      float kugel = irK( vec2( fract( k.x / 1.5 ) * 1.5, k.y ), vec2( 0.75, RH - 0.75 ), 0.14, w );
      c = mix( c, vec3( 1.0, 0.9, 0.72 ), kugel );
      e += kugel * licht * 1.3;
    }
  }
  /* Licht im Raum: am Tag gedaempft gegen draussen, nachts an oder aus */
  float innenTag = stil > 1.5 && stil < 2.5 ? 0.72 : ( stil > 0.5 && stil < 1.5 ? 0.75 : ( stil > 3.5 ? 0.62 : 0.5 ) );
  float nachtL = stil > 1.5 && stil < 2.5 ? 0.45 : 0.55;
  float L = mix( an * nachtL + ( 1.0 - an ) * 0.025, innenTag * ( 0.5 + 0.5 * an ), tag );
  /* hinten dunkler - am Tag gegen das Licht von draussen, nachts weg von den Deckenleuchten */
  L *= 1.0 - mix( 0.25, 0.3, tag ) * clamp( tief, 0.0, 1.0 );
  vec3 lf = mix( licht, vec3( 1.0 ), tag * 0.6 );
  vec3 farbe = c * L * lf + e * ( an + 0.25 * tag );
  /* Sichtschutz an der Scheibe: Jalousie (Buero) oder Vorhang (Wohnung) */
  zk = 0.05;
  float yWin = p.y + r.y * zk / rz;
  float xWin = p.x + r.x * zk / rz;
  if ( stil < 0.5 ) {
    float anteil = step( irH( s * 5.3 + 2.0 ), 0.34 ) * ( 0.15 + 0.45 * irH( s * 2.9 ) );
    float jal = smoothstep( H * ( 1.0 - anteil ) - w, H * ( 1.0 - anteil ) + w, yWin ) * step( 0.01, anteil );
    vec3 lamelle = vec3( 0.62, 0.61, 0.58 ) * ( 0.86 + 0.14 * step( 0.5, fract( yWin * 15.0 ) ) );
    farbe = mix( farbe, lamelle * mix( an * 0.9 + 0.06, 0.8, tag ), jal );
  } else if ( stil > 2.5 && stil < 3.5 ) {
    float links = W * ( 0.18 + 0.2 * irH( s * 4.1 ) ), rechts = W * ( 1.0 - 0.18 - 0.2 * irH( s * 6.7 ) );
    float bahn = max( 1.0 - smoothstep( links - w, links + w, xWin ), smoothstep( rechts - w, rechts + w, xWin ) );
    vec3 stoff = mix( vec3( 0.86, 0.82, 0.74 ), vec3( 0.55, 0.42, 0.36 ), step( 0.6, irH( s * 8.3 ) ) ) * ( 0.86 + 0.14 * sin( xWin * 26.0 ) );
    float glimm = an * uIrNacht;
    farbe = mix( farbe, stoff * mix( 0.06 + 0.9 * glimm, 0.82, tag ) + stoff * licht * glimm * 0.35, bahn );
    farbe = mix( farbe, vec3( 0.9, 0.88, 0.84 ) * mix( 0.05 + 0.8 * glimm, 0.85, tag ), 0.22 * step( 0.45, irH( s * 9.1 ) ) );
  }
  return farbe;
}
/* Eingangsnische: Laibung, Decke mit Downlight, Tuer mit Glas und Griff */
vec3 irNische( vec3 r, vec2 p, vec4 m, vec4 q, vec3 tuer, float w ) {
  float W = m.x, H = m.y, D = max( m.z, 0.15 );
  float stil = floor( q.z + 0.5 );
  float rz = max( r.z, 1e-4 );
  float tx = r.x > 1e-4 ? ( W - p.x ) / r.x : ( r.x < -1e-4 ? -p.x / r.x : 1e6 );
  float ty = r.y > 1e-4 ? ( H - p.y ) / r.y : ( r.y < -1e-4 ? -p.y / r.y : 1e6 );
  float tz = D / rz;
  float t = min( tz, min( tx, ty ) );
  vec3 h = vec3( p, 0.0 ) + r * t;
  vec3 laibung = stil < 0.5 ? vec3( 0.16, 0.165, 0.17 ) : ( stil < 1.5 ? vec3( 0.74, 0.71, 0.64 ) : ( stil < 2.5 ? vec3( 0.42, 0.26, 0.2 ) : vec3( 0.78, 0.74, 0.66 ) ) );
  float tag = 1.0 - uIrNacht;
  vec3 c; vec3 e = vec3( 0.0 );
  float licht = 0.0;
  if ( tz <= tx && tz <= ty ) {
    vec2 k = vec2( h.x, h.y );
    float th = min( H - 0.12, 2.36 );
    float blatt = irR( k, vec2( W * 0.06, 0.0 ), vec2( W * 0.94, th ), w );
    float glas = irR( k, vec2( W * 0.2, 0.95 ), vec2( W * 0.8, th - 0.2 ), w );
    float oben = irR( k, vec2( W * 0.06, th + 0.08 ), vec2( W * 0.94, H - 0.04 ), w );
    float griff = irR( k, vec2( W * 0.74, 0.9 ), vec2( W * 0.77, 1.3 ), w );
    float mitte = W > 1.6 ? irR( k, vec2( W * 0.495, 0.0 ), vec2( W * 0.505, th ), w ) : 0.0;
    c = laibung * 0.8;
    c = mix( c, tuer, blatt );
    vec3 drin = mix( vec3( 0.05, 0.06, 0.07 ), vec3( 1.0, 0.86, 0.62 ) * 0.9, uIrNacht * step( 0.3, irH( floor( m.w + 0.5 ) * 3.3 ) ) );
    vec3 gl = mix( drin, irSpiegel( normalize( r ) ), 0.35 * tag );
    c = mix( c, gl, max( glas, oben ) );
    c = mix( c, vec3( 0.75, 0.73, 0.68 ), max( griff, mitte * 0.7 ) );
    e += max( glas, oben ) * drin * uIrNacht * 0.6;
  } else if ( tx <= ty ) {
    c = laibung * ( 0.72 + 0.18 * ( 1.0 - h.z / D ) );
  } else if ( r.y < 0.0 ) {
    c = laibung * 0.9;
  } else {
    c = laibung * 0.62;
    float spot = irK( vec2( h.x, h.z ), vec2( W * 0.5, D * 0.5 ), 0.07, w );
    c = mix( c, vec3( 1.0 ), spot );
    e += spot * vec3( 1.0, 0.85, 0.62 ) * ( 0.3 + 1.5 * uIrNacht );
  }
  /* Lichtkegel des Downlights nachts auf Tuer und Laibung */
  float kegel = exp( -pow( ( h.y - H ) / ( H * 0.75 ), 2.0 ) ) * uIrNacht;
  float L = mix( 0.05 + 0.9 * kegel, 0.62, tag );
  return c * L * mix( vec3( 1.0, 0.82, 0.6 ), vec3( 1.0 ), tag ) + e;
}
/* Eine Scheibe: setzt Deckkraft, liefert die Farbe als Eigenleuchten */
vec3 irScheibe( inout float alpha ) {
  vec3 r = vIrStrahl;
  vec3 rn = normalize( r );
  float w = irKantenW();
  float modus = floor( vIrRaum.w + 0.5 );
  float cosT = clamp( rn.z, 0.0, 1.0 );
  float fres = 0.04 + 0.62 * pow( 1.0 - cosT, 5.0 );
  vec3 spiegel = irSpiegel( rn );
  float tag = 1.0 - uIrNacht;
  if ( modus > 2.5 ) {
    alpha = clamp( 0.24 + fres * 1.1 + 0.08 * tag, 0.0, 0.92 );
    return spiegel * ( 0.55 + 0.45 * tag ) / max( alpha, 0.2 ) * ( fres + 0.1 * tag );
  }
  alpha = 1.0;
  if ( modus > 1.5 ) return irNische( r, vIrLokal, vIrMass, vIrRaum, vIrLicht, w );
  /* Stil 5: Milchglas (Oberlichter) - weich, nachts warm von innen */
  if ( floor( vIrRaum.z + 0.5 ) > 4.5 ) {
    float an = step( irH( floor( vIrMass.w + 0.5 ) * 2.3 + 0.7 ), 0.7 );
    /* dunkel getoent wie das Glas der Schaufenster, mit Schimmer von innen */
    vec3 milch = mix( vec3( 0.10, 0.105, 0.11 ), vec3( 0.17, 0.175, 0.18 ), vIrLokal.y / max( vIrMass.y, 0.1 ) );
    milch += an * vIrLicht * 0.05;
    vec3 tagFarbe = mix( milch, spiegel, 0.1 + 0.55 * fres );
    /* nachts ein gedaempfter Schein, kein Leuchtkasten */
    vec3 nachtFarbe = mix( vec3( 0.03 ), vIrLicht * 0.3, an );
    return mix( tagFarbe, nachtFarbe, uIrNacht );
  }
  vec3 innen = irRaum( r, vIrLokal, vIrMass, vIrRaum, vIrLicht, w );
  float spiegelAnteil = fres * ( 1.0 - 0.55 * uIrNacht ) + 0.14 * tag;
  return mix( innen * vec3( 0.92, 0.95, 0.97 ), spiegel, clamp( spiegelAnteil, 0.0, 0.9 ) );
}
`;
  /* Einem Material den Innenraum geben. extra.fragKopf (GLSL vor main)
     und extra.flaeche (GLSL fuer Modus 0, darf diffuseColor setzen) sind
     fuer das Spiel - die Flaechen der Erdgeschosse im selben Aufruf. */
  function innenraumPatch(material, key, extra) {
    const ex = extra || {};
    material.onBeforeCompile = (sh) => {
      sh.uniforms.uIrNacht = IR_UNIFORMS.uIrNacht;
      sh.uniforms.uIrHimmel = IR_UNIFORMS.uIrHimmel;
      sh.vertexShader = IR_VERT_KOPF + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + IR_VERT_RUMPF);
      sh.fragmentShader = IR_FRAG_KOPF + (ex.fragKopf || '') + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
  vec3 irEmit = vec3( 0.0 );
  if ( vIrRaum.w > 0.5 ) {
    float irA = 1.0;
    irEmit = irScheibe( irA );
    diffuseColor.rgb = vec3( 0.025, 0.028, 0.03 );
    diffuseColor.a = irA;
  }` + (ex.flaeche ? ' else {\n' + ex.flaeche + '\n  }' : ''))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += irEmit;');
    };
    material.customProgramCacheKey = () => 'innenraum-' + key;
    material.userData.innenraum = true;
    return material;
  }
  /* Je Bild aus dem Spiel: nacht 0..1, himmel die Hintergrundfarbe. */
  function setzeInnenraumLicht(nacht, himmel) {
    IR_UNIFORMS.uIrNacht.value = nacht;
    if (himmel) IR_UNIFORMS.uIrHimmel.value.copy(himmel);
  }
  /* Eine Scheibe mit Raum in einen Stapel: Mittelpunkt (x, y, z), Drehung
     ry wie Batch.panel (Normale nach +z, gedreht), Breite b, Hoehe h.
     raum = { D, yB, yD, stil, modus, seed, licht: [r, g, b] }. */
  function fensterInStapel(f, b, h, x, y, z, ry, raum) {
    const nx = Math.sin(ry), nz = Math.cos(ry);
    const tx = nz, tz = -nx;                     // cross(oben, Normale)
    const ecken = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
    for (const [a, c] of ecken) {
      const u = a * b, v = c * h;
      f.p.push(x + tx * (u - b / 2), y + (v - h / 2), z + tz * (u - b / 2));
      f.n.push(nx, 0, nz);
      f.lo.push(u, v);
      f.ma.push(b, h, raum.D, raum.seed);
      f.ra.push(raum.yB, raum.yD, raum.stil, raum.modus);
      const L = raum.licht || [1, 1, 1];
      f.li.push(L[0], L[1], L[2]);
    }
  }
  function fensterStapel() { return { p: [], n: [], lo: [], ma: [], ra: [], li: [] }; }
  function fensterGeometrie(f) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(f.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(f.n, 3));
    g.setAttribute('aIrLokal', new THREE.Float32BufferAttribute(f.lo, 2));
    g.setAttribute('aIrMass', new THREE.Float32BufferAttribute(f.ma, 4));
    g.setAttribute('aIrRaum', new THREE.Float32BufferAttribute(f.ra, 4));
    g.setAttribute('aIrLicht', new THREE.Float32BufferAttribute(f.li, 3));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }

  const TOWERS = [
    { name: 'Glasraster', wall: 0x233c48, trim: 0xa4b4bc, glass: [0x426876, 0x527f8d, 0x315967, 0x69929b] },
    { name: 'Kalkstein', wall: 0xb8b5a8, trim: 0xd8d3c5, glass: [0x294c5c, 0x365f6b, 0x254453, 0x526d72] },
    { name: 'Backstein & Kupfer', wall: 0x735449, trim: 0xb28561, glass: [0x365e65, 0x45717a, 0x254c57, 0x62858a] },
    { name: 'Silberband', wall: 0x526069, trim: 0xc8cdd0, glass: [0x46687f, 0x627f91, 0x365b73, 0x8199a4] },
  ];
  innenraumPatch(materials.innenGlas, 'turm');
  /* Lobby-Pflanze: ein grober Busch ueber dem Topf (einmal erzeugt). */
  const busch = new THREE.IcosahedronGeometry(0.46, 0).toNonIndexed();
  function createTower(w, h, d, variant = 0, seed = 0) {
    if (![w, h, d].every(Number.isFinite) || Math.min(w, h, d) <= 0) throw new Error('Invalid tower dimensions');
    const kind = ((variant % TOWERS.length) + TOWERS.length) % TOWERS.length, style = TOWERS[kind];
    const solid = new Batch(), glazing = fensterStapel(), rooms = new Batch(), lamps = new Batch();
    const group = new THREE.Group();
    const lobby = Math.min(4.2, h * 0.18), floors = Math.max(1, Math.floor((h - lobby) / 3.15));
    const rise = (h - lobby - 0.36) / floors;
    const roomDepth = Math.min(3.6, Math.min(w, d) * 0.28);
    // Real space behind the glass: the opaque core is recessed by several
    // metres. Collision remains the original closed building envelope.
    solid.box(w - roomDepth * 2, h - 0.12, d - roomDepth * 2, 0, (h - 0.12) / 2, 0, 0x696963);
    solid.box(w, 0.12, d, 0, 0.06, 0, 0x8c8b83);
    solid.box(w, 0.12, d, 0, h - 0.06, 0, 0x849095); // exact walkable roof; no invisible crown
    for (let floor = 0; floor <= floors; floor++) {
      const y = lobby + floor * rise;
      solid.box(w - 0.08, 0.16, d - 0.08, 0, y + 0.08, 0, 0xa6a59c);
    }
    /* CITY V2 Stufe 8A: Sockel, Portal, Raumlicht und Lobby je Turmstil.
       Die Geschosse zeigen ihre Bueros im Glas (innenraumPatch) - jede
       Scheibe ein eigener Raum mit Licht an oder aus, Jalousie oder nicht.
       Die Lobby bleibt echter Raum hinter klarem Glas und ist eingerichtet. */
    const sockel = [0x2a2d31, 0x8a8478, 0x382e2a, 0x2c3236][kind];
    const portal = [0x1d2023, 0x4a463f, 0x2a211c, 0x23282c][kind];
    const wandStein = [0xcfc7b8, 0xe0d8c6, 0xc9b7a2, 0xd3d2cd][kind];
    const licht = [[0.92, 0.97, 1.06], [1.0, 0.96, 0.88], [1.0, 0.92, 0.8], [0.95, 0.98, 1.05]][kind];
    const turmHash = Math.floor(Math.abs(seed) * 0.6180339 + w * 1.37 + h * 0.71 + d * 2.03 + kind * 5.1) % 997;
    const doorW = Math.min(2.25, Math.max(w, d) * 0.24);
    for (let face = 0; face < 4; face++) {
      const width = face % 2 ? d : w, depth = face % 2 ? w : d, ry = face * Math.PI / 2;
      const local = (x, z) => [Math.cos(ry) * x + Math.sin(ry) * z, -Math.sin(ry) * x + Math.cos(ry) * z];
      const bar = (bw, bh, bd, x, y, inset, color) => {
        const [px, pz] = local(x, depth / 2 - inset); solid.box(bw, bh, bd, px, y, pz, color, ry);
      };
      const scheibe = (bw, bh, x, y, raum) => {
        const [px, pz] = local(x, depth / 2 - 0.015); fensterInStapel(glazing, bw, bh, px, y, pz, ry, raum);
      };
      const inside = (batch, bw, bh, bd, x, y, inset, color) => {
        const [px, pz] = local(x, depth / 2 - inset); batch.box(bw, bh, bd, px, y, pz, color, ry);
      };
      const cols = Math.max(2, Math.floor((width - 0.5) / (kind === 1 ? 2.9 : 2.5)));
      const step = (width - 0.5) / cols;
      const column = [0.22, 1.05, 0.66, 0.40][kind];
      const band = [0.58, 1.05, 0.82, 1.12][kind];
      for (let col = 0; col < cols; col++) {
        const x = -width / 2 + 0.25 + (col + 0.5) * step;
        scheibe(step - column, lobby - 0.18, x, lobby / 2,
          { D: roomDepth, yB: -0.09, yD: lobby - 0.09, stil: 1, modus: 3, seed: (turmHash + face * 31 + col) % 997, licht });
        for (let floor = 0; floor < floors; floor++) {
          const base = lobby + floor * rise, y = base + rise / 2;
          scheibe(step - column, rise - band, x, y, {
            D: roomDepth - 0.08, yB: 0.16 - band / 2, yD: rise - band / 2 - 0.1, stil: 0, modus: 1,
            seed: (turmHash * 3 + floor * 11 + col * 7 + face * 3 + kind * 17) % 997, licht });
        }
      }
      // Columns and floor bands have depth, but stay inside the existing collision box.
      // Columns start on the plinth, so the two never share a plane.
      for (let col = 0; col <= cols; col++) {
        const x = -width / 2 + 0.25 + col * step;
        bar(col === 0 || col === cols ? Math.min(0.5, column) : column,
          h - 0.67, 0.18, x, 0.45 + (h - 0.67) / 2, 0.09, kind === 1 || kind === 2 ? style.wall : style.trim);
      }
      for (let floor = 0; floor <= floors; floor++) {
        const y = lobby + floor * rise;
        bar(width - 0.2, floor === floors ? Math.min(band, 0.45) : band,
          0.16, 0, y, 0.08, kind === 1 || kind === 2 ? style.wall : style.trim);
      }
      bar(width, 0.16, 0.12, 0, h - 0.25, 0.06, style.trim);
      // Stone plinth instead of the thin base trim: the lobby stands on it.
      bar(width, 0.45, 0.12, 0, 0.225, 0.06, sockel);
      /* Lobby: beleuchtete Steinwand am Kern, Lichtbaender unter der
         Decke, Pflanzen; vorn Empfang und Portal, an den anderen Seiten
         Sitzgruppen. Alles innerhalb der Kiste, nichts beruehrt das Glas. */
      const kern = width - roomDepth * 2;
      if (kern > 1.2) {
        inside(rooms, kern * 0.72, lobby - 1.05, 0.05, 0, 0.12 + (lobby - 1.05) / 2 + 0.35, roomDepth - 0.025, wandStein);
        inside(lamps, kern * 0.72, 0.04, 0.03, 0, lobby - 0.42, roomDepth - 0.06, 0xfff0d6);
      }
      inside(lamps, width - 1.0, 0.02, 0.1, 0, lobby - 0.03, roomDepth * 0.45, 0xf6f2ea);
      for (const sx of [-1, 1]) {
        const px = sx * (width / 2 - 0.85);
        if (Math.abs(px) < 1.2) continue;
        inside(rooms, 0.55, 0.6, 0.55, px, 0.42, roomDepth * 0.5, 0x2b2e31);
        const [bx, bz] = local(px, depth / 2 - roomDepth * 0.5);
        rooms.geometry(busch, 0x47603e, new THREE.Matrix4().makeTranslation(bx, 1.2, bz));
      }
      if (face === 0) {
        inside(rooms, Math.min(3.2, width * 0.3), 1.0, 0.7, 0, 0.62, roomDepth * 0.58, 0xd6cec0);
        inside(rooms, Math.min(3.3, width * 0.31), 0.05, 0.76, 0, 1.145, roomDepth * 0.58, 0xf0ece4);
        // Portal: dark jambs and lintel around the door; the door is the lobby glass.
        // 4 mm behind the column face and below the floor band: no shared plane.
        const sturz = lobby - band / 2 - 0.18;
        for (const sx of [-1, 1]) bar(0.2, sturz - 0.16 - 0.45, 0.14, sx * (doorW / 2 + 0.1), 0.45 + (sturz - 0.16 - 0.45) / 2, 0.074, portal);
        bar(doorW + 0.4, 0.32, 0.14, 0, sturz, 0.074, portal);
        bar(0.05, sturz - 0.16 - 0.45, 0.038, 0, 0.45 + (sturz - 0.16 - 0.45) / 2, 0.031, portal);
      } else if (width > 5) {
        for (const sx of [-1, 1]) inside(rooms, Math.min(1.8, width * 0.18), 0.42, 0.7, sx * width * 0.2, 0.33, roomDepth * 0.55, 0x34383d);
        inside(rooms, 0.8, 0.36, 0.6, 0, 0.3, roomDepth * 0.55, 0x6b5a48);
      }
    }
    const interior = new THREE.LOD(); interior.name = 'OfficeDetails';
    interior.addLevel(rooms.mesh(materials.stone, 'OfficeFurniture'), 0);
    interior.addLevel(new THREE.Group(), 150);
    const panes = new THREE.Mesh(fensterGeometrie(glazing), materials.innenGlas);
    panes.name = 'Glazing'; panes.castShadow = false; panes.receiveShadow = true; panes.renderOrder = 2;
    group.add(solid.mesh(materials.stone, 'Structure'), panes, lamps.mesh(materials.light, 'OfficeLights'), interior);
    group.name = 'WEB_HERO_Hochhaus_' + style.name;
    group.userData = { visualKind: 'tower', variant: kind, floors: floors + 1, roofHeight: h,
      footprint: { width: w, depth: d }, roomDepth, source: 'native-geometry' };
    return group;
  }

  function loft(batch, sections, color) {
    const rings = sections.map(([z, w, low, high]) => {
      const b = Math.min(0.065, (high - low) * 0.3, w * 0.13);
      return [[-w + b, low, z], [w - b, low, z], [w, low + b, z], [w, high - b, z],
        [w - b, high, z], [-w + b, high, z], [-w, high - b, z], [-w, low + b, z]];
    });
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < 8; j++) {
      const next = (j + 1) % 8;
      batch.quad(rings[i][j], rings[i][next], rings[i + 1][next], rings[i + 1][j], color);
    }
    batch.polygon(rings[0].slice().reverse(), color);
    batch.polygon(rings[rings.length - 1], color);
  }
  let carSerial = 0;
  const carCache = new Map();
  let wheelGeometry;
  function wheel() {
    if (wheelGeometry) return wheelGeometry;
    const b = new Batch(), tire = new THREE.CylinderGeometry(0.35, 0.35, 0.24, 20).toNonIndexed();
    b.geometry(tire, 0x181c23, new THREE.Matrix4().makeRotationZ(Math.PI / 2)); tire.dispose();
    for (const sx of [-1, 1]) {
      const rim = new THREE.CylinderGeometry(0.235, 0.235, 0.014, 16).toNonIndexed();
      const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2); m.setPosition(sx * 0.127, 0, 0);
      b.geometry(rim, 0x3b444c, m); rim.dispose();
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        b.beam([sx * 0.139, 0, 0], [sx * 0.139, Math.cos(angle) * 0.215, Math.sin(angle) * 0.215], 0.024, 0.045, 0xc1cbd0);
      }
    }
    wheelGeometry = b.finish(); return wheelGeometry;
  }
  function carParts(color, kind) {
    const key = color + ':' + kind;
    if (carCache.has(key)) return carCache.get(key);
    const trim = new Batch(), glass = new Batch(), lights = new Batch();
    const rearRoof = kind === 2 ? -1.48 : kind === 1 ? -1.38 : -1.3;
    const nose = kind === 1 ? 0.99 : 0.92;
    // Open cabin: the low tub stays below the existing seat cushions.
    const open = new Batch();
    loft(open, [[-2.28, 0.76, 0.4, 0.7], [-1.93, 0.94, 0.3, 0.76],
      [1.78, 0.94, 0.3, 0.76], [2.28, 0.78, 0.42, 0.7]], color);
    loft(open, [[1.07, 0.9, 0.75, 1.1], [1.8, 0.93, 0.68, 1.04], [2.28, 0.78, 0.6, nose]], color);
    loft(open, [[-2.28, 0.76, 0.6, 0.86], [-1.85, 0.93, 0.7, 1.08], [-1.53, 0.9, 0.75, 1.12]], color);
    for (const sx of [-1, 1]) {
      open.box(0.1, 0.36, 2.62, sx * 0.88, 0.93, -0.23, color);
      trim.box(0.025, 0.055, 2.6, sx * 0.939, 1.1, -0.22, 0x263039);
      trim.box(0.025, 0.32, 0.021, sx * 0.94, 0.92, -0.37, 0x303b42);
      for (const z of [0.38, -0.94]) trim.box(0.035, 0.035, 0.17, sx * 0.949, 1.02, z, 0xbcc7cb);
      open.box(0.17, 0.11, 0.25, sx * 0.956, 1.29, 0.74, color);
      trim.box(0.12, 0.07, 0.018, sx * 0.956, 1.29, 0.605, 0x455966);
      const A = [sx * 0.87, 1.12, 1.08], B = [sx * 0.78, 1.88, 0.64];
      const C = [sx * 0.78, 1.88, rearRoof], D = [sx * 0.87, 1.12, -1.55];
      trim.beam(A, B, 0.065, 0.075, 0x28333c); trim.beam(C, D, 0.075, 0.08, 0x28333c);
      trim.beam([sx * 0.87, 1.12, -0.39], [sx * 0.78, 1.88, -0.39], 0.06, 0.075, 0x28333c);
      if (sx > 0) glass.quad(D, C, B, A, 0xffffff); else glass.quad(A, B, C, D, 0xffffff);
    }
    glass.quad([-0.87, 1.12, 1.08], [0.87, 1.12, 1.08], [0.78, 1.88, 0.64], [-0.78, 1.88, 0.64], 0xffffff);
    glass.quad([-0.87, 1.12, -1.55], [-0.78, 1.88, rearRoof], [0.78, 1.88, rearRoof], [0.87, 1.12, -1.55], 0xffffff);
    loft(open, [[rearRoof - 0.06, 0.76, 1.88, 1.94], [rearRoof + 0.2, 0.81, 1.88, 1.98],
      [0.44, 0.81, 1.88, 1.98], [0.7, 0.76, 1.87, 1.94]], color);
    for (const sz of [-1, 1]) trim.box(1.52, 0.12, 0.065, 0, 0.48, sz * 2.27, 0x202a33);
    // Wipers follow the windshield, rather than floating across the cabin.
    for (const sx of [-1, 1]) trim.beam([sx * 0.55, 1.155, 1.082],
      [sx * 0.16, 1.43, 0.928], 0.018, 0.018, 0x263039);
    if (kind !== 0) for (const sx of [-1, 1]) trim.box(0.045, 0.045, 1.56,
      sx * 0.7, 1.954, -0.42, kind === 1 ? 0x343c41 : 0x9ca9ae);
    trim.box(0.94, 0.17, 0.02, 0, 0.73, 2.285, 0x1c2932);
    for (let i = 0; i < 5; i++) trim.box(0.8, 0.008, 0.025, 0, 0.67 + i * 0.026, 2.3, 0x4f5e66);
    for (const sx of [-1, 1]) lights.box(0.4, 0.065, 0.028, sx * 0.51, 0.86, 2.285, 0xe9f5fa);
    if (kind === 1) lights.box(0.55, 0.025, 0.029, 0, 0.86, 2.285, 0xe9f5fa);
    const result = [open.finish(), trim.finish(), glass.finish(), lights.finish()];
    carCache.set(key, result); return result;
  }
  function createCar(color, variant) {
    const kind = variant === undefined ? carSerial++ % 3 : ((variant % 3) + 3) % 3;
    const g = new THREE.Group(), parts = carParts(color, kind), wheels = [];
    const mats = [materials.trim, materials.trim, materials.windows, materials.light];
    parts.forEach((geo, i) => { const m = new THREE.Mesh(geo, mats[i]); m.name = ['Body', 'Trim', 'Windows', 'LED'][i]; m.castShadow = i < 2; m.receiveShadow = true; g.add(m); });
    for (const sx of [-1, 1]) for (const z of [1.36, -1.36]) {
      const steer = new THREE.Group(), roll = new THREE.Mesh(wheel(), materials.trim);
      steer.position.set(sx * 0.93, 0.35, z); steer.add(roll); g.add(steer);
      steer.name = (z > 0 ? 'Front' : 'Rear') + (sx < 0 ? 'Left' : 'Right');
      wheels.push({ steer, roll, front: z > 0 });
    }
    const brake = new THREE.MeshBasicMaterial({ color: 0x8d292b });
    const tail = new Batch();
    for (const sx of [-1, 1]) tail.box(0.44, 0.07, 0.03, sx * 0.51, 0.8, -2.29, 0xffffff);
    g.add(tail.mesh(brake, 'BrakeLights'));
    g.name = 'WEB_HERO_' + ['Fastback', 'Crossover', 'Sportkombi'][kind];
    g.userData.visualKind = 'modern-car'; g.userData.variant = kind; g.userData.roofHeight = 1.98;
    g.userData.collisionHull = { halfWidth: 1.09, halfLength: 2.32, roof: 1.98 };
    g.userData.cityMotion = { wheels, brake, speed: 0, yaw: null, steering: 0 };
    return g;
  }
  function updateCar(g, speed, dt) {
    const m = g.userData.cityMotion;
    if (!m || !Number.isFinite(speed) || !Number.isFinite(dt) || dt <= 0) return;
    const step = Math.min(dt, 0.1), yaw = g.rotation.y;
    const turn = m.yaw === null ? 0 : Math.atan2(Math.sin(yaw - m.yaw), Math.cos(yaw - m.yaw));
    const target = Math.abs(turn) < 0.8 && speed > 0.3 ? clamp(Math.atan(2.72 * turn / step / Math.max(3, speed)), -0.45, 0.45) : 0;
    m.steering += (target - m.steering) * blend(10, step);
    for (const wheel of m.wheels) {
      wheel.roll.rotation.x = (wheel.roll.rotation.x + speed * step / (m.radius || 0.35)) % (Math.PI * 2);
      if (wheel.front) wheel.steer.rotation.y = m.steering;
    }
    m.brake.color.setHex(speed < 0.1 || (speed - m.speed) / step < -1.1 ? 0xff4038 : 0x8d292b);
    m.speed = speed; m.yaw = yaw;
  }

  let utilityWheelGeometry;
  // Truck and bus bodies already contain working interiors. Refine their shell
  // and animate the existing axles without replacing passenger or traffic data.
  function finishUtilityVehicle(g, type, color, wheels) {
    const L = type.laenge, B = type.breite, cargo = type.art !== 'bus';
    const detail = new Batch(), lights = new Batch(), tail = new Batch();
    if (!utilityWheelGeometry) utilityWheelGeometry = wheel().clone().scale(1.25, 0.46 / 0.35, 0.46 / 0.35);
    const retiredWheelGeometry = new Set();
    for (const axle of wheels) {
      if (!axle.roll.userData.sharedFleetWheel) retiredWheelGeometry.add(axle.roll.geometry);
      axle.roll.geometry = utilityWheelGeometry; axle.roll.material = materials.trim;
      axle.roll.rotation.set(0, 0, 0);
    }
    for (const old of retiredWheelGeometry) if (old !== utilityWheelGeometry) old.dispose();
    const front = L / 2;
    detail.box(B - 0.2, 0.16, 0.11, 0, 0.43, front - 0.02, 0x24313a);
    detail.box(B * 0.53, 0.37, 0.035, 0, 0.91, front + 0.061, 0x26353f);
    for (let i = 0; i < 5; i++) detail.box(B * 0.46, 0.018, 0.02, 0, 0.77 + i * 0.065, front + 0.084, 0x87979e);
    for (const sx of [-1, 1]) {
      detail.box(0.14, 0.22, 0.2, sx * (B / 2 - 0.02), 1.82, front - 0.4, 0x29353d);
      detail.box(0.15, 0.06, 0.64, sx * (B / 2 - 0.03), 0.39, front - 1.1, 0x6e808b);
      lights.box(0.44, 0.055, 0.04, sx * (B / 2 - 0.41), 0.72, front + 0.075, 0xeaf5fa);
      tail.box(0.27, 0.09, 0.04, sx * (B / 2 - 0.3), 0.66, -L / 2 - 0.025, 0xffffff);
      if (cargo) {
        // Corrugated cargo panels, reflective safety stripe and rear loading door.
        for (let i = 0; i < 11; i++) detail.box(0.026, 1.9, 0.045, sx * (B / 2 + 0.065), 1.6,
          -L / 2 + 0.2 + i * (L - 3.0) / 10, 0xb0bac1);
        detail.box(0.026, 0.105, L - 2.8, sx * (B / 2 + 0.067), 0.59, -1.3, 0xdcbf68);
      } else {
        detail.box(0.025, 0.08, L - 0.6, sx * (B / 2 + 0.014), 1.37, 0, 0xc5d5db);
      }
    }
    if (cargo) {
      for (const x of [-B / 2 + 0.12, 0, B / 2 - 0.12]) detail.box(0.045, 2.04, 0.035, x, 1.6, -L / 2 - 0.07, 0x7c8b96);
      // Sloping fairing above the cab stays below the existing cargo roof.
      loft(detail, [[front - 2.22, B * 0.47, 2.34, 2.71], [front - 0.35, B * 0.4, 2.34, 2.4]], color);
    }
    g.add(detail.mesh(materials.trim, 'UtilityBodyDetails'), lights.mesh(materials.light, 'DaytimeLED'));
    const brake = new THREE.MeshBasicMaterial({ color: 0x8d292b });
    g.add(tail.mesh(brake, 'BrakeLights'));
    g.userData.cityMotion = { wheels, brake, speed: 0, yaw: null, steering: 0, radius: 0.46 };
    g.userData.visualKind = cargo ? 'modern-truck' : 'modern-bus';
    g.userData.collisionHull = { halfWidth: B / 2 + 0.09, halfLength: L / 2 + 0.1, roof: cargo ? 2.75 : 2.7 };
  }

  const fleetWheelCache = new Map();
  function fleetWheels(g, width, front, rear, radius) {
    if (!fleetWheelCache.has(radius)) fleetWheelCache.set(radius,
      wheel().clone().scale(1.15, radius / 0.35, radius / 0.35));
    const wheels = [];
    for (const z of [front, rear]) for (const side of [-1, 1]) {
      const steer = new THREE.Group(), roll = new THREE.Mesh(fleetWheelCache.get(radius), materials.trim);
      roll.userData.sharedFleetWheel = true;
      steer.position.set(side * (width / 2 - 0.12), radius, z);
      steer.add(roll); g.add(steer); wheels.push({ steer, roll, front: z === front });
    }
    return wheels;
  }
  const signCache = new Map();
  function fleetSign(g, text, w, h, x, y, z, ry = 0) {
    if (typeof document === 'undefined') return;
    if (!signCache.has(text)) {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#172832'; ctx.fillRect(0, 0, 512, 96);
      ctx.fillStyle = '#e8f1e8'; ctx.font = 'bold 47px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(text, 256, 65, 495);
      const texture = new THREE.CanvasTexture(canvas);
      signCache.set(text, new THREE.MeshBasicMaterial({ map: texture }));
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signCache.get(text));
    m.name = 'FleetSign'; m.position.set(x, y, z); m.rotation.y = ry; g.add(m);
  }
  function createAmbulance() {
    const g = new THREE.Group(), body = new Batch(), glass = new Batch(), trim = new Batch(), leds = new Batch(), tail = new Batch();
    const white = 0xdce2df, red = 0xc04b37, dark = 0x27333a;
    // A separate hollow cab and chamfered patient module, with a real sill.
    body.softBox(2.06, 1.87, 3.24, 0, 1.365, -0.85, white);
    loft(body, [[1.98, 0.94, 0.44, 1.17], [2.62, 0.88, 0.49, 1.02]], white);
    body.softBox(1.91, 0.12, 1.13, 0, 2.05, 1.30, white);
    body.box(1.9, 0.1, 1.85, 0, 0.58, 1.54, dark);
    for (const sx of [-1, 1]) {
      body.box(0.08, 0.59, 1.27, sx * 0.94, 0.915, 1.345, white);
      body.box(0.075, 0.91, 0.10, sx * 0.915, 1.6, 0.78, white);
      body.beam([sx * 0.91, 1.99, 1.86], [sx * 0.91, 1.17, 2.25], 0.075, 0.075, white);
      glass.quad([sx * 0.918, 1.22, 0.83], [sx * 0.918, 1.98, 0.83],
        [sx * 0.918, 1.98, 1.81], [sx * 0.918, 1.22, 2.16], 0xb7d6db);
      body.box(0.026, 0.26, 3.05, sx * 1.039, 1.14, -0.86, red);
      trim.box(0.027, 0.07, 4.72, sx * 1.04, 0.60, -0.02, 0xe6d187);
      trim.box(0.065, 0.29, 0.20, sx * 1.07, 1.71, 1.95, dark);
      trim.box(0.03, 0.08, 0.20, sx * 0.963, 1.17, 1.04, dark);
      leds.box(0.39, 0.11, 0.035, sx * 0.65, 0.97, 2.625, 0xe0edf2);
      tail.box(0.13, 0.30, 0.026, sx * 0.85, 0.93, -2.483, 0xffffff);
      // Six-arm emergency-service symbol, no third-party logo texture.
      for (const angle of [0, Math.PI / 3, -Math.PI / 3]) {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
        trim.geometry(box, 0x2f6883, new THREE.Matrix4().compose(new THREE.Vector3(sx * 1.042, 1.72, -0.68), q,
          new THREE.Vector3(0.012, 0.53, 0.15)));
      }
      // Patient module rear doors and handles.
      trim.box(0.83, 0.55, 0.026, sx * 0.50, 1.88, -2.483, 0x526b73);
      trim.box(0.035, 0.25, 0.035, sx * 0.08, 1.31, -2.497, 0x92a5aa);
      fleetSign(g, 'RETTUNG 112', 1.35, 0.24, sx * 1.051, 2.11, -0.72, sx * Math.PI / 2);
    }
    glass.quad([-0.87, 1.23, 2.24], [0.87, 1.23, 2.24], [0.87, 1.99, 1.90], [-0.87, 1.99, 1.90], 0xa7c6cc);
    trim.box(0.035, 1.69, 0.025, 0, 1.34, -2.498, dark);
    trim.box(1.66, 0.18, 0.10, 0, 0.46, 2.64, dark);
    trim.box(0.86, 0.25, 0.03, 0, 0.90, 2.638, dark);
    for (let i = 0; i < 4; i++) trim.box(0.78, 0.014, 0.015, 0, 0.82 + i * 0.055, 2.659, 0x869a9f);
    for (const sx of [-1, 1]) {
      trim.softBox(0.55, 0.12, 0.48, sx * 0.44, 1.12, 1.18, dark);
      trim.softBox(0.53, 0.64, 0.10, sx * 0.44, 1.46, 0.94, dark);
    }
    trim.box(1.65, 0.16, 0.30, 0, 1.44, 1.83, dark);
    const wheelRing = new THREE.TorusGeometry(0.18, 0.026, 6, 18).toNonIndexed();
    trim.geometry(wheelRing, dark, new THREE.Matrix4().makeRotationX(1.18).setPosition(-0.44, 1.52, 1.61)); wheelRing.dispose();
    g.add(body.mesh(materials.trim, 'AmbulanceBody'), trim.mesh(materials.trim, 'AmbulanceEquipment'),
      glass.mesh(materials.glass, 'AmbulanceCabGlass'), leds.mesh(materials.light, 'AmbulanceLED'));
    const beacons = new THREE.Group();
    for (const sx of [-1, 1]) {
      const b = new Batch();
      b.box(0.49, 0.13, 0.26, sx * 0.32, 2.39, 0.52, 0x458df2);
      b.box(0.10, 0.11, 0.21, sx * 0.98, 2.17, -2.10, 0x458df2);
      beacons.add(b.mesh(materials.light, 'BlueBeacon'));
    }
    g.add(beacons); g.userData.blaulicht = beacons;
    g.userData.fahrerSitz = { x: -0.44, y: 1.24, z: 1.18, scale: 0.85 };
    const brake = new THREE.MeshBasicMaterial({ color: 0x8d292b });
    g.add(tail.mesh(brake, 'BrakeLights'));
    g.userData.cityMotion = { wheels: fleetWheels(g, 2.1, 1.76, -1.64, 0.41), brake, speed: 0, yaw: null, steering: 0, radius: 0.41 };
    g.userData.collisionHull = { halfWidth: 1.12, halfLength: 2.72, roof: 2.46 };
    g.userData.visualKind = 'modern-ambulance';
    return g;
  }
  function createBus(type, color) {
    const g = new THREE.Group(), body = new Batch(), interior = new Batch(), glass = new Batch(), light = new Batch();
    const L = type.laenge, B = type.breite, front = L / 2;
    const paint = new THREE.Color(color).lerp(new THREE.Color(0x34474b), 0.42).getHex();
    const floor = 0.57, seatY = 1.12, windowBottom = 1.16, windowTop = 2.43;
    // The aisle is hollow. No full body box through passengers' legs.
    body.softBox(B, 0.20, L, 0, 0.44, 0, 0x394750);
    body.softBox(B, 0.22, L, 0, 2.59, 0, 0xd3d9d5);
    interior.box(B - 0.17, 0.06, L - 0.20, 0, floor - 0.03, 0, 0x454e51);
    interior.box(0.68, 0.008, L - 1.7, 0, floor + 0.004, -0.45, 0x6b7370);
    body.box(B, 0.58, 0.08, 0, 0.86, -front + 0.04, paint);
    body.box(B - 0.08, 0.58, 0.10, 0, 0.86, front - 0.05, paint);
    body.box(B - 0.06, 1.32, 0.08, 0, 1.81, -front + 0.04, 0xd3d9d5);
    for (const sx of [-1, 1]) {
      body.box(0.08, 0.59, L - 0.15, sx * (B / 2 - 0.04), 0.865, 0, paint);
      body.box(0.022, 0.09, L - 0.3, sx * (B / 2 + 0.011), 1.105, 0, 0x9aaeb0);
      glass.panel(L - 0.25, windowTop - windowBottom, sx * (B / 2 - 0.026),
        (windowTop + windowBottom) / 2, 0, 0xb7d1d6, sx * Math.PI / 2);
      for (let i = 0; i <= 6; i++) body.box(0.09, 1.29, 0.075,
        sx * (B / 2 - 0.044), 1.805, -front + 0.13 + i * (L - 0.26) / 6, 0x283b42);
      interior.box(0.036, 0.036, L - 1.25, sx * 0.43, 2.29, -0.12, 0xd6b650);
      light.box(0.065, 0.016, L - 1.1, sx * 0.69, 2.468, 0, 0xe4ebdb);
      for (const z of [-2.6, -0.1, 2.4]) interior.box(0.035, 1.72, 0.035, sx * 0.42, 1.43, z, 0xd6b650);
    }
    glass.panel(B - 0.17, 1.29, 0, 1.805, front - 0.018, 0xadc7d1);
    const seats = [];
    const addSeat = (x, z, driver = false) => {
      const shade = driver ? 0x29363e : 0x3a6672;
      interior.softBox(0.53, 0.10, 0.48, x, seatY - 0.06, z + 0.035, shade);
      interior.softBox(0.52, 0.56, 0.09, x, seatY + 0.23, z - 0.22, shade);
      interior.box(0.18, seatY - floor - 0.10, 0.17, x, (floor + seatY - 0.10) / 2, z, 0x9ba8a8);
      interior.box(0.42, 0.045, 0.10, x, seatY + 0.525, z - 0.22, 0xc4cccc);
      seats.push({ x, y: seatY + 0.06, z, ry: 0, fahrer: driver, scale: 0.94, floor });
    };
    addSeat(-0.65, front - 1.25, true);
    // Interleave both sides so a bounded real-person pool fills the cabin evenly.
    for (const z of [-2.8, -1.55, -0.3, 0.95]) for (const sx of [-1, 1]) addSeat(sx * 0.75, z);
    interior.box(B - 0.26, 0.16, 0.45, 0, 1.43, front - 0.56, 0x27343c);
    interior.box(0.61, 0.74, 0.055, -0.65, 0.97, front - 1.57, 0xb7c3c0);
    interior.box(0.13, 0.20, 0.11, 0.55, 1.43, front - 1.28, 0x384c5b);
    const wheelRing = new THREE.TorusGeometry(0.2, 0.026, 6, 18).toNonIndexed();
    interior.geometry(wheelRing, 0x1e2b32, new THREE.Matrix4().makeRotationX(1.18).setPosition(-0.65, 1.45, front - 0.846)); wheelRing.dispose();
    // Front and centre folding-door seams and contrasting step edges.
    for (const z of [front - 0.73, -0.35]) {
      for (const dz of [-0.48, 0, 0.48]) body.box(0.013, 1.78, 0.028, B / 2 + 0.004, 1.42, z + dz, 0x28383f);
      interior.box(0.25, 0.012, 0.91, B / 2 - 0.20, floor + 0.006, z, 0xd8bd62);
    }
    g.add(body.mesh(materials.trim, 'BusShell'), interior.mesh(materials.stone, 'BusInterior'),
      glass.mesh(materials.glass, 'BusGlass'), light.mesh(materials.light, 'BusCeilingLights'));
    const wheels = fleetWheels(g, B, front - 1.3, -front + 1.6, 0.46);
    // Reuse the existing vehicle motion and conservative collision envelope.
    finishUtilityVehicle(g, type, paint, wheels);
    g.userData.sitzplaetze = seats; g.userData.floorHeight = floor;
    fleetSign(g, 'M4  CENTRAL', 1.55, 0.19, 0, 2.573, front + 0.008);
    fleetSign(g, 'NÄCHSTER HALT · CENTRAL', 1.33, 0.17, 0, 2.30, front - 0.36, Math.PI);
    return g;
  }

  const treeCache = new Map();
  function createTree(variant = 0) {
    const kind = ((variant % 4) + 4) % 4;
    if (!treeCache.has(kind)) {
      const wood = new Batch(), leaves = new Batch();
      let seed = 171 + kind * 83;
      const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
      const branch = (a, b, r0, r1) => {
        const p = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(p);
        const geo = new THREE.CylinderGeometry(r1, r0, delta.length(), 8).toNonIndexed();
        wood.geometry(geo, 0x685743, new THREE.Matrix4().compose(p.add(end).multiplyScalar(0.5),
          new THREE.Quaternion().setFromUnitVectors(up, delta.normalize()), new THREE.Vector3(1, 1, 1))); geo.dispose();
      };
      const h = [6.4, 7.3, 5.8, 6.9][kind], spread = [2.25, 1.65, 2.45, 1.95][kind];
      branch([0, 0, 0], [0.09, h * 0.7, -0.07], 0.29, 0.085);
      for (let i = 0; i < 11; i++) {
        const angle = i * 2.39996 + kind, reach = spread * (0.48 + random() * 0.45);
        const y = h * (0.48 + random() * 0.27), x = Math.cos(angle) * reach, z = Math.sin(angle) * reach;
        branch([0.04, y - 0.85, 0], [x, y + 0.43, z], 0.105, 0.025);
        for (let j = 0; j < 3; j++) {
          const geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position;
          // Uneven clusters and a porous silhouette instead of one smooth ball.
          for (let n = 0; n < p.count; n++) {
            const wobble = 0.92 + 0.14 * Math.sin(p.getX(n) * 17 + p.getY(n) * 9 + kind);
            p.setXYZ(n, p.getX(n) * wobble, p.getY(n) * wobble, p.getZ(n) * wobble);
          }
          geo.computeVertexNormals();
          const scale = 0.60 + random() * 0.28;
          leaves.geometry(geo, [0x416943, 0x587948, 0x365b40, 0x6c844e][(i + j + kind) % 4],
            new THREE.Matrix4().compose(new THREE.Vector3(x + (random() - 0.5) * 0.8,
              y + 0.50 + j * 0.34, z + (random() - 0.5) * 0.8),
              new THREE.Quaternion().setFromAxisAngle(up, random() * 6.28), new THREE.Vector3(scale * 1.2, scale, scale)));
          geo.dispose();
        }
      }
      treeCache.set(kind, { wood: wood.finish(), leaves: leaves.finish(), height: h });
    }
    const data = treeCache.get(kind), g = new THREE.Group();
    for (const [geo, name] of [[data.wood, 'TreeBranches'], [data.leaves, 'TreeFoliage']]) {
      const m = new THREE.Mesh(geo, materials.stone); m.name = name; m.castShadow = true; m.receiveShadow = true; g.add(m);
    }
    g.userData.trunk = { halfWidth: 0.34, height: data.height * 0.7 + 0.03 };
    return g;
  }
  function createPark(size, grassTexture) {
    const g = new THREE.Group(), ground = new Batch(), detail = new Batch(), water = new Batch(), solids = [];
    const half = size / 2;
    ground.box(size, 0.012, size, 0, 0.002, 0, 0x547245);
    if (grassTexture) {
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
        new THREE.MeshLambertMaterial({ map: grassTexture }));
      grass.rotation.x = -Math.PI / 2; grass.position.y = 0.010;
      grass.name = 'ParkGrass'; grass.receiveShadow = true; g.add(grass);
    }
    // The existing cross routes remain level and open, with a paved fountain plaza.
    for (const [w, d] of [[size, 3.2], [3.2, size]]) ground.box(w, 0.012, d, 0, 0.012, 0, 0xb6ac95);
    const plaza = new THREE.CylinderGeometry(5.25, 5.25, 0.014, 48).toNonIndexed();
    ground.geometry(plaza, 0xc5bba8, new THREE.Matrix4().makeTranslation(0, 0.014, 0)); plaza.dispose();
    for (const sx of [-1, 1]) {
      ground.box(size, 0.012, 0.12, 0, 0.021, sx * 1.6, 0x827e70);
      ground.box(0.12, 0.012, size, sx * 1.6, 0.021, 0, 0x827e70);
    }
    for (let v = -half + 0.7; v < half; v += 1.3) {
      ground.box(3.15, 0.004, 0.025, 0, 0.022, v, 0xa29882);
      ground.box(0.025, 0.004, 3.15, v, 0.022, 0, 0xa29882);
    }
    const ring = new THREE.TorusGeometry(3.03, 0.20, 8, 48).toNonIndexed();
    detail.geometry(ring, 0x999d91, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0.50, 0)); ring.dispose();
    const basin = new THREE.CylinderGeometry(3.0, 3.2, 0.38, 48).toNonIndexed();
    detail.geometry(basin, 0x828f88, new THREE.Matrix4().makeTranslation(0, 0.22, 0)); basin.dispose();
    const surface = new THREE.CircleGeometry(2.87, 48).toNonIndexed();
    water.geometry(surface, 0x64959a, new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, 0.423, 0)); surface.dispose();
    for (const r of [1.3, 2.1, 2.65]) {
      const ripple = new THREE.TorusGeometry(r, 0.009, 3, 48).toNonIndexed();
      water.geometry(ripple, 0xa2c5c4, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0.431, 0)); ripple.dispose();
    }
    solids.push({ x0: -3.25, x1: 3.25, z0: -3.25, z1: 3.25, h: 0.71 });
    for (let i = 0; i < 12; i++) {
      const angle = (i + 0.5) * Math.PI / 6, radius = Math.min(half - 4.1, half * 0.8);
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (Math.abs(x) < 3.2 || Math.abs(z) < 3.2) continue;
      const tree = createTree(i % 4); tree.position.set(x, 0, z); tree.rotation.y = i * 1.7; g.add(tree);
      solids.push({ x0: x - 0.34, x1: x + 0.34, z0: z - 0.34, z1: z + 0.34, h: tree.userData.trunk.height });
      const bed = new THREE.CylinderGeometry(0.94, 0.94, 0.012, 20).toNonIndexed();
      ground.geometry(bed, 0x675b44, new THREE.Matrix4().makeTranslation(x, 0.018, z)); bed.dispose();
    }
    // Low planting sits away from paths; no decorative object blocks an entrance.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 14; i++) {
      const x = sx * (5.8 + (i % 7) * 0.55), z = sz * (half - 2.5 - Math.floor(i / 7) * 0.45);
      if (Math.abs(x) > half - 2) continue;
      const bush = new THREE.IcosahedronGeometry(0.27, 0);
      detail.geometry(bush, i % 3 ? 0x4c6650 : 0x988397,
        new THREE.Matrix4().makeScale(1.3, 0.68, 1).setPosition(x, 0.18, z)); bush.dispose();
    }
    g.add(ground.mesh(materials.stone, 'ParkGround'), detail.mesh(materials.stone, 'ParkPlantingAndBasin'),
      water.mesh(materials.trim, 'ParkWater'));
    g.userData.solids = solids; g.userData.pathHalfWidth = 1.6;
    return g;
  }

  function createHelicopterShell() {
    const g = new THREE.Group(), frame = new Batch(), glass = materials.windows.clone();
    glass.opacity = 0.3;
    const fuselage = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14),
      new THREE.MeshPhongMaterial({ color: 0x33485d, shininess: 45 }));
    fuselage.scale.set(1.03, 0.77, 1.85); fuselage.position.set(0, 0.2, -0.65);
    fuselage.castShadow = true; fuselage.name = 'StreamlinedFuselage'; g.add(fuselage);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glass);
    canopy.scale.set(0.94, 0.8, 1.28); canopy.position.set(0, 0.25, 1.75); g.add(canopy);
    loft(frame, [[0.5, 0.8, -0.56, -0.27], [2.35, 0.71, -0.45, -0.18], [2.94, 0.21, -0.23, -0.13]], 0x33485d);
    frame.beam([0, -0.05, 2.95], [0, 0.99, 1.82], 0.055, 0.055, 0x243441);
    for (const sx of [-1, 1]) {
      frame.beam([sx * 0.9, -0.27, 1.3], [sx * 0.78, 0.89, 1.17], 0.06, 0.06, 0x243441);
      frame.box(0.035, 0.12, 1.6, sx * 0.994, 0.24, -0.46, 0xc5d4dc);
      frame.box(0.025, 0.035, 0.27, sx * 1.015, 0.1, -0.25, 0x92a7b4);
      // Door seam, hinge and ventilation grille follow the body envelope.
      frame.beam([sx * 0.95, -0.13, 0.28], [sx * 0.91, 0.63, 0.17], 0.022, 0.022, 0x20313e);
      for (let i = 0; i < 5; i++) frame.box(0.025, 0.018, 0.31,
        sx * 0.91, 0.44 + i * 0.04, -1.19, 0x1e2e38);
    }
    g.add(frame.mesh(materials.trim, 'CockpitFrame'));
    g.userData.visualKind = 'modern-helicopter'; return g;
  }

  let trainWheelGeometry;
  function trainDetails(count, length, gap, width, height, floor, color) {
    const metal = new Batch(), lamp = new Batch(), g = new THREE.Group();
    const positive = new Batch(), negative = new Batch();
    const wheelSpots = [];
    for (let w = 0; w < count; w++) {
      const x = (w - (count - 1) / 2) * (length + gap);
      // Ribbed roof housings stay within the existing roof height.
      for (const side of [-1, 1]) {
        metal.box(length - 0.3, 0.06, 0.09, x, floor + height - 0.23, side * (width / 2 + 0.015), 0xbecbd2);
        for (const px of [-2, 0, 2]) {
          metal.box(0.032, 1.82, 0.032, x + px, floor + 1.15, side * (width / 2 - 0.53), 0xd6b76b);
        }
      }
      for (const dx of [-length / 2 + 2.4, length / 2 - 2.4]) {
        for (const z of [-width / 2 + 0.2, width / 2 - 0.2]) {
          wheelSpots.push(new THREE.Vector3(x + dx, floor - 0.67, z));
        }
      }
      if (w === 0 || w === count - 1) {
        const sx = w === 0 ? -1 : 1, end = x + sx * (length / 2 + 0.075);
        metal.box(0.04, 0.12, width - 0.2, end, floor + 1.07, 0, color);
        for (const sz of [-1, 1]) (sx > 0 ? positive : negative).box(0.048, 0.065, 0.39,
          end, floor + 0.76, sz * 0.8, 0xffffff);
        metal.box(0.041, 0.19, 0.8, end, floor + 3.02, 0, 0x1c3039);
        lamp.box(0.047, 0.035, 0.53, end, floor + 3.02, 0, 0xf4d885);
      }
    }
    g.add(metal.mesh(materials.trim, 'TrainMetalwork'), lamp.mesh(materials.light, 'TrainLED'));
    const frontLights = new THREE.MeshBasicMaterial({ color: 0xe8f3f7 });
    const rearLights = new THREE.MeshBasicMaterial({ color: 0xd24632 });
    g.add(positive.mesh(frontLights, 'PositiveEndLights'), negative.mesh(rearLights, 'NegativeEndLights'));
    if (!trainWheelGeometry) trainWheelGeometry = wheel().clone().rotateY(Math.PI / 2).scale(0.37 / 0.35, 0.37 / 0.35, 0.37 / 0.35);
    const wheels = new THREE.InstancedMesh(trainWheelGeometry, materials.trim, wheelSpots.length);
    wheels.name = 'TrainWheels'; wheels.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    wheelSpots.forEach((p, i) => { matrix.makeTranslation(p.x, p.y, p.z); wheels.setMatrixAt(i, matrix); });
    g.add(wheels); g.userData.trainMotion = { wheels, wheelSpots, phase: 0, matrix, frontLights, rearLights };
    return g;
  }
  function updateTrain(g, speed, dt, direction) {
    const m = g.userData.trainMotion;
    if (!m || !Number.isFinite(speed) || !Number.isFinite(dt) || dt <= 0) return;
    const sign = Number.isFinite(direction) && direction !== 0 ? Math.sign(direction) : Math.sign(speed);
    if (sign) { m.frontLights.color.setHex(sign > 0 ? 0xe8f3f7 : 0xd24632);
      m.rearLights.color.setHex(sign > 0 ? 0xd24632 : 0xe8f3f7); }
    if (speed === 0) return;
    m.phase = (m.phase - speed * Math.min(dt, 0.1) / 0.37) % (Math.PI * 2);
    m.wheelSpots.forEach((p, i) => {
      m.matrix.makeRotationZ(m.phase); m.matrix.setPosition(p); m.wheels.setMatrixAt(i, m.matrix);
    });
    m.wheels.instanceMatrix.needsUpdate = true;
  }

  const OUTFITS = [
    { name: 'Alltag', top: 0x93adaf, pants: 0x667384, accessory: 'backpack' },
    { name: 'Pendler', top: 0xc2b3a0, pants: 0x676b78, accessory: 'satchel' },
    { name: 'Sport', top: 0xb18184, pants: 0x777c87, accessory: 'none' },
    { name: 'Freizeit', top: 0x7e9c87, pants: 0x8c8173, accessory: 'backpack' },
    { name: 'Stadt', top: 0xc3b897, pants: 0x767d8f, accessory: 'satchel' },
    { name: 'Abend', top: 0x939bbb, pants: 0x737784, accessory: 'none' },
  ];
  let civilianSerial = 0;
  const accessoryCache = new Map();
  /* Die Akzentfarben waren Sandbraun und Beige (0xb69454, 0xe0a05b,
     0x947250) - die Farbe von Packpapier. Zusammen mit den flachen
     Kloetzen ergab das den Eindruck "Pappkarton". Jetzt eine
     Einsatzpalette: dunkle Traeger, gesaettigte Akzente je Rolle.
     Die Breiten sind kleiner; 0,50 m war breiter als die Schultern der
     Figur und verdeckte den ganzen Anzug. */
  /* Kein neutrales Grau. Im Bild las sich 0x2b3038 unter der Sonne als
     helles Pappgrau, waehrend der gleich dunkle, aber blau getoente
     Traeger des Waechters (0x232d3a) sofort nach Material aussah - ein
     Farbstich entscheidet hier mehr als die Helligkeit. Jede Rolle
     bekommt deshalb einen getoenten, dunklen Traeger. */
  const ENEMIES = {
    schlaeger: { color: 0x7a2823, plate: 0x1e2028, width: 0.355 },
    brecher: { color: 0x7b4d1c, plate: 0x22201d, width: 0.40 },
    flink: { color: 0x246e77, plate: 0x172429, width: 0.315 },
    waechter: { color: 0x2f5680, plate: 0x1a222e, width: 0.375 },
    werfer: { color: 0x615d24, plate: 0x1f2229, width: 0.35 },
    duellant: { color: 0x277b77, plate: 0x162328, width: 0.315 },
    stuermer: { color: 0x853a1d, plate: 0x261c1b, width: 0.345 },
    enforcer: { color: 0x8c2e23, plate: 0x191c22, width: 0.415 },
  };
  /* ---- Rollenausruestung ----
     Vorher war das je Rolle eine flache Platte von bis zu 0,5 m Breite
     vor der Brust, dazu zwei helle Bloecke neben dem Hals und beim
     Werfer ein beigefarbener Wuerfel am Ruecken. Im Bild sah das aus wie
     ein Paket, das der Figur umgeschnallt wurde - genau die Beschwerde
     ("Pappkartons"). Drei Gruende dafuer, alle behoben:
       - eine EINZELNE flache Scheibe: sie stand vor der Brust wie ein
         Schild und folgte dem Koerper nicht,
       - Beige und Sandbraun als Akzent - die Farbe von Packpapier,
       - kein Glanz (MeshLambert) neben einem glaenzenden Anzug: die
         Ausruestung sah aus wie Karton neben lackiertem Metall.
     Jetzt ist es ein Plattentraeger: eine dreiteilige Platte, die sich um
     den Brustkorb legt, ein Bauchgurt, Schultergurte ueber die Schulter
     nach hinten, Gurtband quer und Schnallen aus Metall. */
  const RIG_GURT = 0x14181d;        // Gurtband, fast schwarz
  const RIG_METALL = 0x666e79;      // Schnallen und Karabiner
  const RIG_NAHT = 0x0e1116;        // Fugen und Kanten
  /* Eine Platte, die sich um den Brustkorb legt: Mittelstueck plus zwei
     abgewinkelte Seitenteile. Eine einzelne Scheibe steht immer vor der
     Figur, egal wie duenn sie ist. */
  function rigPlatte(b, breite, hoch, y, z, farbe, tiefe) {
    const t = tiefe === undefined ? 0.045 : tiefe;
    const mb = breite * 0.54;
    b.box(mb, hoch, t, 0, y, z, farbe);
    for (const sx of [-1, 1]) {
      /* Die Seitenteile lagen bei z - 0,021 und lasen sich von vorn als
         eine einzige flache Flaeche. Mit 4,5 cm Versatz und mehr Winkel
         sieht man die Woelbung. */
      b.box(breite * 0.30, hoch * 0.93, t * 0.92,
            sx * (mb / 2 + breite * 0.125), y, z - 0.045, farbe, sx * 0.80);
    }
  }
  /* Gurtband quer ueber die Platte - das, was einen Plattentraeger als
     solchen lesbar macht. */
  function rigWebbing(b, breite, y0, y1, z, reihen) {
    const n = reihen === undefined ? 3 : reihen;
    for (let i = 0; i < n; i++) {
      const y = y0 + (y1 - y0) * (n === 1 ? 0.5 : i / (n - 1));
      b.box(breite * 0.50, 0.022, 0.014, 0, y, z, RIG_GURT);
    }
  }
  function rigSchnalle(b, x, y, z) {
    b.box(0.042, 0.052, 0.020, x, y, z, RIG_METALL);
    b.box(0.030, 0.014, 0.024, x, y, z, RIG_NAHT);
  }
  /* Eine Tasche mit Deckel - nicht ein Wuerfel, sondern etwas, das man
     oeffnen koennte. */
  function rigTasche(b, w, h, d, x, y, z, farbe) {
    b.softBox(w, h, d, x, y, z, farbe);
    b.box(w * 0.96, 0.026, d * 0.62, x, y + h / 2 - 0.008, z + d * 0.16, RIG_NAHT);
    b.box(w * 0.34, 0.018, 0.012, x, y + h / 2 - 0.03, z + d / 2, RIG_METALL);
  }
  function accessory(kind) {
    if (accessoryCache.has(kind)) return accessoryCache.get(kind);
    const b = new Batch();
    if (kind === 'backpack') {
      b.softBox(0.29, 0.36, 0.14, 0, 1.3, -0.2, 0x334b54);
      b.softBox(0.25, 0.14, 0.04, 0, 1.19, -0.285, 0x54717a);
      for (const sx of [-1, 1]) b.beam([sx * 0.11, 1.51, -0.15], [sx * 0.12, 1.12, 0.145], 0.037, 0.022, 0x35434b);
    } else if (kind === 'satchel') {
      b.softBox(0.17, 0.23, 0.23, 0.22, 0.94, -0.05, 0x795e47);
      /* ---- Der Gurt liegt auf der Schulter ----
         Vorher lief er von der Huefte schraeg ueber die Brust nach oben
         und endete FREI IN DER LUFT vor dem Kinn (0,14 m vor dem Koerper,
         auf 1,49 m - das Schultergelenk liegt bei 1,45). Im Bild war das
         ein Brett, das der Figur quer vor dem Gesicht steckt; wer dabei
         das Handy ans Ohr hielt, sah aus, als habe er einen zweiten,
         steifen Arm. Ein Umhaengegurt geht ueber das Schultergelenk und
         auf dem Ruecken wieder hinunter zur Tasche - dann ist er
         geschlossen und endet nirgends. Duenner ist er auch: 3,5 cm
         Halbmesser war ein Riemen so dick wie ein Dachlatte. */
      /* ---- Der Gurt lag IM Oberkoerper ----
         Nachgeschaut im Bild: vom Gurt war vorn nur ein kurzer Stummel an
         der Tasche zu sehen, der Rest verschwand in der Jacke. Gerechnet:
         die Vorderstrecke lief von (0.21, 1.02, 0.09) geradewegs zur
         Schulter (-0.16, 1.43, 0.015) - auf Brusthoehe (1,22) liegt diese
         Gerade bei z = 0.057, und dort ist der Brustkorb. Ein Gurt gehoert
         AUF die Jacke.
         Die Vorderstrecke ist deshalb geknickt und laeuft ueber die Brust
         bei z = 0.145 - derselbe Wert, mit dem der Rucksackgurt in
         dieser Datei seit jeher aussen aufliegt. */
      b.beam([0.20, 0.99, 0.10], [0.02, 1.22, 0.145], 0.026, 0.019, 0x574638);
      b.beam([0.02, 1.22, 0.145], [-0.15, 1.44, 0.02], 0.024, 0.017, 0x574638);
      b.beam([-0.15, 1.44, 0.02], [-0.06, 1.12, -0.135], 0.024, 0.016, 0x574638);
      b.beam([-0.06, 1.12, -0.135], [0.17, 0.98, -0.10], 0.022, 0.015, 0x574638);
    } else {
      const e = ENEMIES[kind];
      /* Schmaler als vorher. Die alte Platte war bis zu 0,50 m breit und
         damit breiter als die Schultern der Figur; sie verdeckte den
         ganzen Anzug. */
      const w = e.width, hoch = kind === 'flink' ? 0.20 : 0.265, y = 1.315;
      const zP = 0.122;                       // Vorderkante der Platte
      rigPlatte(b, w, hoch, y, zP, e.plate);
      /* Halsband oben, damit die Platte nicht als Brett endet. Schmal -
         ein breites Band unter dem Kinn sieht aus wie eine Halskrause. */
      b.box(w * 0.34, 0.026, 0.046, 0, y + hoch / 2 + 0.010, zP - 0.006, RIG_GURT);
      /* ---- Schultergurte ----
         Sie liefen zuerst bis y + hoch/2 + 0,20, also auf 1,65 - das ist
         Kopfhoehe, und im Bild standen links und rechts vom Kopf zwei
         dunkle Streben wie eine Kopfstuetze. Das Schultergelenk der Figur
         liegt bei x rund 0,19 und y 1,45 (an der Bindepose abgelesen).
         Der Gurt geht deshalb jetzt nach AUSSEN ueber die Schulter, nicht
         nach oben am Hals vorbei. */
      const schX = Math.max(w * 0.30, 0.100), schHoch = y + hoch / 2 + 0.055;
      for (const sx of [-1, 1]) {
        b.beam([sx * schX, y + hoch / 2 - 0.02, zP - 0.012],
               [sx * (schX + 0.055), schHoch, 0.020], 0.044, 0.024, RIG_GURT);
        b.beam([sx * (schX + 0.055), schHoch, 0.020],
               [sx * (schX - 0.005), y - 0.02, -0.112], 0.042, 0.022, RIG_GURT);
        rigSchnalle(b, sx * schX, y + hoch / 2 - 0.055, zP + 0.020);
      }
      /* Bauchgurt - er schliesst den Traeger nach unten ab. */
      rigPlatte(b, w * 0.94, 0.085, y - hoch / 2 - 0.052, zP - 0.006, RIG_GURT, 0.052);
      rigSchnalle(b, 0, y - hoch / 2 - 0.052, zP + 0.022);
      /* Gurtband quer ueber der Platte. */
      rigWebbing(b, w, y - hoch * 0.28, y + hoch * 0.30, zP + 0.026,
                 kind === 'flink' ? 2 : 3);
      /* Rueckenplatte - ohne sie endet der Traeger an den Seiten im Nichts. */
      rigPlatte(b, w * 0.92, hoch * 0.92, y, -0.118, e.plate, 0.038);

      if (kind === 'brecher' || kind === 'enforcer') {
        /* Schulterpanzer, der wirklich AUF der Schulter sitzt und ihrer
           Rundung folgt - vorher zwei freischwebende Wuerfel neben dem
           Hals. */
        /* Die Panzer sassen bei y + 0,235 (also 1,55) und reichten in x bis
           0,29. Die Schulter der Figur liegt bei rund y 1,50 und x 0,19:
           sie schwebten also ueber und neben ihr. Jetzt sitzen sie auf
           der Schulter und ragen nur wenig darueber hinaus. */
        for (const sx of [-1, 1]) {
          b.softBox(0.140, 0.068, 0.185, sx * 0.180, y + 0.172, 0.004, e.plate);
          b.softBox(0.120, 0.050, 0.158, sx * 0.205, y + 0.122, 0.004, e.color);
          b.box(0.026, 0.026, 0.026, sx * 0.180, y + 0.206, 0.004, RIG_METALL);
        }
        rigTasche(b, 0.115, 0.115, 0.075, 0, y - hoch / 2 - 0.13, zP - 0.006, e.color);
      }
      if (kind === 'waechter') {
        /* Drei Magazintaschen nebeneinander statt drei gemalter Striche. */
        for (const sx of [-1, 0, 1])
          rigTasche(b, 0.088, 0.135, 0.062, sx * 0.098, y - 0.030, zP + 0.032, e.color);
      }
      if (kind === 'schlaeger') {
        rigTasche(b, 0.10, 0.115, 0.066, -0.115, y - 0.045, zP + 0.030, e.color);
        b.box(0.030, 0.115, 0.030, 0.125, y - 0.040, zP + 0.030, RIG_METALL);
      }
      if (kind === 'flink') {
        /* Leichtes Rig: nur ein schmales Band und ein Funkgeraet. */
        b.box(0.062, 0.088, 0.042, -0.098, y + 0.012, zP + 0.026, e.color);
        b.box(0.014, 0.075, 0.014, -0.098, y + 0.088, zP + 0.026, RIG_METALL);
      }
      if (kind === 'duellant') {
        /* Schrägriemen quer ueber die Brust, dazu die Scheide am Ruecken. */
        b.beam([-w * 0.34, y + hoch / 2 + 0.03, zP + 0.030],
               [w * 0.36, y - hoch / 2 - 0.02, zP + 0.024], 0.058, 0.022, e.color);
        rigSchnalle(b, w * 0.10, y - 0.02, zP + 0.044);
        b.softBox(0.055, 0.42, 0.048, -0.145, y - 0.02, -0.155, e.plate);
        b.box(0.042, 0.055, 0.038, -0.145, y + 0.185, -0.155, RIG_METALL);
      }
      if (kind === 'stuermer') {
        /* Sturmrucksack mit Deckel und zwei Spanngurten - kein Kasten. */
        b.softBox(0.245, 0.285, 0.135, 0, y + 0.045, -0.205, e.plate);
        b.softBox(0.225, 0.075, 0.115, 0, y + 0.196, -0.205, e.color);
        for (const sx of [-1, 1])
          b.beam([sx * 0.085, y + 0.175, -0.272], [sx * 0.085, y - 0.085, -0.272], 0.030, 0.016, RIG_GURT);
        b.box(0.055, 0.030, 0.026, 0, y + 0.150, -0.276, RIG_METALL);
      }
      if (kind === 'werfer') {
        /* Bandolier mit Wurfkoerpern statt eines beigen Wuerfels am
           Ruecken - man soll sehen, WOMIT er wirft. */
        b.beam([-w * 0.36, y + hoch / 2 + 0.02, zP + 0.028],
               [w * 0.30, y - hoch / 2 - 0.06, zP + 0.020], 0.070, 0.024, e.color);
        for (let i = 0; i < 4; i++) {
          const t = i / 3;
          const x = -w * 0.30 + t * (w * 0.55), yy = y + hoch / 2 - 0.03 - t * (hoch + 0.03);
          b.softBox(0.045, 0.070, 0.045, x, yy, zP + 0.052, 0x3d4a35);
          b.box(0.020, 0.018, 0.020, x, yy + 0.043, zP + 0.052, RIG_METALL);
        }
        rigTasche(b, 0.115, 0.130, 0.085, 0.155, y - 0.155, -0.140, e.plate);
      }
    }
    const geo = b.finish(); accessoryCache.set(kind, geo); return geo;
  }
  function attachAtBind(v, geometry, label) {
    const bone = v.knochen && (v.knochen.spine1 || v.knochen.spine || v.knochen.hips);
    if (!bone) return null;
    v.root.updateMatrixWorld(true);
    const mesh = new THREE.Mesh(geometry, materials.figur); mesh.name = label; mesh.castShadow = false;
    // Geometry is authored in character coordinates; transform once into the torso's bind space.
    const matrix = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(v.root.matrixWorld);
    matrix.decompose(mesh.position, mesh.quaternion, mesh.scale); bone.add(mesh); return mesh;
  }
  /* Stage 7A: with share = true, tinted copies are shared between all
     civilians wearing the same outfit over the same base material (keyed by
     material, region and outfit) instead of one or two new materials per
     passer-by; nothing mutates these copies afterwards. Without it the old
     per-figure copies stay - each new material draws a UUID from the game's
     seeded Math.random, and the street civilians spawned before the gangs
     must keep consuming exactly the same numbers. */
  const dressCopies = new Map();
  function dressCivilian(v, variant, share) {
    if (!v || !v.root || v.procedural || v.root.userData.cityOutfit) return;
    const kind = variant === undefined ? civilianSerial++ % OUTFITS.length : ((variant % OUTFITS.length) + OUTFITS.length) % OUTFITS.length;
    const outfit = OUTFITS[kind], copies = share ? dressCopies : new Map();
    v.root.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const name = o.name || '';
      const original = Array.isArray(o.material) ? o.material : [o.material];
      const changed = original.map(mat => {
        // Never recolor a combined body/skin atlas, hair, eyes or a bare body mesh.
        const region = /^(Topmat)$/i.test(mat.name) || /cloth|shirt|tops/i.test(name) ? 'top'
          : /^(Bottommat)$/i.test(mat.name) || /pants|bottoms/i.test(name) ? 'pants' : null;
        if (!region || !mat.color) return mat;
        const key = mat.uuid + ':' + region + (share ? ':' + outfit.name : '');
        if (!copies.has(key)) { const copy = mat.clone(); copy.color.multiply(new THREE.Color(outfit[region])); copies.set(key, copy); }
        return copies.get(key);
      });
      o.material = Array.isArray(o.material) ? changed : changed[0];
    });
    if (outfit.accessory !== 'none') attachAtBind(v, accessory(outfit.accessory), 'CityAccessory');
    v.root.userData.cityOutfit = outfit.name;
  }
  function dressEnemy(v, role) {
    if (!v || !v.root || v.procedural) return;
    const key = ENEMIES[role] ? role : 'schlaeger';
    if (v.root.userData.cityRole === key) return;
    if (!v.cityGear) v.cityGear = attachAtBind(v, accessory(key), 'EnemyRoleGear');
    else v.cityGear.geometry = accessory(key); // shared immutable geometry; no nodes accumulate on role changes
    v.root.userData.cityRole = key;
  }
  /* ---- Oberflaechentextur ----
     Die Batch-Geometrie traegt seit der UV-Erweiterung Texturkoordinaten
     aus der Weltposition. Eine graue Kachel wird hier MIT der vorhandenen
     Vertexfarbe multipliziert - die vier Fassadenstile bleiben also
     erhalten und bekommen nur Oberflaeche dazu. Ohne Aufruf sieht die
     Stadt genauso aus wie vorher; das Modul laedt selbst keine Datei und
     kennt keine Pfade. */
  function setzeFassadenTextur(tex) {
    if (!tex) return false;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    for (const name of ['stone', 'trim']) {
      const m = materials[name];
      if (!m) continue;
      m.map = tex;
      m.needsUpdate = true;
    }
    return true;
  }

  return { enabled, setzeFassadenTextur, createTower, innenraumPatch, setzeInnenraumLicht, fensterStapel, fensterInStapel, fensterGeometrie, createCar, updateCar, finishUtilityVehicle, createAmbulance, createBus, createTree, createPark, createHelicopterShell,
    trainDetails, updateTrain, dressCivilian, dressEnemy,
    towerStyles: TOWERS.map(t => t.name), carStyles: ['Fastback', 'Crossover', 'Sportkombi'],
    civilianStyles: OUTFITS.map(o => o.name), enemyStyles: Object.keys(ENEMIES) };
});
