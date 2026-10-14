/* ============================================================
 * Blockout Tools - 网页版关卡白盒工具
 * 纯前端 Three.js (r128 UMD)，离线双击运行
 * 对标 UE 插件 Blockout Tools 白盒工作流
 *
 * 章节索引：
 *   0. 常量与状态
 *   1. 白盒分色板
 *   2. 体块类型定义
 *   3. 参数化几何生成器
 *   4. 场景 / 渲染 / 相机 / 控件初始化
 *   5. 体块管理（创建 / 重建 / 销毁）
 *   6. 选中与高亮
 *   7. 三轴拉伸控制柄
 *   8. 放置模式（吸附 / 贴地 / Shift 连续放置）
 *   9. 场景树
 *  10. 参数面板
 *  11. 视图控制（透视/正交、顶/前/右、网格/线框）
 *  12. 快捷键
 *  13. 存档（JSON / GLB / OBJ / FBX 导出，GLB / OBJ 导入）
 *  14. UI 绑定与状态栏
 *  15. 多语言（中 / EN）
 *  16. 角色控制器（TPS / FPS 跑图）
 *  17. FBX 导出
 *  18. 本地文件（打开 / 保存 / 自动保存）
 * ============================================================ */

'use strict';

/* ============ 0. 常量与状态 ============ */
const canvas = document.getElementById('canvas');
const viewport = document.getElementById('viewport');

const GRID_COLOR = 0x4a5266;
const SELECT_COLOR = 0x2f6fbb;
const HANDLE_COLORS = { x: 0xdd4444, y: 0x44dd44, z: 0x4444dd };

const state = {
  bodies: [],            // 所有体块（THREE.Group）
  selected: null,        // 当前选中体块
  clipboard: null,       // 复制缓冲
  mode: 'select',        // 'select' | 'place'
  placeType: null,       // 当前放置类型
  previewBody: null,     // 放置预览
  handles: null,         // 控制柄 Group
  drag: null,            // 拖拽控制柄状态
  gridVisible: true,
  wireVisible: false,
  groundSnap: true,
  gridSize: 1,
  defaultCategory: '地面',
  isOrtho: false,
  idSeq: 1,
  raycaster: new THREE.Raycaster(),
  pointerNdc: new THREE.Vector2(),
  cameraDistance: 14,
};

/* ============ 1. 白盒分色板 ============ */
/* 对标 UE Blockout Tools：按用途分类的默认色板 */
const PALETTE = [
  { cat: '地面',     color: 0x3fae49, desc: 'ground' },
  { cat: '墙体',     color: 0x5a7fbf, desc: 'wall' },
  { cat: '障碍',     color: 0xd05353, desc: 'obstacle' },
  { cat: '可交互',   color: 0xf0b23a, desc: 'interactive' },
  { cat: '装饰',     color: 0x9b6fb8, desc: 'decor' },
  { cat: '危险',     color: 0xe07b2e, desc: 'danger' },
  { cat: '遮挡',     color: 0x7a7f8a, desc: 'blocker' },
];
const CATEGORY_COLOR = {};
PALETTE.forEach(p => { CATEGORY_COLOR[p.cat] = p.color; });
const CUSTOM_CAT = '自定义';

/* ============ 2. 体块类型定义 ============ */
const BLOCK_TYPES = {
  cube:     { label: 'Cube',     ic: '▢', params: [
    { k: 'w', l: '宽', def: 2, min: 0.1, step: 0.1 }, { k: 'h', l: '高', def: 2, min: 0.1, step: 0.1 }, { k: 'd', l: '深', def: 2, min: 0.1, step: 0.1 }],
    axis: { x: 'w', y: 'h', z: 'd' } },
  sphere:   { label: 'Sphere',   ic: '●', params: [
    { k: 'r', l: '半径', def: 1, min: 0.1, step: 0.1 }, { k: 'sw', l: '纬分段', def: 24, min: 4, step: 1, int: 1 }, { k: 'sh', l: '经分段', def: 16, min: 4, step: 1, int: 1 }],
    axis: { x: 'r', y: 'r', z: 'r' } },
  cylinder: { label: 'Cylinder', ic: '▮', params: [
    { k: 'r', l: '半径', def: 1, min: 0.1, step: 0.1 }, { k: 'h', l: '高', def: 2, min: 0.1, step: 0.1 }, { k: 'seg', l: '分段', def: 24, min: 4, step: 1, int: 1 }],
    axis: { x: 'r', y: 'h', z: 'r' } },
  cone:     { label: 'Cone',     ic: '▲', params: [
    { k: 'r', l: '半径', def: 1, min: 0.1, step: 0.1 }, { k: 'h', l: '高', def: 2, min: 0.1, step: 0.1 }, { k: 'seg', l: '分段', def: 24, min: 4, step: 1, int: 1 }],
    axis: { x: 'r', y: 'h', z: 'r' } },
  capsule:  { label: 'Capsule',  ic: '⬭', params: [
    { k: 'r', l: '半径', def: 0.6, min: 0.1, step: 0.1 }, { k: 'len', l: '柱长', def: 1.5, min: 0, step: 0.1 }, { k: 'seg', l: '分段', def: 16, min: 4, step: 1, int: 1 }],
    axis: { x: 'r', y: 'len', z: 'r' } },
  plane:    { label: 'Plane',    ic: '▭', params: [
    { k: 'w', l: '宽', def: 8, min: 0.1, step: 0.1 }, { k: 'd', l: '深', def: 8, min: 0.1, step: 0.1 }, { k: 't', l: '厚', def: 0.2, min: 0.05, step: 0.05 }],
    axis: { x: 'w', y: 't', z: 'd' } },
  ramp:     { label: 'Ramp',     ic: '⛼', params: [
    { k: 'w', l: '宽', def: 2, min: 0.1, step: 0.1 }, { k: 'h', l: '高', def: 1, min: 0.1, step: 0.1 }, { k: 'd', l: '长', def: 4, min: 0.1, step: 0.1 }],
    axis: { x: 'w', y: 'h', z: 'd' } },
  wedge:    { label: 'Wedge',    ic: '⊿', params: [
    { k: 'w', l: '宽', def: 2, min: 0.1, step: 0.1 }, { k: 'h', l: '高', def: 1, min: 0.1, step: 0.1 }, { k: 'd', l: '深', def: 2, min: 0.1, step: 0.1 }],
    axis: { x: 'w', y: 'h', z: 'd' } },
  stair:    { label: 'Stair',    ic: '▦', params: [
    { k: 'w', l: '宽', def: 2, min: 0.1, step: 0.1 }, { k: 'h', l: '总高', def: 2, min: 0.1, step: 0.1 }, { k: 'd', l: '总深', def: 3, min: 0.2, step: 0.1 }, { k: 'steps', l: '踏步数', def: 8, min: 1, step: 1, int: 1 }],
    axis: { x: 'w', y: 'h', z: 'd' } },
  corner:   { label: 'Corner',   ic: '∟', params: [
    { k: 'w', l: '长臂', def: 2, min: 0.1, step: 0.1 }, { k: 'd', l: '短臂', def: 2, min: 0.1, step: 0.1 }, { k: 'h', l: '高', def: 2, min: 0.1, step: 0.1 }, { k: 't', l: '臂厚', def: 0.5, min: 0.1, step: 0.1 }],
    axis: { x: 'w', y: 'h', z: 'd' } },
  arch:     { label: 'Arch',     ic: '⌒', params: [
    { k: 'w', l: '宽', def: 4, min: 0.6, step: 0.1 }, { k: 'h', l: '高', def: 3, min: 0.6, step: 0.1 }, { k: 'd', l: '深', def: 1, min: 0.1, step: 0.1 }, { k: 't', l: '壁厚', def: 0.4, min: 0.1, step: 0.1 }, { k: 'ah', l: '拱高', def: 1.8, min: 0.2, step: 0.1 }],
    axis: { x: 'w', y: 'h', z: 'd' } },
  pipe:     { label: 'Pipe',     ic: '◍', params: [
    { k: 'ro', l: '外径', def: 0.8, min: 0.15, step: 0.1 }, { k: 'ri', l: '内径', def: 0.5, min: 0.05, step: 0.05 }, { k: 'len', l: '长度', def: 3, min: 0.1, step: 0.1 }, { k: 'seg', l: '分段', def: 24, min: 6, step: 1, int: 1 }],
    axis: { x: 'ro', y: 'len', z: 'ro' } },
};
const BLOCK_ORDER = ['cube', 'sphere', 'cylinder', 'cone', 'capsule', 'plane', 'ramp', 'wedge', 'stair', 'corner', 'arch', 'pipe'];

