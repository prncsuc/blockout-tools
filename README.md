---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 5227bc309b64902b9bfd2bb79d4de347_05ad363ac7d411f1944f525400248c00
    ReservedCode1: PKfwiBPeIC8e99W0YQWb0LnrofnzKFEhZfXWlpI2XScr5sgCH466R2zUxDBWBkvp6TNEpxk8145nFyRJ5BxX/dKxTqPPToCE4K3QPZDi/5f2m9vXNQE4lwAFa0dWfR+A6A+np8eOGqF6lKpvRWQhdP5gLSKznC6t+sHjONGTbMmjj5oVZfa/a80LVaA=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 5227bc309b64902b9bfd2bb79d4de347_05ad363ac7d411f1944f525400248c00
    ReservedCode2: PKfwiBPeIC8e99W0YQWb0LnrofnzKFEhZfXWlpI2XScr5sgCH466R2zUxDBWBkvp6TNEpxk8145nFyRJ5BxX/dKxTqPPToCE4K3QPZDi/5f2m9vXNQE4lwAFa0dWfR+A6A+np8eOGqF6lKpvRWQhdP5gLSKznC6t+sHjONGTbMmjj5oVZfa/a80LVaA=
---

# Blockout Tools — 网页版关卡白盒工具 (Web Blockout Level Editor)

对标 UE5 Blockout Toolkit 风格的浏览器白盒工具，用于关卡原型搭建与灰盒验证。基于 Three.js r128，全部资源本地化，`file://` 双击即可离线运行。

A UE5 Blockout Toolkit–style web whitebox level editor for gray-box prototyping. Built on Three.js r128 with fully local assets; double-click `index.html` to run offline (`file://`).

---

## 功能 Features

- **体块库 Block Library**：Cube / Sphere / Cylinder / Cone / Capsule / Plane / Ramp / Wedge / Stair / Corner / Arch / Pipe 12 种参数化体块
- **白盒分色板 Palette**：对标 UE Blockout Tools 的用途分色（地面/墙体/障碍/可交互/装饰/危险/遮挡），支持自定义色
- **三轴控制柄 Handles**：选中体块后拖拽箭头实时改尺寸
- **场景树 Scene Tree**：命名、显隐、选中、复制、删除
- **参数面板 Inspector**：名称/类型/分类/颜色/尺寸/位置/旋转
- **视图切换 Views**：透视/正交、顶/前/右、网格、线框
- **快捷键 Shortcuts**：Q 选择、Delete 删除、Ctrl+C/D/V 复制粘贴、P 视图切换、T/F/Y 顶/前/右
- **存档与导入 Save & Import**：JSON 存档、GLB/OBJ 导出、GLB/OBJ 导入（外部模型不参与参数化）
- **多语言 i18n**：中文 / English 一键切换（自动记忆）
- **角色跑图 Role Mode**：TPS / FPS 第一第三人称跑图，WASD 移动、Shift 跑、空格跳、鼠标拖拽转向，带体块碰撞
- **FBX 导出**：导出 Binary FBX (7500) 至 DCC（默认 100 倍缩放，厘米单位）
- **本地文件 Local Files**：打开/保存 JSON 文件、自动保存（localStorage，60s 一次，可手动恢复）

- **Block Library**: 12 parametric primitives (Cube / Sphere / Cylinder / Cone / Capsule / Plane / Ramp / Wedge / Stair / Corner / Arch / Pipe)
- **Palette**: UE Blockout-style purpose colors (Ground / Wall / Obstacle / Interactive / Decor / Danger / Blocker) + custom color
- **Handles**: drag axis arrows to resize the selected block in real time
- **Scene Tree**: rename, toggle visibility, select, duplicate, delete
- **Inspector**: name / type / category / color / size / position / rotation
- **Views**: persp/ortho, top/front/right, grid, wireframe
- **Shortcuts**: Q select, Delete remove, Ctrl+C/D/V duplicate & paste, P view toggle, T/F/Y top/front/right
- **Save & Import**: JSON save, GLB/OBJ export, GLB/OBJ import (imported models are non-parametric)
- **i18n**: Chinese / English switch (remembered)
- **Role Mode**: TPS / FPS run-through with block collision; WASD move, Shift run, Space jump, drag to look
- **FBX Export**: Binary FBX (7500) for DCC tools (100× scale, centimeter units by default)
- **Local Files**: open/save JSON, auto-save to localStorage (every 60s, manually restorable)

