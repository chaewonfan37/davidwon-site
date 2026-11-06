/* davidwon.org hero: 3D arm (arm_full_assem) following the cursor with live IK on J1-J3.
   Mounts behind the homepage hero section. Needs three.js r128 + GLTFLoader (loaded on demand). */
(function () {
  var SECTION = 'section[data-section-id="6aa8a6470e74f56a440959e6"]';
  // The model sits next to this script (e.g. jsDelivr .../arm-hero.js -> .../arm_links.glb).
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  var MODEL_URL = window.DW_ARM_MODEL_URL || (SCRIPT_SRC ? SCRIPT_SRC.replace(/arm-hero(\.min)?\.js(\?.*)?$/, 'arm_links.glb') : 'arm_links.glb');
  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
  var LOADER_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
  var JOINTS = {
    J1: { point: [0, 0.06172, 0], lim: [-170, 170] },
    J2: { point: [0.0043, 0.20352, -0.0469], lim: [-75, 55] },
    J3: { point: [0.0322, 0.37312, -0.1155], lim: [-110, 110] },
    tip: [0.02105, 0.38654, -0.29009]
  };

  function start() {
    var hero = document.querySelector(SECTION);
    if (!hero || hero.querySelector('.dw-arm')) return;
    var probe = document.createElement('canvas');
    if (!(probe.getContext('webgl') || probe.getContext('experimental-webgl'))) return;
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
      '@media (max-width:767px){.dw-arm.on{opacity:.45}.dw-arm-ro{display:none}}';
    document.head.appendChild(css);
    if (getComputedStyle(hero).position === 'static') hero.style.position = 'relative';
    var stage = document.createElement('div'); stage.className = 'dw-arm'; stage.setAttribute('aria-hidden', 'true');
    var bg = hero.querySelector('.section-background');
    if (bg) bg.parentNode.insertBefore(stage, bg.nextSibling); else hero.insertBefore(stage, hero.firstChild);
    var ro = document.createElement('div'); ro.className = 'dw-arm-ro'; hero.appendChild(ro);

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

    var ax = new T.Vector3(1, 0, 0), ay = new T.Vector3(0, 1, 0);
    function fk(q, out) {
      out.copy(TIP).sub(P3).applyAxisAngle(ax, q[2]).add(P3);
      out.sub(P2).applyAxisAngle(ax, q[1]).add(P2);
      out.sub(P1).applyAxisAngle(ay, q[0]).add(P1);
      return out;
    }
    // Closed-form IK (no iterations, so no dead spots at full stretch or at joint limits).
    // J1 yaws about +Y; J2 and J3 pitch about +X in J1's frame, so the tip stays in the plane x = LAT there.
    var LA = { y: P3.y - P2.y, z: P3.z - P2.z }, LB = { y: TIP.y - P3.y, z: TIP.z - P3.z };
    var L1 = Math.hypot(LA.y, LA.z), L2 = Math.hypot(LB.y, LB.z);
    var GAM = Math.atan2(LB.z, LB.y) - Math.atan2(LA.z, LA.y);   // elbow angle at q3 = 0 (CAD pose)
    var BR = GAM >= 0 ? 1 : -1;                                  // stay on the CAD elbow branch
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

    var ray = new T.Raycaster(), mouse = new T.Vector2(), plane = new T.Plane(), hit = new T.Vector3();
    var home = fk([0, 0, 0], new T.Vector3()), anchor = home.clone().add(new T.Vector3(0, -0.06, 0.02));
    var goal = home.clone(), cur = home.clone(), active = false, lastMove = 0, t = 0, last = performance.now();
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = stage.getBoundingClientRect();
      mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      active = true; lastMove = performance.now();
      if (reduce) kick();
    });
    hero.addEventListener('pointerleave', function () { active = false; });
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var visible = true, running = false, ready = false;
    // Single animation loop: every start goes through kick(), so it can never run twice.
    function kick() { if (ready && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }).observe(hero);
    var D = 180 / Math.PI, center = new T.Vector3(0, 0.2, -0.12);
    if (/armdebug/.test(location.search)) window.__dwArmDbg = { goal: goal, cur: cur, q: q, solve: solve, fk: fk, hit: hit, mouse: mouse };
    function pad(n) { var s = String(Math.round(n)); while (s.length < 5) s = ' ' + s; return s; }

    function frame(now) {
      now = now || performance.now();
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      t += dt * 0.48;
      var az = reduce ? 0.85 : 0.85 + 0.28 * Math.sin(t * 0.4), dist = narrow ? 2.6 : 1.88;
      cam.position.set(center.x + Math.sin(az) * dist, 0.66, center.z - Math.cos(az) * dist);
      cam.lookAt(center); cam.updateMatrixWorld();
      if (active && now - lastMove < 4000) {
        ray.setFromCamera(mouse, cam);
        plane.setFromNormalAndCoplanarPoint(new T.Vector3(cam.position.x - anchor.x, 0, cam.position.z - anchor.z).normalize(), anchor);
        if (ray.ray.intersectPlane(plane, hit)) goal.copy(hit);
      } else if (!reduce) {
        goal.set(-0.03 + 0.16 * Math.sin(t * 0.9), 0.27 + 0.09 * Math.sin(t * 1.7), -0.24 - 0.05 * Math.cos(t * 0.9));
      }
      goal.y = Math.max(0.03, Math.min(goal.y, 0.6));
      // Keep the target off the base axis, where the yaw angle becomes ill-defined and whips around.
      var hx = goal.x - P1.x, hz = goal.z - P1.z, hr = Math.hypot(hx, hz);
      if (hr < 0.12) {
        if (hr < 1e-4) { hx = -Math.sin(q[0]); hz = -Math.cos(q[0]); hr = 1; }
        goal.x = P1.x + hx / hr * 0.12; goal.z = P1.z + hz / hr * 0.12;
      }
      cur.lerp(goal, reduce ? 1 : 1 - Math.exp(-dt * 7));
      ik(cur, reduce ? 0 : dt);
      var err = fk(q, new T.Vector3()).distanceTo(cur) * 1000;
      tgt.position.copy(cur); tgt.rotation.y += dt * 1.8;
      disc.position.set(cur.x, 0.002, cur.z);
      stem.position.set(cur.x, 0, cur.z); stem.scale.set(1, Math.max(cur.y, 0.001), 1); stem.computeLineDistances();
      ro.innerHTML = 'J1 base     ' + pad(q[0] * D) + '°\nJ2 shoulder ' + pad(q[1] * D) + '°\nJ3 elbow    ' + pad(q[2] * D) + '°\n' +
        (err > 3 ? '<b>out of reach</b>' : 'tip error ' + err.toFixed(1) + ' mm') + '\nJ4–J6 in progress';
      renderer.render(scene, cam);
      if (!reduce && visible) requestAnimationFrame(frame); else running = false;
    }

    var onModel = function (gltf) {
      var meshes = [];
      gltf.scene.traverse(function (o) { if (o.isMesh) meshes.push(o); });
      meshes.forEach(function (mesh) {
        var tag = (mesh.name || (mesh.parent && mesh.parent.name) || '').match(/(base|link1|link2|link3)_(structure|motor|pulley)/);
        if (!tag) return;
        var geo = mesh.geometry; geo.computeVertexNormals();
        var g = new T.Group();
        g.add(new T.Mesh(geo, fill));
        g.add(new T.LineSegments(new T.EdgesGeometry(geo, 32), new T.LineBasicMaterial({ color: edgeCol[tag[2]] })));
        g.position.copy(pivot[tag[1]]).negate();
        holder[tag[1]].add(g);
      });
      stage.classList.add('on');
      ready = true; kick();
    };
    var onFail = function () { stage.remove(); ro.remove(); };
    var loader = new T.GLTFLoader();
    if (window.DW_ARM_GLB_B64) {
      // Model embedded in this script: no cross-origin fetch needed.
      var bin = atob(window.DW_ARM_GLB_B64), buf = new Uint8Array(bin.length);
      for (var b = 0; b < bin.length; b++) buf[b] = bin.charCodeAt(b);
      loader.parse(buf.buffer, '', onModel, onFail);
    } else {
      loader.load(MODEL_URL, onModel, undefined, onFail);
    }
  }

  var go = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(start); };
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