/* ============ 3. 参数化几何生成器 ============ */
/* 统一约定：生成的 geometry 底部中心在原点 (0,0,0)，+Y 向上，x/z 居中 */
const GEO = {
  cube(p) {
    const g = new THREE.BoxGeometry(p.w, p.h, p.d);
    g.translate(0, p.h / 2, 0);
    return [g];
  },
  sphere(p) {
    const g = new THREE.SphereGeometry(p.r, p.sw, p.sh);
    g.translate(0, p.r, 0);
    return [g];
  },
  cylinder(p) {
    const g = new THREE.CylinderGeometry(p.r, p.r, p.h, p.seg);
    g.translate(0, p.h / 2, 0);
    return [g];
  },
  cone(p) {
    const g = new THREE.ConeGeometry(p.r, p.h, p.seg);
    g.translate(0, p.h / 2, 0);
    return [g];
  },
  capsule(p) {
    const cap = Math.max(p.seg, 4);
    const g = new THREE.CapsuleGeometry(p.r, p.len, cap, Math.max(p.seg, 8));
    g.translate(0, p.len / 2 + p.r, 0);
    return [g];
  },
  plane(p) {
    const g = new THREE.BoxGeometry(p.w, p.t, p.d);
    g.translate(0, p.t / 2, 0);
    return [g];
  },
  /* 三棱柱（Ramp 与 Wedge 共用几何：底面矩形 + 斜面，低端在 -Z，高端在 +Z 高 h） */
  prism(p) {
    const w = p.w / 2, d = p.d / 2, h = p.h;
    const v = [
      [-w, 0, -d], [w, 0, -d], [w, 0, d], [-w, 0, d],  // 底面四角
      [-w, h, d], [w, h, d],                           // 高端顶棱
    ];
    const idx = [
      0, 1, 2, 0, 2, 3,   // 底面
      0, 1, 5, 0, 5, 4,   // 斜面
      0, 3, 4,            // 左端面
      1, 5, 2,            // 右端面
      2, 5, 4, 2, 4, 3,   // 高端竖面
    ];
    const pos = new Float32Array(18 * 3);
    idx.forEach((vi, i) => { pos[i * 3] = v[vi][0]; pos[i * 3 + 1] = v[vi][1]; pos[i * 3 + 2] = v[vi][2]; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return [g];
  },
  stair(p) {
    const steps = Math.max(1, Math.floor(p.steps));
    const tread = p.h / steps, depth = p.d / steps;
    const out = [];
    for (let i = 0; i < steps; i++) {
      const g = new THREE.BoxGeometry(p.w, tread, depth);
      g.translate(0, i * tread + tread / 2, -p.d / 2 + (i + 0.5) * depth);
      out.push(g);
    }
    return out;
  },
  corner(p) {
    const t = p.t, w = p.w, d = p.d, h = p.h;
    const a = new THREE.BoxGeometry(w, h, t);
    a.translate(w / 2 - t / 2, h / 2, t / 2 - d / 2);
    const b = new THREE.BoxGeometry(t, h, d);
    b.translate(t / 2 - w / 2, h / 2, d / 2 - t / 2);
    return [a, b];
  },
  arch(p) {
    const w = p.w, h = p.h, d = p.d, t = Math.min(p.t, w / 2 - 0.01);
    const r = Math.min((w - 2 * t) / 2, Math.max(0.05, h - t - p.ah));
    const ah = p.ah;
    const outer = new THREE.Shape();
    outer.moveTo(0, 0); outer.lineTo(w, 0); outer.lineTo(w, h); outer.lineTo(0, h); outer.closePath();
    const hole = new THREE.Path();
    hole.moveTo(t, t); hole.lineTo(w - t, t); hole.lineTo(w - t, ah);
    hole.absarc(w / 2, ah, r, 0, Math.PI, true);
    hole.lineTo(t, t); hole.closePath();
    outer.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(outer, { depth: d, bevelEnabled: false, curveSegments: 16 });
    g.translate(-w / 2, 0, -d / 2);
    return [g];
  },
  pipe(p) {
    const ro = p.ro, ri = Math.min(p.ri, ro - 0.01), len = p.len, seg = Math.max(6, Math.floor(p.seg));
    const pts = [new THREE.Vector2(ro, 0), new THREE.Vector2(ro, len), new THREE.Vector2(ri, len), new THREE.Vector2(ri, 0)];
    const g = new THREE.LatheGeometry(pts, seg);
    const capB = new THREE.RingGeometry(ri, ro, seg);
    capB.rotateX(Math.PI / 2);
    const capT = new THREE.RingGeometry(ri, ro, seg);
    capT.rotateX(-Math.PI / 2);
    capT.translate(0, len, 0);
    return [g, capB, capT];
  },
};

/* 各类型默认参数（取元数据 def） */
function defaultParams(type) {
  const out = {};
  BLOCK_TYPES[type].params.forEach(pd => { out[pd.k] = pd.def; });
  return out;
}

/* 根据参数生成几何组 [{geometry}] */
function buildGeometries(type, params) {
  if (type === 'ramp' || type === 'wedge') return GEO.prism(params);
  return GEO[type](params);
}

/* 获取体块显示尺寸 {x,y,z}（控制柄锚点用） */
function getBodySize(type, params, body) {
  if (type === 'imported' && body) {
    const box = new THREE.Box3().setFromObject(body);
    const s = box.getSize(new THREE.Vector3());
    return { x: s.x || 1, y: s.y || 1, z: s.z || 1 };
  }
  const t = BLOCK_TYPES[type];
  const pick = k => (params[k] !== undefined ? params[k] : 1);
  if (type === 'cube' || type === 'plane' || type === 'ramp' || type === 'wedge' || type === 'stair' || type === 'corner' || type === 'arch') {
    return { x: pick('w'), y: pick('h'), z: pick('d') };
  }
  if (type === 'sphere') { const r = pick('r'); return { x: r * 2, y: r * 2, z: r * 2 }; }
  if (type === 'cylinder' || type === 'cone') { const r = pick('r'); return { x: r * 2, y: pick('h'), z: r * 2 }; }
  if (type === 'capsule') { const r = pick('r'); return { x: r * 2, y: pick('len') + r * 2, z: r * 2 }; }
  if (type === 'pipe') { const ro = pick('ro'); return { x: ro * 2, y: pick('len'), z: ro * 2 }; }
  return { x: 1, y: 1, z: 1 };
}

/* ============ 4. 场景 / 渲染 / 相机 / 控件初始化 ============ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x262a31);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = false;

let camera = new THREE.PerspectiveCamera(55, 1, 0.01, 2000);
camera.position.set(9, 7.5, 11);
camera.lookAt(0, 1, 0);

let controls = new THREE.OrbitControls(camera, canvas);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.12;

/* 网格（可切换） */
const grid = new THREE.GridHelper(40, 40, GRID_COLOR, GRID_COLOR);
grid.material.transparent = true;
grid.material.opacity = 0.35;
scene.add(grid);

/* 地面平面（用于放置射线） */
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h);
  if (camera.isOrthographicCamera) {
    const halfH = state.cameraDistance, halfW = halfH * (w / h);
    camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  } else {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}
window.addEventListener('resize', resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  const dt = (typeof clock !== 'undefined' && clock) ? clock.getDelta() : 0.016;
  if (!state.playerMode) controls.update();
  if (state.playerMode) updateRole(dt);
  if (state.handles) updateHandlesVisual();
  renderer.render(scene, camera);
}
animate();

/* ============ 5. 体块管理 ============ */
function bodyMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color: color, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide,
  });
}
function edgeMaterial() {
  return new THREE.LineBasicMaterial({ color: 0x11131a, transparent: true, opacity: 0.5 });
}

/* 创建体块 Group：含实体 Mesh + 边线 Mesh */
function createBody(data) {
  const body = new THREE.Group();
  body.userData = {
    id: state.idSeq++,
    type: data.type,
    name: data.name || (t('bt_' + data.type, BLOCK_TYPES[data.type].label) + '_' + state.idSeq),
    category: data.category || '地面',
    color: data.color !== undefined ? data.color : CATEGORY_COLOR['地面'],
    params: Object.assign(defaultParams(data.type), data.params || {}),
    movable: true,
    isBody: true,
  };
  body.position.set(data.x || 0, data.y || 0, data.z || 0);
  if (data.ry) body.rotation.y = data.ry;
  if (data.visible === false) body.visible = false;
  rebuildBodyGeometry(body);
  scene.add(body);
  state.bodies.push(body);
  return body;
}

/* 依据 params 重建几何（实体 + 边线） */
function rebuildBodyGeometry(body) {
  const ud = body.userData;
  const prevColor = ud.color;
  // 清除旧 children
  for (let i = body.children.length - 1; i >= 0; i--) {
    const c = body.children[i];
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
    body.remove(c);
  }
  const geos = buildGeometries(ud.type, ud.params);
  geos.forEach(g => {
    const mesh = new THREE.Mesh(g, bodyMaterial(prevColor));
    mesh.userData.isBodyMesh = true;
    body.add(mesh);
    const eg = new THREE.EdgesGeometry(g, 22);
    const edge = new THREE.LineSegments(eg, edgeMaterial());
    edge.userData.isEdge = true;
    body.add(edge);
  });
}