---

## 使用 Usage

直接双击 `index.html`（无需服务器，Chrome / Edge 均支持）。

Double-click `index.html` — no server needed (Chrome / Edge recommended).

### 操作流程 Quick Start

1. 体块库点击一个类型（如 Cube）→ 在视口点击放置；按住 Shift 可连续放置，右键取消
2. 点选体块（选择模式）→ 右侧参数面板调整尺寸/颜色/分类，或拖拽三轴控制柄
3. 场景树管理所有体块；工具栏保存 JSON / 导出 GLB / OBJ / FBX
4. 需要跑图验证时点击 TPS / FPS 角色按钮，WASD 移动、鼠标拖拽转向
5. 打开/保存本地 JSON 文件，或开启自动保存防丢失

1. Pick a type in the Block Library (e.g. Cube) → click in the viewport to place; hold Shift for multiple, right-click to cancel
2. Select a block → adjust size/color/category in the Inspector, or drag the axis handles
3. Manage blocks in the Scene Tree; save JSON / export GLB / OBJ / FBX from the toolbar
4. Click TPS / FPS for run-through; WASD move, drag to look
5. Open/save local JSON files, or enable AutoSave to avoid losing work

---

## 文件结构 Structure

| 文件 File | 说明 Description |
|-----------|------------------|
| `index.html` | 界面与样式 UI & styles |
| `main.js` | 主逻辑（体块/分色板/控制柄/场景树/参数/视图/多语言/角色/FBX/本地文件） |
| `three.min.js` | Three.js r128 UMD（本地） |
| `OrbitControls.js` / `GLTFLoader.js` / `GLTFExporter.js` | Three.js 官方扩展（r128，本地） |
| `FBXExporter.js` | 第三方 FBX 导出器（Shoozes/FBXExporter-threejs，改造为 UMD 全局） |
| `README.md` | 本说明 |

---

## 技术说明 Technical Notes

- 所有依赖本地化，禁 CDN，保证 `file://` 与离线环境可用
- FBX 导出使用第三方实现（Binary FBX 7500），默认 `scale = 100`（Three 米 → FBX 厘米）；与 GLB/OBJ 导出一样只导出场景中的体块（不含网格/控制柄）
- 导入的 GLB/OBJ 作为 `imported` 类型参与场景树与导出，不参与参数化编辑
- 自动保存数据存于 `localStorage`（键 `blockout_autosave`），语言偏好键 `blockout_lang`

- All dependencies are local (no CDN), safe for `file://` and offline use
- FBX export is powered by a third-party binary (FBX 7500) exporter; default `scale = 100` (Three meters → FBX centimeters). Like GLB/OBJ export, only scene blocks are exported (grid/handles excluded)
- Imported GLB/OBJ become `imported` bodies: listed in the tree and exported, but not parametric
- Auto-save is stored in `localStorage` (key `blockout_autosave`); language preference key: `blockout_lang`

---

## 快捷键 Shortcuts

| 按键 Key | 功能 Action |
|----------|-------------|
| `Q` | 选择模式 Select mode |
| `P` | 透视/正交切换 Persp/Ortho toggle |
| `T` / `F` / `Y` | 顶/前/右视图 Top / Front / Right |
| `Delete` | 删除选中 Delete selected |
| `Ctrl+C` / `Ctrl+D` / `Ctrl+V` | 复制 / 快速复制 / 粘贴 Copy / Quick duplicate / Paste |
| `Shift+左键` | 连续放置 / 旋转视图 Place multiple / Orbit |
| `W A S D` | 角色模式下移动（Role mode move） |
| `Shift` / `Space` | 角色模式下奔跑 / 跳跃（Role mode run / jump） |
*（内容由AI生成，仅供参考）*
