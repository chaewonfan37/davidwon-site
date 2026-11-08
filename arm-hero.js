/* davidwon.org hero v2 (prototype): 3D arm with live IK on J1-J3, plus the 3-RRS ball balancer
   on the same workbench. The balancer runs a simulated PID loop on a ball (3-RRS IK drives the three
   cranks); tabs switch the camera between the arm and the balancer. In the balancer view the ball
   follows the cursor. Needs three.js r128 + GLTFLoader (loaded on demand). */
(function () {
  var SECTION = 'section[data-section-id="6aa8a6470e74f56a440959e6"]';
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  var DIR = SCRIPT_SRC ? SCRIPT_SRC.replace(/[^\/]*(\?.*)?$/, '') : '';
  var MODEL_URL = window.DW_ARM_MODEL_URL || DIR + 'arm_links.glb';
  var BAL_URL = window.DW_BAL_MODEL_URL || DIR + 'balancer_rig.glb';
  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
  var LOADER_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
  var JOINTS = {
    J1: { point: [0, 0.06172, 0], lim: [-170, 170] },
    J2: { point: [0.0043, 0.20352, -0.0469], lim: [-75, 55] },
    J3: { point: [0.0322, 0.37312, -0.1155], lim: [-110, 110] },
    tip: [0.02105, 0.38654, -0.29009]
  };
  // From balancer_joints.json (pidprojassem STEP): plate centre, crank shafts S, crank-link pivots C0,
  // plate ball joints A0, crank length l2 and link length L for each leg.
  var BAL = {"P0":[-0.003307,0.055638,-0.004012],"plateTop":0.05963,"legs":[{"u":[0.860689,0.0,-0.509131],"S":[0.045556,-0.014227,-0.032917],"C0":[0.084075,-0.014986,-0.055703],"A0":[0.081115,0.055638,-0.053951],"l2":0.04476,"L":0.070708},{"u":[-0.866727,0.0,-0.498783],"S":[-0.044295,-0.021369,-0.0276],"C0":[-0.082845,-0.014828,-0.049784],"A0":[-0.087713,0.055638,-0.052586],"l2":0.044956,"L":0.07069},{"u":[-0.000166,0.0,1.0],"S":[-0.003317,-0.010647,0.057001],"C0":[-0.003325,-0.014499,0.10172],"A0":[-0.003324,0.055638,0.094501],"l2":0.044884,"L":0.070508}]};
  var BAL_POS = window.DW_BAL_POS || [0.42, 0.04, -0.22];   // where the balancer sits on the workbench
  var BAL_YAW = window.DW_BAL_YAW || 0.4;

  function start() {
    var hero = document.querySelector(SECTION);
    if (!hero || hero.querySelector('.dw-arm')) return;
    var probe = document.createElement('canvas');
    if (!(probe.getContext('webgl') || probe.getContext('experimental-webgl'))) return;
    if (window.THREE && THREE.GLTFLoader) return mount(hero);
    load(THREE_URL, function () { load(LOADER_URL, function () { mount(hero); }); });
  }
  function load(src, cb) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = cb; document.head.appendChild(s); }

  function mount(hero) {
    var T = window.THREE;
    var css = document.createElement('style');
    css.textContent = SECTION + ' .content-wrapper{position:relative;z-index:1}' +
      '.dw-arm{position:absolute;inset:0;z-index:0;opacity:0;transition:opacity .9s ease;pointer-events:none}.dw-arm.on{opacity:1}' +
      '.dw-arm canvas{display:block}' +
      '.dw-arm-ro{position:absolute;right:4vw;bottom:22px;z-index:1;font:12px/1.7 "IBM Plex Mono",ui-monospace,monospace;color:#8A8F96;text-align:right;white-space:pre;pointer-events:none}' +
      '.dw-arm-ro b{color:#FF5A1F;font-weight:400}' +
      '.dw-tabs{position:relative;z-index:2;margin-top:26px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;' +
      '}.dw-tabs .lbl{font-size:11px;letter-spacing:.14em;color:#FF5A1F}.dw-tabs .hint{flex-basis:100%}.dw-tabs.abs{position:absolute;right:4vw;bottom:142px;margin:0;flex-direction:column;align-items:flex-end}.dw-tabs{' +
      'gap:10px 14px;font:500 12px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase}' +
      '.dw-tabs .seg{display:flex;border:1px solid #3A3F47;border-radius:999px;padding:3px;background:rgba(17,20,24,.75);backdrop-filter:blur(4px)}' +
      '.dw-tabs button{all:unset;cursor:pointer;color:#A9ADB3;padding:9px 16px;border-radius:999px;transition:color .2s,background .2s}' +
      '.dw-tabs button:hover{color:#F4F3EF}.dw-tabs button[aria-pressed="true"]{background:#FF5A1F;color:#111418}' +
      '.dw-tabs button:focus-visible{outline:1.5px solid #FF5A1F;outline-offset:3px}' +
      '.dw-tabs .hint{font-size:11px;letter-spacing:.1em;color:#6B7079;text-transform:none}' +
      '.dw-tip{position:absolute;z-index:2;pointer-events:none;transform:translateY(calc(-100% - 14px));opacity:0;transition:opacity .2s ease;font-family:"IBM Plex Mono",ui-monospace,monospace;background:rgba(17,20,24,.92);border:1px solid #3A3F47;border-left:3px solid #FF5A1F;padding:10px 14px;white-space:nowrap}' +
      '.dw-tip.on{opacity:1}.dw-tip .k{display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#FF5A1F;margin-bottom:5px}' +
      '.dw-tip .t{display:block;font:600 15px/1.2 "IBM Plex Sans",system-ui,sans-serif;color:#F4F3EF}.dw-tip .c{display:block;margin-top:6px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#A9ADB3}' +
      '@media (max-width:767px){.dw-arm.on{opacity:.45}.dw-arm-ro,.dw-tabs,.dw-tip{display:none}}';
    document.head.appendChild(css);
    if (getComputedStyle(hero).position === 'static') hero.style.position = 'relative';
    var stage = document.createElement('div'); stage.className = 'dw-arm'; stage.setAttribute('aria-hidden', 'true');
    var bg = hero.querySelector('.section-background');
    if (bg) bg.parentNode.insertBefore(stage, bg.nextSibling); else hero.insertBefore(stage, hero.firstChild);
    var ro = document.createElement('div'); ro.className = 'dw-arm-ro'; hero.appendChild(ro);
    var tabs = document.createElement('div'); tabs.className = 'dw-tabs';
    var seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Choose a robot to explore');
    var hint = document.createElement('span'); hint.className = 'hint'; hint.textContent = 'Hover a robot to inspect it, click to open';
    var lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = 'Explore in 3D';
    tabs.appendChild(lbl); tabs.appendChild(seg); tabs.appendChild(hint);
    var view = 'arm';
    function setView(v) {
      view = v;
      Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute('aria-pressed', x.dataset.view === view ? 'true' : 'false'); });
      kick();
    }
    [['arm', 'Robot arm'], ['bal', 'Ball balancer']].forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = t[1]; b.dataset.view = t[0];
      b.setAttribute('aria-pressed', t[0] === view ? 'true' : 'false');
      b.addEventListener('click', function () { setView(t[0]); });
      seg.appendChild(b);
    });
    // Hover card that floats over whichever robot is under the cursor.
    var tip = document.createElement('div'); tip.className = 'dw-tip'; tip.setAttribute('aria-hidden', 'true');
    tip.innerHTML = '<span class="k"></span><span class="t"></span><span class="c"></span>';
    var ITEMS = {
      bal: { k: 'Robotics + controls', t: 'Ball-balancing robot', c: 'Click to open project  ↗', href: '/portfolio-1-3-1/ball-balancing-robot' },
      arm: { k: 'Robotics + embedded', t: '6-DOF robot arm', c: 'Build in progress', href: null }
    };

    var V = function (a) { return new T.Vector3(a[0], a[1], a[2]); };
    var P1 = V(JOINTS.J1.point), P2 = V(JOINTS.J2.point), P3 = V(JOINTS.J3.point), TIP = V(JOINTS.tip);
    var R = Math.PI / 180, LIM = [JOINTS.J1.lim, JOINTS.J2.lim, JOINTS.J3.lim].map(function (l) { return [l[0] * R, l[1] * R]; });

    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x111418, 0);
    stage.appendChild(renderer.domElement);
    var scene = new T.Scene();
    scene.fog = new T.Fog(0x111418, 1.6, 3.4);
    var cam = new T.PerspectiveCamera(30, 1, 0.01, 20);
    scene.add(new T.AmbientLight(0xffffff, 0.55));
    var sun = new T.DirectionalLight(0xffffff, 0.55); sun.position.set(1, 2, -1.5); scene.add(sun);
    scene.add(new T.GridHelper(2.4, 48, 0x262B33, 0x1A1E24));
    var ring = []; for (var i = 0; i <= 128; i++) { var a = i / 128 * Math.PI * 2; ring.push(new T.Vector3(Math.sin(a) * 0.42, 0.001, Math.cos(a) * 0.42)); }
    var reach = new T.Line(new T.BufferGeometry().setFromPoints(ring), new T.LineDashedMaterial({ color: 0x2A2F36, dashSize: 0.012, gapSize: 0.014 }));
    reach.computeLineDistances(); scene.add(reach);

    var j1 = new T.Group(), j2 = new T.Group(), j3 = new T.Group();
    j1.position.copy(P1); j2.position.copy(P2).sub(P1); j3.position.copy(P3).sub(P2);
    scene.add(j1); j1.add(j2); j2.add(j3);
    var holder = { base: scene, link1: j1, link2: j2, link3: j3 };
    var pivot = { base: new T.Vector3(), link1: P1, link2: P2, link3: P3 };
    var fill = new T.MeshStandardMaterial({ color: 0x161A20, roughness: 0.9, metalness: 0.1, flatShading: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    var edgeCol = { structure: 0xA9ADB3, motor: 0x59606B, pulley: 0xFF5A1F };

    var tgt = new T.LineSegments(new T.EdgesGeometry(new T.OctahedronGeometry(0.014)), new T.LineBasicMaterial({ color: 0xFF5A1F }));
    var disc = new T.Mesh(new T.RingGeometry(0.018, 0.022, 48), new T.MeshBasicMaterial({ color: 0xFF5A1F, transparent: true, opacity: 0.55, side: T.DoubleSide }));
    disc.rotation.x = -Math.PI / 2;
    var stem = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(0, 1, 0)]), new T.LineDashedMaterial({ color: 0xFF5A1F, dashSize: 0.008, gapSize: 0.009, transparent: true, opacity: 0.45 }));
    scene.add(tgt); scene.add(disc); scene.add(stem);

    // ---------- arm kinematics (unchanged from v1) ----------
    var ax = new T.Vector3(1, 0, 0), ay = new T.Vector3(0, 1, 0);
    function fk(q, out) {
      out.copy(TIP).sub(P3).applyAxisAngle(ax, q[2]).add(P3);
      out.sub(P2).applyAxisAngle(ax, q[1]).add(P2);
      out.sub(P1).applyAxisAngle(ay, q[0]).add(P1);
      return out;
    }
    var LA = { y: P3.y - P2.y, z: P3.z - P2.z }, LB = { y: TIP.y - P3.y, z: TIP.z - P3.z };
    var L1 = Math.hypot(LA.y, LA.z), L2 = Math.hypot(LB.y, LB.z);
    var GAM = Math.atan2(LB.z, LB.y) - Math.atan2(LA.z, LA.y);
    var BR = GAM >= 0 ? 1 : -1;
    var LAT = TIP.x - P1.x;
    function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
    function clamp(v, lim) { return Math.max(lim[0], Math.min(lim[1], v)); }
    function solve(p) {
      var px = p.x - P1.x, pz = p.z - P1.z;
      var rho = Math.max(Math.hypot(px, pz), Math.abs(LAT) + 0.02);
      var zl = -Math.sqrt(rho * rho - LAT * LAT);
      var q1 = clamp(wrap(Math.atan2(px, pz) - Math.atan2(LAT, zl)), LIM[0]);
      var wy = p.y - P2.y, wz = zl - P2.z;
      var r = Math.max(Math.abs(L1 - L2) + 0.01, Math.min((L1 + L2) * 0.985, Math.hypot(wy, wz)));
      var c = Math.max(-0.995, Math.min(0.995, (r * r - L1 * L1 - L2 * L2) / (2 * L1 * L2)));
      var q3 = clamp(BR * Math.acos(c) - GAM, LIM[2]);
      var vy = LA.y + LB.y * Math.cos(q3) - LB.z * Math.sin(q3), vz = LA.z + LB.y * Math.sin(q3) + LB.z * Math.cos(q3);
      var q2 = clamp(wrap(Math.atan2(wz, wy) - Math.atan2(vz, vy)), LIM[1]);
      return [q1, q2, q3];
    }
    var q = [0, 0, 0];
    function ik(goal, dt) {
      var qt = solve(goal), k = dt > 0 ? 1 - Math.exp(-dt * 14) : 1;
      for (var i = 0; i < 3; i++) q[i] += wrap(qt[i] - q[i]) * k;
      j1.rotation.y = q[0]; j2.rotation.x = q[1]; j3.rotation.x = q[2];
    }

    // ---------- balancer rig ----------
    var bal = new T.Group(); bal.position.fromArray(BAL_POS); bal.rotation.y = BAL_YAW; scene.add(bal);
    var P0 = V(BAL.P0), plateG = new T.Group(); plateG.position.copy(P0); bal.add(plateG);
    var legs = BAL.legs.map(function (l) {
      var o = { u: V(l.u), S: V(l.S), C0: V(l.C0), A0: V(l.A0), l2: l.l2, L: l.L, crank: new T.Group(), link: new T.Group() };
      o.k = new T.Vector3().crossVectors(o.u, ay).normalize();
      var d0 = o.C0.clone().sub(o.S); o.th0 = Math.atan2(d0.y, d0.dot(o.u));
      o.v0 = o.A0.clone().sub(o.C0).normalize();
      o.crank.position.copy(o.S); o.link.position.copy(o.C0);
      bal.add(o.crank); bal.add(o.link);
      return o;
    });
    var RB = 0.016;   // ball radius (m)
    var ballMesh = new T.LineSegments(new T.EdgesGeometry(new T.IcosahedronGeometry(RB, 1)), new T.LineBasicMaterial({ color: 0xFF5A1F }));
    var ballFill = new T.Mesh(new T.IcosahedronGeometry(RB * 0.98, 1), fill);
    var ballG = new T.Group(); ballG.add(ballFill); ballG.add(ballMesh); plateG.add(ballG);
    var spMark = new T.Mesh(new T.RingGeometry(0.006, 0.0085, 32), new T.MeshBasicMaterial({ color: 0xFF5A1F, transparent: true, opacity: 0.7, side: T.DoubleSide }));
    spMark.rotation.x = -Math.PI / 2; plateG.add(spMark);
    var balEdge = { base: 0x8E939A, plate: 0xFF5A1F, crank: 0xA9ADB3, link: 0xA9ADB3 };

    // Ball on the plate: plate-frame position b, velocity v; PID sets the plate slope s (x, z).
    var b = new T.Vector2(0.03, -0.02), bv = new T.Vector2(), s = new T.Vector2(), I = new T.Vector2(), sp = new T.Vector2();
    var KP = 2.4, KD = 1.0, KI = 0.6, SMAX = Math.tan(10 * R), G57 = 9.81 * 5 / 7, RMAX = 0.078;
    var nextKick = 2.5, qPlate = new T.Quaternion(), nrm = new T.Vector3(), tmpA = new T.Vector3(), tmpC = new T.Vector3();
    function simBall(dt) {
      var h = dt / 4;
      for (var n = 0; n < 4; n++) {
        var ex = b.x - sp.x, ez = b.y - sp.y;
        I.x = Math.max(-0.05, Math.min(0.05, I.x + ex * h)); I.y = Math.max(-0.05, Math.min(0.05, I.y + ez * h));
        var cx = KP * ex + KD * bv.x + KI * I.x, cz = KP * ez + KD * bv.y + KI * I.y;
        var cm = Math.hypot(cx, cz); if (cm > SMAX) { cx *= SMAX / cm; cz *= SMAX / cm; }
        var k = 1 - Math.exp(-h * 22);                    // servo lag
        s.x += (cx - s.x) * k; s.y += (cz - s.y) * k;
        bv.x += -G57 * s.x * h; bv.y += -G57 * s.y * h;
        bv.multiplyScalar(1 - 0.25 * h);
        b.x += bv.x * h; b.y += bv.y * h;
        var r = b.length(); if (r > RMAX) { b.multiplyScalar(RMAX / r); var vr = (bv.x * b.x + bv.y * b.y) / RMAX; if (vr > 0) { bv.x -= 1.6 * vr * b.x / RMAX; bv.y -= 1.6 * vr * b.y / RMAX; } }
      }
    }
    function poseBalancer() {
      nrm.set(-s.x, 1, -s.y).normalize();
      qPlate.setFromUnitVectors(ay, nrm); plateG.quaternion.copy(qPlate);
      ballG.position.set(b.x, BAL.plateTop - P0.y + RB, b.y);
      spMark.position.set(sp.x, BAL.plateTop - P0.y + 0.0006, sp.y);
      legs.forEach(function (o) {
        tmpA.copy(o.A0).sub(P0).applyQuaternion(qPlate).add(P0);          // ball joint, balancer frame
        var d = tmpA.clone().sub(o.S), du = d.dot(o.u), dy = d.y, dd = d.lengthSq();
        var kk = (o.l2 * o.l2 + dd - o.L * o.L) / (2 * o.l2), rr = Math.hypot(du, dy);
        var base = Math.atan2(dy, du), off = Math.acos(Math.max(-1, Math.min(1, kk / rr)));
        var t1 = base + off, t2 = base - off, th = Math.abs(wrap(t1 - o.th0)) < Math.abs(wrap(t2 - o.th0)) ? t1 : t2;
        o.crank.quaternion.setFromAxisAngle(o.k, th - o.th0);
        tmpC.copy(o.u).multiplyScalar(Math.cos(th) * o.l2).addScaledVector(ay, Math.sin(th) * o.l2).add(o.S);
        o.link.position.copy(tmpC);
        o.link.quaternion.setFromUnitVectors(o.v0, tmpA.sub(tmpC).normalize());
      });
    }

    // ---------- camera views ----------
    var W = 1, H = 1, narrow = false;
    function size() {
      W = stage.clientWidth; H = stage.clientHeight; narrow = W < 768;
      renderer.setSize(W, H); cam.aspect = W / H;
      if (narrow) cam.setViewOffset(W, H, -W * 0.12, -H * 0.36, W, H);
      else { var fw = W * 1.6; cam.setViewOffset(fw, H, 0, H * 0.04, W, H); }
      cam.updateProjectionMatrix();
    }
    size();
    if (window.ResizeObserver) new ResizeObserver(size).observe(stage); else window.addEventListener('resize', size);
    var balWorld = new T.Vector3(); bal.updateMatrixWorld(); balWorld.copy(P0).applyMatrix4(bal.matrixWorld);
    var VIEWS = {
      arm: { center: new T.Vector3(0.1, 0.18, -0.1), dist: 1.95, hgt: 0.46, az: 0.85 },
      bal: { center: balWorld.clone().add(new T.Vector3(0, -0.01, 0)), dist: 0.86, hgt: 0.42, az: 0.95 }
    };
    var center = VIEWS.arm.center.clone(), dist = VIEWS.arm.dist, hgt = VIEWS.arm.hgt, azBase = VIEWS.arm.az;

    var ray = new T.Raycaster(), mouse = new T.Vector2(), plane = new T.Plane(), hit = new T.Vector3();
    var home = fk([0, 0, 0], new T.Vector3()), anchor = home.clone().add(new T.Vector3(0, -0.06, 0.02));
    var goal = home.clone(), cur = home.clone(), active = false, lastMove = 0, t = 0, last = performance.now();
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = stage.getBoundingClientRect();
      mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      active = true; lastMove = performance.now();
      if (reduce) kick();
    });
    hero.addEventListener('pointerleave', function () { active = false; });
    var visible = true, running = false, ready = 0;
    function kick() { if (ready === 2 && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }).observe(hero);
    var D = 180 / Math.PI;
    // Hover targets: the balancer's bounding box and a fixed box around the arm's working volume.
    var balBox = new T.Box3(), armBox = new T.Box3(new T.Vector3(-0.17, 0, -0.38), new T.Vector3(0.17, 0.5, 0.12));
    var balMats = [], armMats = [], armMeshes = [], armCore = [], armHit = new T.Vector3(), hovered = null, balScale = 1, glowB = 0, glowA = 0, hiCol = new T.Color(0xF4F3EF), tmpCol = new T.Color();
    var boxHit = new T.Vector3(), tipPt = new T.Vector3();
    hero.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a,button,input,textarea')) return;
      var r = stage.getBoundingClientRect();
      mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      active = true; pick();
      if (hovered === 'bal' && ITEMS.bal.href) { window.location.href = ITEMS.bal.href; }
      else if (hovered === 'arm' && view !== 'arm') setView('arm');
      else if (hovered === 'bal' && view !== 'bal') setView('bal');
    });
    function pick() {
      hovered = null;
      if (!active) return;
      ray.setFromCamera(mouse, cam);
      var db = ray.ray.intersectBox(balBox, boxHit) ? boxHit.distanceTo(ray.ray.origin) : Infinity;
      // The arm moves with the cursor, so test its actual meshes (cheap: each mesh's bounding sphere is checked first).
      // In the arm view the tip chases the cursor, so only the base and first link count as "the arm" there.
      var ah = ray.intersectObjects(view === 'arm' ? armCore : armMeshes, false), da = ah.length ? ah[0].distance : Infinity;
      if (ah.length) armHit.copy(ah[0].point);      if (db < Infinity || da < Infinity) hovered = db <= da ? 'bal' : 'arm';
    }
    function showTip(dt) {
      var it = hovered && ITEMS[hovered];
      if (!it) { tip.classList.remove('on'); hero.style.cursor = ''; return; }
      if (hovered === 'bal') tipPt.set((balBox.min.x + balBox.max.x) / 2, balBox.max.y, (balBox.min.z + balBox.max.z) / 2);
      else tipPt.copy(armHit).add(new T.Vector3(0, 0.04, 0));
      tipPt.project(cam);
      var r = stage.getBoundingClientRect(), hr = hero.getBoundingClientRect();
      tip.children[0].textContent = it.k; tip.children[1].textContent = it.t;
      tip.children[2].textContent = hovered === 'bal'
        ? (view === 'bal' ? 'Steer the ball, click to open ↗' : it.c)
        : (view === 'arm' ? 'Live IK on J1–J3, build in progress' : 'Click to explore');
      // Keep the card inside the hero (no sideways scroll at the right edge).
      var tw = tip.offsetWidth, x = r.left - hr.left + (tipPt.x + 1) / 2 * r.width - tw * 0.12;
      tip.style.left = Math.max(12, Math.min(hr.width - tw - 12, x)) + 'px';
      tip.style.top = Math.max(tip.offsetHeight + 24, r.top - hr.top + (1 - tipPt.y) / 2 * r.height) + 'px';
      tip.classList.add('on');
      hero.style.cursor = (hovered === 'bal' || view !== 'arm') ? 'pointer' : '';
    }
    var balInv = new T.Matrix4(), platePlane = new T.Plane(), hitL = new T.Vector3();
    if (/armdebug/.test(location.search)) window.__dwArmDbg = { goal: goal, cur: cur, q: q, solve: solve, fk: fk, b: b, s: s, sp: sp, setView: function (v) { view = v; kick(); } };
    function pad(n, w) { var s2 = typeof n === 'number' ? (Math.abs(n) < 0.05 ? '0.0' : n.toFixed(1)) : n; while (s2.length < (w || 6)) s2 = ' ' + s2; return s2; }
    function padi(n) { var s2 = String(Math.round(n)); while (s2.length < 5) s2 = ' ' + s2; return s2; }

    function frame(now) {
      now = now || performance.now();
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      t += dt * 0.48;
      var vw = VIEWS[view], kc = reduce ? 1 : 1 - Math.exp(-dt * 2.6);
      center.lerp(vw.center, kc); dist += (vw.dist - dist) * kc; hgt += (vw.hgt - hgt) * kc; azBase += (vw.az - azBase) * kc;
      var az = reduce ? azBase : azBase + 0.22 * Math.sin(t * 0.4) * (dist / 1.95);
      cam.position.set(center.x + Math.sin(az) * dist, center.y + hgt, center.z - Math.cos(az) * dist);
      cam.lookAt(center); cam.updateMatrixWorld();

      var cursorLive = active && now - lastMove < 4000;
      // arm: follows the cursor in the arm view, wanders otherwise
      if (cursorLive && view === 'arm') {
        ray.setFromCamera(mouse, cam);
        plane.setFromNormalAndCoplanarPoint(new T.Vector3(cam.position.x - anchor.x, 0, cam.position.z - anchor.z).normalize(), anchor);
        if (ray.ray.intersectPlane(plane, hit)) goal.copy(hit);
      } else if (!reduce) {
        goal.set(-0.03 + 0.16 * Math.sin(t * 0.9), 0.27 + 0.09 * Math.sin(t * 1.7), -0.24 - 0.05 * Math.cos(t * 0.9));
      }
      goal.y = Math.max(0.03, Math.min(goal.y, 0.6));
      var hx = goal.x - P1.x, hz = goal.z - P1.z, hr = Math.hypot(hx, hz);
      if (hr < 0.12) {
        if (hr < 1e-4) { hx = -Math.sin(q[0]); hz = -Math.cos(q[0]); hr = 1; }
        goal.x = P1.x + hx / hr * 0.12; goal.z = P1.z + hz / hr * 0.12;
      }
      cur.lerp(goal, reduce ? 1 : 1 - Math.exp(-dt * 7));
      ik(cur, reduce ? 0 : dt);
      var err = fk(q, new T.Vector3()).distanceTo(cur) * 1000;
      var showTgt = view === 'arm';
      tgt.visible = disc.visible = stem.visible = showTgt;
      tgt.position.copy(cur); tgt.rotation.y += dt * 1.8;
      disc.position.set(cur.x, 0.002, cur.z);
      stem.position.set(cur.x, 0, cur.z); stem.scale.set(1, Math.max(cur.y, 0.001), 1); stem.computeLineDistances();

      // balancer: in its view the setpoint follows the cursor on the plate; otherwise it holds the
      // centre and the ball gets an occasional nudge so the loop is always doing something.
      if (!reduce) {
        if (view === 'bal' && cursorLive) {
          ray.setFromCamera(mouse, cam);
          bal.updateMatrixWorld(); balInv.copy(bal.matrixWorld).invert();
          var top = new T.Vector3(0, BAL.plateTop, 0).applyMatrix4(bal.matrixWorld);
          platePlane.setFromNormalAndCoplanarPoint(ay, top);
          if (ray.ray.intersectPlane(platePlane, hit)) {
            hitL.copy(hit).applyMatrix4(balInv);
            sp.set(hitL.x - P0.x, hitL.z - P0.z); if (sp.length() > 0.06) sp.multiplyScalar(0.06 / sp.length());
          }
        } else {
          sp.multiplyScalar(1 - Math.min(1, dt * 2));
          nextKick -= dt;
          if (nextKick <= 0) { var ka = Math.random() * Math.PI * 2; bv.x += Math.cos(ka) * 0.16; bv.y += Math.sin(ka) * 0.16; nextKick = 3 + Math.random() * 2.5; }
        }
        simBall(dt);
      }
      poseBalancer();

      if (view === 'arm') {
        ro.innerHTML = 'J1 base     ' + padi(q[0] * D) + '°\nJ2 shoulder ' + padi(q[1] * D) + '°\nJ3 elbow    ' + padi(q[2] * D) + '°\n' +
          (err > 3 ? '<b>out of reach</b>' : 'tip error ' + err.toFixed(1) + ' mm') + '\nJ4–J6 in progress';
      } else {
        var e = Math.hypot(b.x - sp.x, b.y - sp.y) * 1000;
        ro.innerHTML = 'plate tilt x ' + pad(Math.atan(s.x) * D) + '°\nplate tilt z ' + pad(Math.atan(s.y) * D) + '°\nball error  ' + pad(e) + ' mm\n' +
          (cursorLive ? '<b>setpoint: cursor</b>' : 'setpoint: centre') + '\nsim: PID on ball position';
      }
      // hover: the robot under the cursor enlarges slightly and its lines brighten
      pick();
      var kh = reduce ? 1 : 1 - Math.exp(-dt * 10);
      balScale += ((hovered === 'bal' && view === 'arm' ? 1.16 : 1) - balScale) * kh;
      bal.scale.setScalar(balScale); bal.position.y = BAL_POS[1] * balScale;
      glowB += ((hovered === 'bal' ? 1 : 0) - glowB) * kh; glowA += ((hovered === 'arm' ? 1 : 0) - glowA) * kh;
      balMats.forEach(function (o) { o.m.color.copy(o.c0).lerp(hiCol, glowB * 0.85); });
      armMats.forEach(function (o) { o.m.color.copy(o.c0).lerp(hiCol, glowA * 0.6); });
      showTip(dt);
      renderer.render(scene, cam);
      if (!reduce && visible) requestAnimationFrame(frame); else running = false;
    }

    function addEdged(geo, parent, offset, color, angle, list) {
      geo.computeVertexNormals();
      var g = new T.Group(), mat = new T.LineBasicMaterial({ color: color });
      var mesh = new T.Mesh(geo, fill);
      g.add(mesh);
      g.add(new T.LineSegments(new T.EdgesGeometry(geo, angle || 32), mat));
      if (list === armMats) { armMeshes.push(mesh); if (parent === scene || parent === j1) armCore.push(mesh); }
      g.position.copy(offset).negate();
      parent.add(g);
      if (list && color !== 0xFF5A1F) list.push({ m: mat, c0: new T.Color(color) });
    }
    var done = function () {
      ready++;
      if (ready === 2) {
        bal.updateMatrixWorld(true); balBox.setFromObject(bal).expandByScalar(0.01);
        // Put the switcher right under the hero buttons, where visitors already look.
        var heroText = hero.querySelector('#block-85108f6628e631c326dd .sqs-html-content');
        if (heroText) heroText.parentNode.insertBefore(tabs, heroText.nextSibling); else { tabs.classList.add('abs'); hero.appendChild(tabs); }
        stage.classList.add('on'); hero.appendChild(tip); kick();
      }
    };
    var onModel = function (gltf) {
      gltf.scene.traverse(function (o) {
        if (!o.isMesh) return;
        var tag = (o.name || (o.parent && o.parent.name) || '').match(/(base|link1|link2|link3)_(structure|motor|pulley)/);
        if (tag) addEdged(o.geometry, holder[tag[1]], pivot[tag[1]], edgeCol[tag[2]], 32, armMats);
      });
      done();
    };
    var onBal = function (gltf) {
      gltf.scene.traverse(function (o) {
        if (!o.isMesh) return;
        var n = o.name || (o.parent && o.parent.name) || '', m = n.match(/^(base|plate|crank|link)(\d)?/);
        if (!m) return;
        if (m[1] === 'base') addEdged(o.geometry, bal, new T.Vector3(), balEdge.base, 30, balMats);
        else if (m[1] === 'plate') addEdged(o.geometry, plateG, P0, balEdge.plate, 30, balMats);
        else { var L = legs[+m[2]]; addEdged(o.geometry, m[1] === 'crank' ? L.crank : L.link, m[1] === 'crank' ? L.S : L.C0, balEdge[m[1]], 30, balMats); }
      });
      done();
    };
    var onFail = function () { stage.remove(); ro.remove(); tabs.remove(); };
    var loader = new T.GLTFLoader();
    loader.load(MODEL_URL, onModel, undefined, onFail);
    loader.load(BAL_URL, onBal, undefined, done);
  }

  var go = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(start); };
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