function removeBody(body) {
  if (!body) return;
  if (state.selected === body) clearSelection();
  const i = state.bodies.indexOf(body);
  if (i >= 0) state.bodies.splice(i, 1);
  scene.remove(body);
  body.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
  refreshTree();
  updateStatus();
}

/* ============ 6. 选中与高亮 ============ */
function selectBody(body) {
  if (state.selected === body) return;
  clearSelection();
  state.selected = body;
  state.mode = 'select';
  if (body) {
    body.userData.sel = true;
    body.traverse(c => {
      if (c.isMesh) { c.material.emissive = new THREE.Color(SELECT_COLOR); c.material.emissiveIntensity = 0.35; }
    });
    createHandles(body);
    setModeUI('select');
  }
  refreshTree();
  updateParamPanel();
  updateStatus();
}

function clearSelection() {
  if (state.selected) {
    state.selected.userData.sel = false;
    state.selected.traverse(c => {
      if (c.isMesh) { c.material.emissive = new THREE.Color(0x000000); c.material.emissiveIntensity = 0; }
    });
    removeHandles();
  }
  state.selected = null;
}

/* ============ 7. 三轴拉伸控制柄 ============ */
/* 对标 UE box 控制柄：三轴箭头，拖拽实时改对应尺寸参数 */

function createHandles(body) {
  removeHandles();
  const hg = new THREE.Group();
  hg.userData.isHandles = true;
  ['x', 'y', 'z'].forEach(axis => {
    const hg2 = new THREE.Group();
    hg2.userData.handleAxis = axis;
    const col = HANDLE_COLORS[axis];
    const mat = new THREE.MeshBasicMaterial({ color: col });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), mat);
    shaft.rotation.z = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 12), mat);
    head.rotation.z = -Math.PI / 2;
    head.position.x = 0.34 + 0.1;
    hg2.add(shaft, head);
    hg.add(hg2);
  });
  state.handles = hg;
  scene.add(hg);
  updateHandlesVisual();
}

function removeHandles() {
  if (state.handles) {
    scene.remove(state.handles);
    state.handles.traverse(c => { if (c.material) c.material.dispose(); });
    state.handles = null;
  }
  state.drag = null;
}

/* 控制柄锚点：体块包围盒侧面（考虑旋转），保持世界坐标 */
function updateHandlesVisual() {
  if (!state.handles || !state.selected) return;
  const body = state.selected;
  const size = getBodySize(body.userData.type, body.userData.params, body);
  const anchor = { x: [size.x / 2, 0, 0], y: [0, size.y, 0], z: [0, 0, size.z / 2] };
  body.updateMatrixWorld(true);
  const worldP = new THREE.Vector3();
  state.handles.children.forEach(hg2 => {
    const a = anchor[hg2.userData.handleAxis];
    worldP.set(a[0], a[1], a[2]);
    worldP.applyMatrix4(body.matrixWorld);
    hg2.position.copy(worldP);
  });
}

/* 拖拽：射线与过锚点、法线为相机朝向的平面求交 */
function startHandleDrag(axis, event) {
  const body = state.selected;
  if (!body || body.userData.type === 'imported') return;
  const size = getBodySize(body.userData.type, body.userData.params, body);
  const anchor = { x: [size.x / 2, 0, 0], y: [0, size.y, 0], z: [0, 0, size.z / 2] }[axis];
  body.updateMatrixWorld(true);
  const worldAnchor = new THREE.Vector3(anchor[0], anchor[1], anchor[2]).applyMatrix4(body.matrixWorld);
  // 平面：法线=相机方向，过 worldAnchor
  const camDir = camera.getWorldDirection(new THREE.Vector3());
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, worldAnchor);
  const ray = pointerRay(event);
  const hit = new THREE.Vector3();
  const ok = ray.intersectPlane(plane, hit);
  if (!ok) return;
  const axisVec = new THREE.Vector3(1, 0, 0).applyQuaternion(body.quaternion);
  if (axis === 'y') axisVec.set(0, 1, 0).applyQuaternion(body.quaternion);
  if (axis === 'z') axisVec.set(0, 0, 1).applyQuaternion(body.quaternion);
  const pKey = BLOCK_TYPES[body.userData.type].axis[axis];
  state.drag = { axis, pKey, base: hit.clone(), startValue: body.userData.params[pKey] || 0, axisVec };
  document.body.style.cursor = 'grabbing';
}

function updateHandleDrag(event) {
  const d = state.drag;
  if (!d) return;
  const body = state.selected;
  const size = getBodySize(body.userData.type, body.userData.params, body);
  const anchor = { x: [size.x / 2, 0, 0], y: [0, size.y, 0], z: [0, 0, size.z / 2] }[d.axis];
  body.updateMatrixWorld(true);
  const worldAnchor = new THREE.Vector3(anchor[0], anchor[1], anchor[2]).applyMatrix4(body.matrixWorld);
  const camDir = camera.getWorldDirection(new THREE.Vector3());
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, worldAnchor);
  const ray = pointerRay(event);
  const hit = new THREE.Vector3();
  if (!ray.intersectPlane(plane, hit)) return;
  const delta = hit.sub(d.base).dot(d.axisVec);
  let val = d.startValue + delta;
  const pd = BLOCK_TYPES[body.userData.type].params.find(x => x.k === d.pKey);
  val = Math.max(pd ? pd.min : 0.1, val);
  body.userData.params[d.pKey] = round1(val);
  rebuildBodyGeometry(body);
  restoreSelectionHighlight(body);
  updateParamPanel();
  updateHandlesVisual();
  updateStatus();
}

function endHandleDrag() {
  state.drag = null;
  document.body.style.cursor = '';
}

/* 选中高亮在重建后需要恢复 */
function restoreSelectionHighlight(body) {
  body.traverse(c => {
    if (c.isMesh) { c.material.emissive = new THREE.Color(SELECT_COLOR); c.material.emissiveIntensity = 0.35; }
  });
}

/* ============ 8. 放置模式（吸附 / 贴地 / Shift 连续放置） ============ */
function enterPlaceMode(type) {
  state.mode = 'place';
  state.placeType = type;
  setModeUI('place');
  if (!state.previewBody) {
    const ud = { type, name: 'preview', category: '地面', color: 0xffffff, params: defaultParams(type), isPreview: true };
    state.previewBody = createPreviewBody(ud);
    scene.add(state.previewBody);
  }
  updateStatus();
}

function exitPlaceMode() {
  state.mode = 'select';
  state.placeType = null;
  if (state.previewBody) {
    scene.remove(state.previewBody);
    state.previewBody.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    state.previewBody = null;
  }
  setModeUI('select');
  updateStatus();
}

function createPreviewBody(ud) {
  const g = new THREE.Group();
  const geos = buildGeometries(ud.type, ud.params);
  const mat = new THREE.MeshBasicMaterial({ color: 0x88c0ff, transparent: true, opacity: 0.4, wireframe: false, side: THREE.DoubleSide });
  geos.forEach(geo => {
    const m = new THREE.Mesh(geo, mat);
    m.userData.isPreviewMesh = true;
    g.add(m);
    const eg = new THREE.EdgesGeometry(geo, 22);
    const e = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x88c0ff, transparent: true, opacity: 0.7 }));
    e.userData.isPreviewMesh = true;
    g.add(e);
  });
  return g;
}

function pointerNdcFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  state.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return state.pointerNdc;
}
function pointerRay(event) {
  state.raycaster.setFromCamera(pointerNdcFromEvent(event), camera);
  return state.raycaster.ray;
}

function snapVal(v) {
  const g = state.gridSize;
  return Math.round(v / g) * g;
}

/* 计算放置点：贴地 → y=0 平面；否则射线打到现有体块或地面 */
function computePlacePoint(event) {
  const ray = pointerRay(event);
  const hit = new THREE.Vector3();
  if (state.groundSnap || !ray.intersectPlane(groundPlane, hit)) {
    if (ray.intersectPlane(groundPlane, hit)) {
      return { x: snapVal(hit.x), y: 0, z: snapVal(hit.z) };
    }
    return null;
  }
  // 不贴地：打到现有体块表面
  const targets = [];
  state.bodies.forEach(b => b.traverse(c => { if (c.isMesh && !c.userData.isEdge) targets.push(c); }));
  if (targets.length) {
    const hits = state.raycaster.intersectObjects(targets, false);
    if (hits.length) {
      const p = hits[0].point;
      return { x: snapVal(p.x), y: p.y, z: snapVal(p.z) };
    }
  }
  return null;
}

function placeBlock(event) {
  const pt = computePlacePoint(event);
  if (!pt) return;
  const body = createBody({
    type: state.placeType,
    x: pt.x, y: pt.y, z: pt.z,
    category: state.defaultCategory,
    color: CATEGORY_COLOR[state.defaultCategory],
  });
  selectBody(body);
  refreshTree();
  if (!event.shiftKey) {
    exitPlaceMode();
  } else {
    // Shift 连续放置：保留预览
  }
}

/* ============ 9. 场景树 ============ */
function refreshTree() {
  const tree = document.getElementById('tree');
  tree.innerHTML = '';
  if (!state.bodies.length) {
    tree.innerHTML = '<div style="color:#6a7180;padding:8px;font-size:12px">' + t('emptyScene') + '</div>';
    return;
  }
  state.bodies.forEach(body => {
    const ud = body.userData;
    const row = document.createElement('div');
    row.className = 'treeItem' + (state.selected === body ? ' sel' : '');
    const eye = document.createElement('span');
    eye.className = 'eye';
    eye.textContent = body.visible ? '●' : '○';
    eye.style.color = body.visible ? '#7fb0ff' : '#555';
    eye.title = body.visible ? '隐藏' : '显示';
    eye.addEventListener('click', ev => {
      ev.stopPropagation();
      body.visible = !body.visible;
      refreshTree();
    });
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = ud.name;
    const ty = document.createElement('span');
    ty.className = 'ty';
    ty.textContent = ud.type;
    row.appendChild(eye);
    row.appendChild(nm);
    row.appendChild(ty);
    row.addEventListener('click', () => selectBody(body));
    tree.appendChild(row);
  });
}

/* ============ 10. 参数面板 ============ */
function applyColorToBody(body, color) {
  body.traverse(c => {
    if (c.isMesh && c.userData.isBodyMesh && c.material) c.material.color = new THREE.Color(color);
  });
}

function updateParamPanel() {
  const emptyTip = document.getElementById('emptyTip');
  const paramBody = document.getElementById('paramBody');
  if (!state.selected) {
    emptyTip.style.display = 'block';
    paramBody.style.display = 'none';
    return;
  }
  emptyTip.style.display = 'none';
  paramBody.style.display = 'block';
  const ud = state.selected.userData;
  document.getElementById('pName').value = ud.name;
  document.getElementById('pType').textContent = ud.type === 'imported' ? t('importedType') : (BLOCK_TYPES[ud.type] ? BLOCK_TYPES[ud.type].label : ud.type);

  /* 分类下拉：预置分类 + 自定义 */
  const catSel = document.getElementById('pCategory');
  const prevCat = catSel.value;
  catSel.innerHTML = '';
  PALETTE.forEach(p => {
    const op = document.createElement('option');
    op.value = p.cat; op.textContent = t('cat_' + p.cat, p.cat);
    catSel.appendChild(op);
  });
  if (ud.category && !PALETTE.some(p => p.cat === ud.category)) {
    const op = document.createElement('option');
    op.value = ud.category; op.textContent = t('cat_' + ud.category, ud.category);
    catSel.appendChild(op);
  }
  catSel.value = ud.category || '地面';
  if (prevCat !== catSel.value) { /* 首次填充不触发 */ }

  document.getElementById('pColor').value = '#' + new THREE.Color(ud.color).getHexString();

  /* 尺寸参数行 */
  const wrap = document.getElementById('pParams');
  wrap.innerHTML = '';
  if (ud.type !== 'imported') {
    const tdef = BLOCK_TYPES[ud.type];
    if (tdef && tdef.params) {
      tdef.params.forEach(pd => {
        const row = document.createElement('div');
        row.className = 'row';
        const lab = document.createElement('label');
        lab.textContent = t('pl_' + pd.k, pd.l);
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.step = pd.step || 0.1;
        inp.min = pd.min !== undefined ? pd.min : 0.01;
        inp.value = ud.params[pd.k] !== undefined ? ud.params[pd.k] : pd.def;
        inp.addEventListener('change', () => {
          let v = parseFloat(inp.value);
          if (isNaN(v)) v = pd.def;
          if (pd.int) v = Math.round(v);
          v = Math.max(pd.min !== undefined ? pd.min : 0.01, v);
          ud.params[pd.k] = v;
          rebuildBodyGeometry(state.selected);
          restoreSelectionHighlight(state.selected);
          updateHandlesVisual();
          refreshTree();
          updateStatus();
        });
        row.appendChild(lab);
        row.appendChild(inp);
        wrap.appendChild(row);
      });
    }
  } else {
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = t('importedNoParam');
    wrap.appendChild(hint);
  }

  /* 变换 */
  document.getElementById('pX').value = round2(state.selected.position.x);
  document.getElementById('pY').value = round2(state.selected.position.y);
  document.getElementById('pZ').value = round2(state.selected.position.z);
  document.getElementById('pRotY').value = round2(THREE.MathUtils.radToDeg(state.selected.rotation.y));
}

function round2(v) { return Math.round(v * 100) / 100; }
function round1(v) { return Math.round(v * 10) / 10; }

function bindTransformInputs() {
  ['pX', 'pY', 'pZ'].forEach((id, i) => {
    document.getElementById(id).addEventListener('change', e => {
      if (!state.selected) return;
      const v = parseFloat(e.target.value);
      if (isNaN(v)) { updateParamPanel(); return; }
      if (i === 0) state.selected.position.x = v;
      if (i === 1) state.selected.position.y = v;
      if (i === 2) state.selected.position.z = v;
      updateHandlesVisual();
      refreshTree();
      updateStatus();
    });
  });
  document.getElementById('pRotY').addEventListener('change', e => {
    if (!state.selected) return;
    const v = parseFloat(e.target.value);
    if (isNaN(v)) { updateParamPanel(); return; }
    state.selected.rotation.y = THREE.MathUtils.degToRad(v);
    updateHandlesVisual();
    refreshTree();
  });
  document.getElementById('pName').addEventListener('change', e => {
    if (!state.selected) return;
    state.selected.userData.name = e.target.value || '未命名';
    refreshTree();
  });
  document.getElementById('pCategory').addEventListener('change', e => {
    if (!state.selected) return;
    const cat = e.target.value;
    state.selected.userData.category = cat;
    if (CATEGORY_COLOR[cat] !== undefined) {
      state.selected.userData.color = CATEGORY_COLOR[cat];
      applyColorToBody(state.selected, CATEGORY_COLOR[cat]);
      document.getElementById('pColor').value = '#' + new THREE.Color(CATEGORY_COLOR[cat]).getHexString();
    }
    updatePaletteUI();
    refreshTree();
  });
  document.getElementById('pColor').addEventListener('change', e => {
    if (!state.selected) return;
    const c = parseInt(e.target.value.slice(1), 16);
    state.selected.userData.color = c;
    state.selected.userData.category = CUSTOM_CAT;
    applyColorToBody(state.selected, c);
    updatePaletteUI();
    refreshTree();
  });
}

/* ============ 11. 视图控制 ============ */
function rebuildControls() {
  controls.dispose();
  controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.update();
}

function toggleView() {
  const pos = camera.position.clone();
  const tgt = controls.target.clone();
  if (camera.isOrthographicCamera) {
    camera = new THREE.PerspectiveCamera(55, 1, 0.01, 2000);
    state.isOrtho = false;
  } else {
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 2000);
    state.isOrtho = true;
  }
  camera.position.copy(pos);
  rebuildControls();
  controls.target.copy(tgt);
  resize();
  updateViewUI();
}

function setViewOrtho() {
  if (!camera.isOrthographicCamera) toggleView();
}

function setViewTop() {
  setViewOrtho();
  camera.position.set(0, state.cameraDistance, 0.01);
  camera.up.set(0, 0, -1);
  controls.target.set(0, 0, 0);
  controls.update();
  resize();
}
function setViewFront() {
  setViewOrtho();
  camera.position.set(0, 2, state.cameraDistance);
  camera.up.set(0, 1, 0);
  controls.target.set(0, 1, 0);
  controls.update();
  resize();
}
function setViewRight() {
  setViewOrtho();
  camera.position.set(state.cameraDistance, 2, 0);
  camera.up.set(0, 1, 0);
  controls.target.set(0, 1, 0);
  controls.update();
  resize();
}

function updateViewUI() {
  const b = document.getElementById('btnViewPersp');
  if (b) b.textContent = camera.isOrthographicCamera ? t('ortho', '正交') : t('persp', '透视');
}

function toggleGrid() {
  state.gridVisible = !state.gridVisible;
  grid.visible = state.gridVisible;
  document.getElementById('btnGrid').textContent = state.gridVisible ? '网格' : '隐藏网格';
  const gh = document.getElementById('gridHelperWrap');
  if (gh) gh.style.display = state.gridVisible ? '' : 'none';
}

function toggleWire() {
  state.wireVisible = !state.wireVisible;
  state.bodies.forEach(b => {
    b.traverse(c => {
      if (c.isMesh && c.userData.isBodyMesh && c.material) c.material.wireframe = state.wireVisible;
    });
  });
  document.getElementById('btnWire').textContent = state.wireVisible ? '实体' : '线框';
}

/* ============ 12. 快捷键 ============ */
function handleKey(e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === 'c' && state.selected) {
      state.clipboard = state.selected;
      updateStatus(t('copied'));
    }
    if (e.key.toLowerCase() === 'v' && state.clipboard) {
      duplicateBody(state.clipboard);
    }
    return;
  }
  const k = e.key.toLowerCase();
  if (state.playerMode && (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === ' ')) return;
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); if (state.selected) removeBody(state.selected); return; }
  if (k === 'q') { exitPlaceMode(); return; }
  if (k === 'p') { toggleView(); return; }
  if (k === 't') { setViewTop(); return; }
  if (k === 'f') { setViewFront(); return; }
  if (k === 'y') { setViewRight(); return; }
  if (k === 'g') { toggleGrid(); return; }
  if (k === 'w') { toggleWire(); return; }
  const numMap = { '1': 'cube', '2': 'sphere', '3': 'cylinder', '4': 'cone', '5': 'capsule', '6': 'plane', '7': 'ramp', '8': 'wedge', '9': 'stair', '0': 'corner' };
  if (numMap[k]) { enterPlaceMode(numMap[k]); return; }
  if (k === 'a') { enterPlaceMode('arch'); return; }
  if (k === 'i') { enterPlaceMode('pipe'); return; }
}

/* ============ 13. 存档（JSON / GLB / OBJ 导出，GLB / OBJ 导入） ============ */
function cloneBodyData(body) {
  const ud = body.userData;
  return {
    type: ud.type,
    name: ud.name,
    category: ud.category,
    color: ud.color,
    params: Object.assign({}, ud.params),
    x: body.position.x, y: body.position.y, z: body.position.z,
    ry: body.rotation.y,
    visible: body.visible,
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

function exportJSON() {
  const data = state.bodies.map(cloneBodyData);
  const blob = new Blob([JSON.stringify({ version: 1, bodies: data }, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'blockout_scene.json');
}

function loadJSONFile(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      const arr = Array.isArray(parsed) ? parsed : (parsed.bodies || []);
      clearAllBodies();
      let skipped = 0;
      arr.forEach(d => {
        if (d.type === 'imported' || !BLOCK_TYPES[d.type]) { skipped++; return; }
        createBody(d);
      });
      refreshTree();
      updateStatus(t('loaded', arr.length - skipped, skipped));
    } catch (err) {
      alert(t('jsonFail', err.message));
    }
  };
  reader.readAsText(file);
}

function clearAllBodies() {
  while (state.bodies.length) removeBody(state.bodies[0]);
  clearSelection();
  refreshTree();
}

function exportGLB() {
  if (!state.bodies.length) { alert(t('alertEmpty')); return; }
  const exporter = new THREE.GLTFExporter();
  const group = new THREE.Group();
  state.bodies.forEach(b => {
    const c = b.clone(true);
    group.add(c);
  });
  exporter.parse(group, gltf => {
    const arr = gltf instanceof ArrayBuffer ? gltf : gltf.buffer;
    downloadBlob(new Blob([arr], { type: 'model/gltf-binary' }), 'blockout_scene.glb');
  }, err => { alert(t('glbFail', err.message)); }, { binary: true });
}

function exportOBJ() {
  if (!state.bodies.length) { alert(t('alertEmpty')); return; }
  const lines = ['# Blockout Tools OBJ Export'];
  let voff = 1;
  state.bodies.forEach(b => {
    b.updateMatrixWorld(true);
    b.traverse(c => {
      if (!c.isMesh || !c.geometry) return;
      const geo = c.geometry;
      const posAttr = geo.attributes.position;
      if (!posAttr) return;
      const src = geo.index ? geo.toNonIndexed() : geo;
      const pos = src.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        v.applyMatrix4(c.matrixWorld);
        lines.push('v ' + v.x.toFixed(4) + ' ' + v.y.toFixed(4) + ' ' + v.z.toFixed(4));
      }
      for (let i = 0; i < pos.count; i += 3) {
        lines.push('f ' + (voff + i) + ' ' + (voff + i + 1) + ' ' + (voff + i + 2));
      }
      voff += pos.count;
    });
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  downloadBlob(blob, 'blockout_scene.obj');
}

/* 导入 GLB / OBJ：作为"外部模型" body 加入场景（不参与参数化） */
function importFile(file) {
  const name = file.name;
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'glb' || ext === 'gltf') {
    const reader = new FileReader();
    reader.onload = ev => {
      const loader = new THREE.GLTFLoader();
      loader.parse(ev.target.result, '', gltf => {
        addImportedModel(gltf.scene, name);
      }, err => { alert('GLB 解析失败: ' + err.message); });
    };
    reader.readAsArrayBuffer(file);
  } else if (ext === 'obj') {
    const reader = new FileReader();
    reader.onload = ev => {
      const geo = parseOBJ(ev.target.result);
      const mesh = new THREE.Mesh(geo, bodyMaterial(0x9b9fb0));
      addImportedModel(mesh, name);
    };
    reader.readAsText(file);
  } else {
    alert('不支持的格式: ' + ext);
  }
}

function parseOBJ(text) {
  const v = [];
  const f = [];
  text.split(/\r?\n/).forEach(line => {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'v' && t.length >= 4) v.push(parseFloat(t[1]), parseFloat(t[2]), parseFloat(t[3]));
    else if (t[0] === 'f' && t.length >= 4) {
      const idx = t.slice(1).map(s => parseInt(s.split('/')[0], 10) - 1);
      for (let i = 1; i < idx.length - 1; i++) f.push(idx[0], idx[i], idx[i + 1]);
    }
  });
  const pos = new Float32Array(f.length * 3);
  f.forEach((vi, i) => { pos[i * 3] = v[vi * 3]; pos[i * 3 + 1] = v[vi * 3 + 1]; pos[i * 3 + 2] = v[vi * 3 + 2]; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function addImportedModel(obj, name) {
  const group = new THREE.Group();
  group.userData = {
    id: state.idSeq++,
    type: 'imported',
    name: name || ('外部模型_' + state.idSeq),
    category: CUSTOM_CAT,
    color: 0x9b9fb0,
    params: {},
    movable: true,
    isBody: true,
  };
  obj.traverse(c => {
    if (c.isMesh) {
      c.material = bodyMaterial(0x9b9fb0);
      c.userData.isBodyMesh = true;
      const eg = new THREE.EdgesGeometry(c.geometry, 22);
      const edge = new THREE.LineSegments(eg, edgeMaterial());
      edge.userData.isEdge = true;
      if (c.parent) c.parent.add(edge);
    }
  });
  group.add(obj);
  scene.add(group);
  state.bodies.push(group);
  selectBody(group);
  refreshTree();
}

/* getBodySize 覆盖：外部模型用包围盒 */
function getBodySizeOverride(type, params, body) {
  if (type === 'imported' && body) {
    const box = new THREE.Box3().setFromObject(body);
    const s = box.getSize(new THREE.Vector3());
    return { x: s.x, y: s.y, z: s.z };
  }
  return getBodySize(type, params);
}

/* ============ 14. UI 绑定与状态栏 ============ */
function setModeUI(mode) {
  const btn = document.getElementById('btnSelect');
  if (btn) btn.classList.toggle('act', mode === 'select');
  document.querySelectorAll('.blockBtn').forEach(b => b.classList.toggle('active', mode === 'place' && b.dataset.type === state.placeType));
  const sbMode = document.getElementById('sbMode');
  if (sbMode) sbMode.textContent = mode === 'place' ? t('modePlace', BLOCK_TYPES[state.placeType] ? BLOCK_TYPES[state.placeType].label : state.placeType) : t('modeSelect');
}

function updateStatus(msg) {
  const hint = document.getElementById('sbHint');
  if (hint) hint.textContent = msg || (state.mode === 'place' ? t('statusPlace') : (state.selected ? t('statusSelected', state.selected.userData.name, state.bodies.length) : t('statusCount', state.bodies.length)));
}

function updateCursorInfo(event) {
  const sb = document.getElementById('sbCursor');
  if (!sb) return;
  const ray = pointerRay(event);
  const hit = new THREE.Vector3();
  if (ray.intersectPlane(groundPlane, hit)) {
    sb.textContent = 'X ' + round2(hit.x) + '  Y ' + round2(hit.y) + '  Z ' + round2(hit.z);
  }
}

/* 体块库按钮 */
function buildBlockGrid() {
  const gridEl = document.getElementById('blockGrid');
  gridEl.innerHTML = '';
  BLOCK_ORDER.forEach(type => {
    const bt = BLOCK_TYPES[type];
    const btn = document.createElement('div');
    btn.className = 'blockBtn';
    btn.dataset.type = type;
    const ic = document.createElement('span');
    ic.className = 'ic';
    ic.textContent = bt.ic;
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = t('bt_' + type, bt.label);
    btn.appendChild(ic);
    btn.appendChild(nm);
    btn.addEventListener('click', () => {
      if (state.mode === 'place' && state.placeType === type) {
        exitPlaceMode();
      } else {
        enterPlaceMode(type);
      }
    });
    gridEl.appendChild(btn);
  });
}

/* 调色板 */
function updatePaletteUI() {
  document.querySelectorAll('.palBtn').forEach(b => {
    b.classList.toggle('active', state.selected && (b.dataset.cat === state.selected.userData.category));
  });
}
function buildPalette() {
  const gridEl = document.getElementById('paletteGrid');
  gridEl.innerHTML = '';
  PALETTE.forEach(p => {
    const btn = document.createElement('div');
    btn.className = 'palBtn';
    btn.dataset.cat = p.cat;
    const sw = document.createElement('span');
    sw.className = 'sw';
    sw.style.background = '#' + new THREE.Color(p.color).getHexString();
    const nm = document.createElement('span');
    nm.textContent = p.cat;
    btn.appendChild(sw);
    btn.appendChild(nm);
    btn.addEventListener('click', () => {
      if (!state.selected) { alert(t('selFirst')); return; }
      state.selected.userData.category = p.cat;
      state.selected.userData.color = p.color;
      applyColorToBody(state.selected, p.color);
      updateParamPanel();
      updatePaletteUI();
      refreshTree();
    });
    gridEl.appendChild(btn);
  });
  document.getElementById('applyCustom').addEventListener('click', () => {
    if (!state.selected) { alert(t('selFirst')); return; }
    const c = parseInt(document.getElementById('customColor').value.slice(1), 16);
    state.selected.userData.color = c;
    state.selected.userData.category = CUSTOM_CAT;
    applyColorToBody(state.selected, c);
    updateParamPanel();
    updatePaletteUI();
    refreshTree();
  });
}

/* 复制粘贴 / 树按钮 */
function duplicateBody(body) {
  if (!body) return;
  const d = cloneBodyData(body);
  if (d.type === 'imported') {
    const clone = new THREE.Group();
    body.traverse(c => {
      if (c.isMesh) {
        const m = c.clone();
        m.userData.isBodyMesh = true;
        m.material = c.material.clone();
        clone.add(m);
      }
    });
    clone.userData = Object.assign({}, body.userData, { id: state.idSeq++, name: body.userData.name + '_copy' });
    clone.position.set(body.position.x + 0.5, body.position.y, body.position.z + 0.5);
    clone.rotation.copy(body.rotation);
    scene.add(clone);
    state.bodies.push(clone);
    selectBody(clone);
    refreshTree();
    return;
  }
  const nb = createBody({ type: d.type, x: d.x + 0.5, y: d.y, z: d.z + 0.5, name: d.name, category: d.category, color: d.color, params: d.params, ry: d.ry, visible: d.visible });
  selectBody(nb);
  refreshTree();
}

/* 指针事件 */
function findHandleAxis(obj) {
  while (obj) {
    if (obj.userData && obj.userData.handleAxis) return obj.userData.handleAxis;
    obj = obj.parent;
  }
  return null;
}

function onPointerDown(e) {
  if (state.playerMode) {
    lookDragging = true;
    lookStart = { x: e.clientX, y: e.clientY };
    return;
  }
  if (e.button !== 0) return;
  if (state.mode === 'place') {
    placeBlock(e);
    return;
  }
  /* 控制柄优先 */
  if (state.handles && state.selected) {
    const hg = state.handles;
    const hits = state.raycaster.intersectObjects(hg.children, true);
    if (hits.length) {
      const axis = findHandleAxis(hits[0].object);
      if (axis) { startHandleDrag(axis, e); return; }
    }
  }
  /* 体块拾取 */
  const targets = [];
  state.bodies.forEach(b => b.traverse(c => { if (c.isMesh && !c.userData.isEdge) targets.push(c); }));
  if (!targets.length) { clearSelection(); return; }
  const hits = state.raycaster.intersectObjects(targets, false);
  if (hits.length) {
    let obj = hits[0].object;
    while (obj) {
      if (obj.userData && obj.userData.isBody) { selectBody(obj); break; }
      obj = obj.parent;
    }
  } else {
    clearSelection();
  }
}

function onPointerMove(e) {
  if (state.playerMode) {
    if (lookDragging && lookStart && player) {
      player.yaw -= (e.clientX - lookStart.x) * 0.005;
      player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - (e.clientY - lookStart.y) * 0.005));
      lookStart = { x: e.clientX, y: e.clientY };
    }
    return;
  }
  updateCursorInfo(e);
  if (state.drag) { updateHandleDrag(e); return; }
  if (state.mode === 'place' && state.previewBody) {
    const pt = computePlacePoint(e);
    if (pt) {
      state.previewBody.position.set(pt.x, pt.y, pt.z);
      updateStatus();
    }
  }
}

function onPointerUp() {
  lookDragging = false;
  endHandleDrag();
}

/* 初始化 */
function init() {
  buildBlockGrid();
  buildPalette();
  bindTransformInputs();
  refreshTree();
  updateParamPanel();
  updateViewUI();
  updateStatus();

  /* 工具栏 */
  document.getElementById('btnSelect').addEventListener('click', () => exitPlaceMode());
  document.getElementById('btnDelete').addEventListener('click', () => { if (state.selected) removeBody(state.selected); });
  document.getElementById('btnDuplicate').addEventListener('click', () => duplicateBody(state.selected));
  document.getElementById('btnPaste').addEventListener('click', () => {
    if (state.clipboard) duplicateBody(state.clipboard);
  });
  document.getElementById('btnViewPersp').addEventListener('click', toggleView);
  document.getElementById('btnTop').addEventListener('click', setViewTop);
  document.getElementById('btnFront').addEventListener('click', setViewFront);
  document.getElementById('btnRight').addEventListener('click', setViewRight);
  document.getElementById('btnGrid').addEventListener('click', toggleGrid);
  document.getElementById('btnWire').addEventListener('click', toggleWire);
  document.getElementById('chkGround').addEventListener('change', e => { state.groundSnap = e.target.checked; });
  document.getElementById('gridSize').addEventListener('change', e => {
    const v = parseFloat(e.target.value);
    if (isNaN(v) || v <= 0) { e.target.value = state.gridSize; return; }
    state.gridSize = v;
    grid.scale.set(v, 1, v);
  });
  document.getElementById('btnSaveJson').addEventListener('click', exportJSON);
  document.getElementById('btnOpenFile').addEventListener('click', () => document.getElementById('fileOpenJson').click());
  const fileOpenJson = document.createElement('input');
  fileOpenJson.type = 'file';
  fileOpenJson.accept = '.json';
  fileOpenJson.style.display = 'none';
  document.body.appendChild(fileOpenJson);
  fileOpenJson.addEventListener('change', e => { if (e.target.files[0]) loadJSONFile(e.target.files[0]); e.target.value = ''; });
  document.getElementById('btnExportGLB').addEventListener('click', exportGLB);
  document.getElementById('btnExportOBJ').addEventListener('click', exportOBJ);
  document.getElementById('fileImport').addEventListener('change', e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; });

  /* 树按钮 */
  document.getElementById('btnTreeSelect').addEventListener('click', () => { if (state.selected) selectBody(state.selected); });
  document.getElementById('btnTreeCopy').addEventListener('click', () => { if (state.selected) state.clipboard = state.selected; });
  document.getElementById('btnTreeDelete').addEventListener('click', () => { if (state.selected) removeBody(state.selected); });

  /* 参数操作按钮 */
  document.getElementById('btnParamDelete').addEventListener('click', () => { if (state.selected) removeBody(state.selected); });
  document.getElementById('btnParamDuplicate').addEventListener('click', () => duplicateBody(state.selected));
  document.getElementById('btnParamReset').addEventListener('click', () => {
    if (!state.selected || state.selected.userData.type === 'imported') return;
    state.selected.userData.params = defaultParams(state.selected.userData.type);
    rebuildBodyGeometry(state.selected);
    restoreSelectionHighlight(state.selected);
    updateHandlesVisual();
    updateParamPanel();
    refreshTree();
  });

  /* 标签页 */
  document.querySelectorAll('#left .tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#left .tabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#left .tab-page').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  /* 指针事件 */
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', handleKey);

  bindExtraUI();
}

/* ============ 15. 多语言（中 / EN） ============ */
var clock = new THREE.Clock();

const I18N = {
  appTitle: { zh: '⛏ Blockout Tools', en: '⛏ Blockout Tools' },
  select: { zh: '选择', en: 'Select' },
  delete: { zh: '删除', en: 'Delete' },
  duplicate: { zh: '复制', en: 'Duplicate' },
  paste: { zh: '粘贴', en: 'Paste' },
  persp: { zh: '透视', en: 'Persp' },
  ortho: { zh: '正交', en: 'Ortho' },
  top: { zh: '顶', en: 'Top' },
  front: { zh: '前', en: 'Front' },
  right: { zh: '右', en: 'Right' },
  grid: { zh: '网格', en: 'Grid' },
  wire: { zh: '线框', en: 'Wire' },
  ground: { zh: '贴地', en: 'Snap' },
  gridSize: { zh: '网格尺寸', en: 'Grid Size' },
  tps: { zh: 'TPS 角色', en: 'TPS' },
  fps: { zh: 'FPS 角色', en: 'FPS' },
  save: { zh: '保存', en: 'Save' },
  open: { zh: '打开', en: 'Open' },
  restoreAuto: { zh: '恢复自动保存', en: 'Restore Auto' },
  autoSave: { zh: '自动保存', en: 'AutoSave' },
  exportGLB: { zh: '导出GLB', en: 'GLB' },
  exportOBJ: { zh: '导出OBJ', en: 'OBJ' },
  exportFBX: { zh: '导出FBX', en: 'FBX' },
  import: { zh: '导入GLB/OBJ', en: 'Import' },
  blocksTab: { zh: '体块库', en: 'Blocks' },
  treeTab: { zh: '场景树', en: 'Scene' },
  blockTitle: { zh: '体块类型（点击后到场景点击放置）', en: 'Block types (click, then click in viewport to place)' },
  paletteTitle: { zh: '白盒分色板（点击应用选中体块）', en: 'Palette (click to apply to selected)' },
  custom: { zh: '应用自定义色', en: 'Apply Custom' },
  treeSelect: { zh: '选择', en: 'Select' },
  treeCopy: { zh: '复制', en: 'Copy' },
  treeDelete: { zh: '删除', en: 'Delete' },
  emptyTip: { zh: '未选中体块\n请在体块库点选类型后\n到场景中点击放置', en: 'No selection\nPick a block type from the library\nThen click in the viewport to place' },
  secInfo: { zh: '体块信息', en: 'Block Info' },
  name: { zh: '名称', en: 'Name' },
  type: { zh: '类型', en: 'Type' },
  category: { zh: '分类', en: 'Category' },
  color: { zh: '颜色', en: 'Color' },
  secParams: { zh: '尺寸参数', en: 'Size Params' },
  secTrans: { zh: '变换', en: 'Transform' },
  rotY: { zh: '旋转Y', en: 'Rot Y' },
  transHint: { zh: '位置/旋转修改后按 Enter 应用，或失焦自动应用', en: 'Press Enter or blur to apply position/rotation' },
  secOps: { zh: '操作', en: 'Actions' },
  opDelete: { zh: '删除', en: 'Delete' },
  opDuplicate: { zh: '复制', en: 'Duplicate' },
  opReset: { zh: '重置', en: 'Reset' },
  sbModeSelect: { zh: '选择', en: 'Select' },
  /* 状态与提示 */
  emptyScene: { zh: '场景为空，去体块库放置吧', en: 'Scene is empty, add blocks from the library' },
  importedType: { zh: '外部模型', en: 'Imported' },
  importedNoParam: { zh: '外部模型无参数化几何', en: 'Imported model has no parametric geometry' },
  modeHint: { zh: '按住鼠标中键或 Shift+左键拖动旋转，右键平移', en: 'Middle-drag or Shift+drag to orbit, right-drag to pan' },
  modePlace: { zh: '放置 {0}', en: 'Place {0}' },
  modeSelect: { zh: '选择', en: 'Select' },
  statusPlace: { zh: '点击场景放置，Shift 连续放置，右键取消', en: 'Click to place, Shift for multiple, right-click to cancel' },
  statusSelected: { zh: '选中: {0}（{1} 个体块）', en: 'Selected: {0} ({1} blocks)' },
  statusCount: { zh: '共 {0} 个体块', en: '{0} blocks in total' },
  copied: { zh: '已复制', en: 'Copied' },
  loaded: { zh: '已加载 {0} 个体块{1}', en: 'Loaded {0} blocks{1}' },
  jsonFail: { zh: 'JSON 解析失败: {0}', en: 'JSON parse failed: {0}' },
  alertEmpty: { zh: '场景为空', en: 'Scene is empty' },
  glbFail: { zh: 'GLB 导出失败: {0}', en: 'GLB export failed: {0}' },
  fbxFail: { zh: 'FBX 导出失败: {0}', en: 'FBX export failed: {0}' },
  selFirst: { zh: '请先选中一个体块', en: 'Select a block first' },
  roleOn: { zh: '{0} 跑图模式：WASD 移动 · 鼠标拖拽转向 · Shift 跑 · 空格跳 · 再次点击角色按钮退出', en: '{0} mode: WASD move · Drag to look · Shift run · Space jump · Click role button to exit' },
  roleHint: { zh: 'WASD 移动 · 鼠标拖拽转向 · Shift 跑 · 空格跳 · 再次点击角色按钮退出', en: 'WASD move · Drag to look · Shift run · Space jump · Click role button to exit' },
  autoSaveOn: { zh: '自动保存开', en: 'AutoSave On' },
  autoSaveOff: { zh: '自动保存关', en: 'AutoSave Off' },
  autoSaved: { zh: '已自动保存', en: 'Auto-saved' },
  savedLocal: { zh: '已保存到本地', en: 'Saved locally' },
  noAutoSave: { zh: '无自动保存记录', en: 'No auto-save found' },
  restoreDone: { zh: '已恢复自动保存场景', en: 'Auto-save scene restored' },
  /* 体块名称（对齐 BLOCK_ORDER） */
  bt_cube: { zh: '立方体', en: 'Cube' },
  bt_sphere: { zh: '球体', en: 'Sphere' },
  bt_cylinder: { zh: '圆柱', en: 'Cylinder' },
  bt_cone: { zh: '圆锥', en: 'Cone' },
  bt_capsule: { zh: '胶囊', en: 'Capsule' },
  bt_plane: { zh: '平面', en: 'Plane' },
  bt_ramp: { zh: '斜坡', en: 'Ramp' },
  bt_wedge: { zh: '楔体', en: 'Wedge' },
  bt_stair: { zh: '台阶', en: 'Stair' },
  bt_corner: { zh: '角块', en: 'Corner' },
  bt_arch: { zh: '拱门', en: 'Arch' },
  bt_pipe: { zh: '管道', en: 'Pipe' },
  /* 参数标签 */
  pl_w: { zh: '宽', en: 'Width' },
  pl_h: { zh: '高', en: 'Height' },
  pl_d: { zh: '深', en: 'Depth' },
  pl_r: { zh: '半径', en: 'Radius' },
  pl_sw: { zh: '纬分段', en: 'Lat Segs' },
  pl_sh: { zh: '经分段', en: 'Long Segs' },
  pl_seg: { zh: '分段', en: 'Segs' },
  pl_len: { zh: '柱长', en: 'Cyl Len' },
  pl_t: { zh: '厚', en: 'Thickness' },
  /* 分色板分类 */
  cat_地面: { zh: '地面', en: 'Ground' },
  cat_墙体: { zh: '墙体', en: 'Wall' },
  cat_障碍: { zh: '障碍', en: 'Obstacle' },
  cat_可交互: { zh: '可交互', en: 'Interactive' },
  cat_装饰: { zh: '装饰', en: 'Decor' },
  cat_危险: { zh: '危险', en: 'Danger' },
  cat_遮挡: { zh: '遮挡', en: 'Blocker' },
  cat_自定义: { zh: '自定义', en: 'Custom' },
};

let lang = 'zh';
try { lang = localStorage.getItem('blockout_lang') || 'zh'; } catch (e) {}

function t(key, ...args) {
  const entry = I18N[key] || { zh: key, en: key };
  let s = entry[lang] !== undefined ? entry[lang] : entry.zh;
  args.forEach((a, i) => { s = s.split('{' + i + '}').join(a !== undefined ? a : ''); });
  return s;
}

function setLang(next) {
  lang = next;
  try { localStorage.setItem('blockout_lang', lang); } catch (e) {}
  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (el.id === 'emptyTip') {
      el.innerHTML = t(el.dataset.i18n).replace(/\n/g, '<br>');
    } else {
      el.textContent = t(el.dataset.i18n);
    }
  });
  document.querySelectorAll('.blockBtn').forEach(b => {
    const nm = b.querySelector('.nm');
    if (nm && b.dataset.type) nm.textContent = t('bt_' + b.dataset.type);
  });
  document.querySelectorAll('.palBtn').forEach(b => {
    const nm = b.querySelector('span:last-child');
    if (nm && b.dataset.cat) nm.textContent = t('cat_' + b.dataset.cat, b.dataset.cat);
  });
  if (state.selected) updateParamPanel();
  refreshTree();
  updateViewUI();
  if (state.mode) setModeUI(state.mode);
  updateStatus();
  updateRoleHint();
}

/* ============ 16. 角色控制器（TPS / FPS 跑图） ============ */
var lookDragging = false;
var lookStart = null;
var player = null;
var playerKeys = {};
var _box = new THREE.Box3();

function updateRoleHint() {
  const el = document.getElementById('roleHint');
  if (!el) return;
  if (state.playerMode) {
    el.style.display = 'block';
    el.textContent = t('roleHint') + '  [' + (state.playerMode === 'tps' ? 'TPS' : 'FPS') + ']';
  } else {
    el.style.display = 'none';
  }
}

function enterRole(mode) {
  if (state.playerMode === mode) { exitRole(); return; }
  state.playerMode = mode;
  if (state.mode === 'place') exitPlaceMode();
  if (state.selected) clearSelection();
  state.handles = null;
  player = {
    yaw: camera.rotation.y,
    pitch: 0,
    eye: mode === 'fps' ? 1.65 : 2.8,
    jumpV: 0,
    onGround: true,
    radius: 0.35,
    height: 1.7,
  };
  player.pos = camera.position.clone();
  player.pos.y = Math.max(player.pos.y, 0);
  document.body.style.cursor = 'crosshair';
  document.getElementById('btnTps').classList.toggle('act', mode === 'tps');
  document.getElementById('btnFps').classList.toggle('act', mode === 'fps');
  updateRoleHint();
  updateStatus(t('roleOn', mode.toUpperCase()));
}

function exitRole() {
  state.playerMode = null;
  player = null;
  document.body.style.cursor = '';
  document.getElementById('btnTps').classList.remove('act');
  document.getElementById('btnFps').classList.remove('act');
  updateRoleHint();
  updateStatus();
}

function bodyBox(body, out) {
  out.min.set(Infinity, Infinity, Infinity);
  out.max.set(-Infinity, -Infinity, -Infinity);
  let found = false;
  const tmpBox = new THREE.Box3();
  body.updateWorldMatrix(true, true);
  body.traverse(c => {
    if (!c.isMesh || !c.geometry) return;
    tmpBox.setFromObject(c);
    out.min.min(tmpBox.min);
    out.max.max(tmpBox.max);
    found = true;
  });
  return found ? out : null;
}

function roleCollides(x, z, y) {
  if (!player) return false;
  const cy = y + player.height * 0.5;
  const halfH = player.height * 0.5;
  const r = player.radius;
  for (let i = 0; i < state.bodies.length; i++) {
    const b = state.bodies[i];
    if (!b.visible || !b.userData.isBody) continue;
    const bb = bodyBox(b, _box);
    if (!bb) continue;
    const cx = Math.max(bb.min.x, Math.min(x, bb.max.x));
    const cz = Math.max(bb.min.z, Math.min(z, bb.max.z));
    const cyy = Math.max(bb.min.y, Math.min(cy, bb.max.y));
    const dx = x - cx, dz = z - cz, dy = cy - cyy;
    if (dx * dx + dz * dz < r * r && Math.abs(dy) < halfH) return true;
  }
  return false;
}

function updateRole(dt) {
  if (!player) return;
  if (dt > 0.1) dt = 0.1;
  const speed = playerKeys['shift'] ? 8 : 3.5;
  let fwd = 0, strafe = 0;
  if (playerKeys['w']) fwd += 1;
  if (playerKeys['s']) fwd -= 1;
  if (playerKeys['a']) strafe -= 1;
  if (playerKeys['d']) strafe += 1;
  const sinY = Math.sin(player.yaw), cosY = Math.cos(player.yaw);
  let mx = 0, mz = 0;
  if (fwd !== 0 || strafe !== 0) {
    mx = (-sinY * fwd + cosY * strafe) * speed * dt;
    mz = (-cosY * fwd - sinY * strafe) * speed * dt;
    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > speed * dt) { mx = mx / len * speed * dt; mz = mz / len * speed * dt; }
  }
  if (playerKeys[' '] && player.onGround) { player.jumpV = 5; player.onGround = false; }
  let y = player.pos.y;
  if (!player.onGround) {
    player.jumpV -= 20 * dt;
    y += player.jumpV * dt;
    if (y <= 0) { y = 0; player.jumpV = 0; player.onGround = true; }
  }
  let nx = player.pos.x + mx;
  if (!roleCollides(nx, player.pos.z, y)) player.pos.x = nx;
  let nz = player.pos.z + mz;
  if (!roleCollides(player.pos.x, nz, y)) player.pos.z = nz;
  player.pos.y = y;

  if (state.playerMode === 'fps') {
    camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(player.pitch, player.yaw, 0);
  } else {
    const dist = 4.2;
    camera.position.set(player.pos.x + sinY * dist, player.pos.y + player.eye, player.pos.z + cosY * dist);
    camera.lookAt(player.pos.x, player.pos.y + 1.4, player.pos.z);
  }
}

/* ============ 17. FBX 导出 ============ */
function exportFBX() {
  if (!state.bodies.length) { alert(t('alertEmpty')); return; }
  if (typeof FBXExporter === 'undefined') { alert('FBXExporter 未加载'); return; }
  const group = new THREE.Group();
  state.bodies.forEach(b => group.add(b.clone(true)));
  const exporter = new FBXExporter();
  exporter.parse(group).then(blob => {
    downloadBlob(blob, 'blockout_scene.fbx');
  }).catch(err => {
    alert(t('fbxFail', (err && err.message) || err));
  });
}

/* ============ 18. 本地文件（打开 / 保存 / 自动保存） ============ */
const AUTO_KEY = 'blockout_autosave';
let autoSaveTimer = null;
let autoSaveOn = false;
try { autoSaveOn = localStorage.getItem('blockout_autosave_on') === '1'; } catch (e) {}

function autoSaveNow() {
  if (!autoSaveOn) return;
  try {
    localStorage.setItem(AUTO_KEY, JSON.stringify({ version: 1, bodies: state.bodies.map(cloneBodyData), savedAt: Date.now() }));
    const el = document.getElementById('sbAuto');
    if (el) el.textContent = t('autoSaved');
  } catch (e) {}
}

function loadAutoSave() {
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    if (!raw) { alert(t('noAutoSave')); return; }
    const parsed = JSON.parse(raw);
    const arr = parsed.bodies || [];
    clearAllBodies();
    arr.forEach(d => { if (d.type === 'imported' || !BLOCK_TYPES[d.type]) return; createBody(d); });
    refreshTree();
    updateStatus(t('restoreDone'));
  } catch (e) {
    alert(t('jsonFail', e.message));
  }
}

function bindExtraUI() {
  const langSel = document.getElementById('langSel');
  if (langSel) {
    langSel.value = lang;
    langSel.addEventListener('change', e => setLang(e.target.value));
  }

  document.getElementById('btnTps').addEventListener('click', () => enterRole('tps'));
  document.getElementById('btnFps').addEventListener('click', () => enterRole('fps'));
  document.getElementById('btnExportFBX').addEventListener('click', exportFBX);

  const btnAuto = document.getElementById('btnAutoSave');
  if (btnAuto) {
    btnAuto.addEventListener('click', () => {
      autoSaveOn = !autoSaveOn;
      try { localStorage.setItem('blockout_autosave_on', autoSaveOn ? '1' : '0'); } catch (e) {}
      btnAuto.classList.toggle('act', autoSaveOn);
      btnAuto.textContent = t(autoSaveOn ? 'autoSaveOn' : 'autoSaveOff');
      if (autoSaveOn) { autoSaveNow(); if (!autoSaveTimer) autoSaveTimer = setInterval(autoSaveNow, 60000); }
      else if (autoSaveTimer) { clearInterval(autoSaveTimer); autoSaveTimer = null; }
    });
    btnAuto.classList.toggle('act', autoSaveOn);
    btnAuto.textContent = t(autoSaveOn ? 'autoSaveOn' : 'autoSaveOff');
    if (autoSaveOn && !autoSaveTimer) autoSaveTimer = setInterval(autoSaveNow, 60000);
  }
  document.getElementById('btnRestoreAuto').addEventListener('click', loadAutoSave);

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (state.playerMode && (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === ' ' || k === 'shift')) {
      playerKeys[k] = true;
      if (k === ' ') e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => {
    playerKeys[e.key.toLowerCase()] = false;
  });

  try {
    if (localStorage.getItem(AUTO_KEY)) document.getElementById('btnRestoreAuto').style.display = '';
  } catch (e) {}

  setLang(lang);
}

init();

