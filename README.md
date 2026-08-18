# Samsung Refrigerator — 3D & WebXR AR Experience

Premium e-commerce product page showcasing the supplied Samsung French-door refrigerator as an interactive 3D model with WebXR augmented reality placement.

## Features

- Studio-style 3D product viewer with orbit controls, auto-rotate, and reset camera
- Interactive doors (left/right), freezer drawer, display temperature panel, and water/ice dispenser feedback
- Product specifications, demo pricing, and finish selector
- WebXR immersive AR with hit-test surface detection, placement reticle, move/rotate controls
- Same interaction system in 3D viewer and AR
- Loading progress, error handling, and WebXR capability detection
- Responsive layout for desktop, tablet, and mobile

## Prerequisites

- Node.js 18+ and npm
- Modern browser with WebGL support
- For AR: Android device with Chrome + ARCore, or iOS with Safari + ARKit
- HTTPS deployment (or localhost) for WebXR

## Installation

```bash
cd refrigerator-ar
npm install
```

## Development

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

For AR testing on a phone, use your LAN IP (Vite prints it) with HTTPS or use a tunnel (ngrok, Cloudflare Tunnel). WebXR requires a secure context.

## Production build

```bash
npm run build
npm run preview
```

The build output is in `dist/`.

## Deployment

### GitHub Pages (recommended for demos)

Yes — this project is a static Vite build and works on **GitHub Pages with free HTTPS**, which is required for WebXR AR on phones.

1. Push this project to a GitHub repository (e.g. `refrigerator-ar`).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or `master`). The workflow `.github/workflows/deploy-pages.yml` builds and deploys automatically.
4. Your site will be at:
   ```
   https://<username>.github.io/<repo-name>/
   ```
   Example: `https://naman.github.io/refrigerator-ar/`

**Local build for Pages** (if your repo name is `refrigerator-ar`):

```bash
VITE_BASE_PATH=/refrigerator-ar/ npm run build
```

Then upload `dist/` manually, or rely on the GitHub Action (sets `VITE_BASE_PATH` automatically).

**AR on the live site**

| Device | Browser |
|--------|---------|
| iPhone (iOS 17+) | Safari |
| Android | Chrome (ARCore) |

GitHub Pages URL uses HTTPS, so AR works without a LAN dev server.

### Other static hosts

1. Deploy `dist/` to Vercel, Netlify, Cloudflare Pages, S3, etc.
2. **HTTPS is required** for WebXR AR in production
3. If the site is served from a subpath, set `VITE_BASE_PATH` when building (e.g. `VITE_BASE_PATH=/my-app/ npm run build`)

Example Netlify/Vercel: build command `npm run build`, publish directory `dist`, base path `/` for custom domains.

## Model location

- GLB: `public/models/Samsung_Fridge.glb`
- Source FBX: `Samsung+Fridge/Model Format/Fbx File/Samsung_Fridge_low.FBX`
- Source OBJ: `Samsung+Fridge/Model Format/Obj File/Samsung_Fridge_low.obj`

## FBX-to-GLB conversion

This project was converted from the supplied low-poly FBX/OBJ using `obj2gltf`:

```bash
npx obj2gltf -i "../Samsung+Fridge/Model Format/Obj File/Samsung_Fridge_low.obj" \
  -o public/models/Samsung_Fridge.glb
```

For FBX (recommended if Blender is available):

```bash
# Blender 3.x headless
blender --background --python scripts/fbx_to_glb.py

# Or FBX2glTF (Facebook)
npx fbx2gltf "path/to/Samsung_Fridge_low.FBX" -o public/models/Samsung_Fridge.glb -k
```

**Preserve hierarchy:** The flat GLB export contains separate meshes per part. The app rebuilds pivot groups in `src/refrigerator.js` for door rotation and freezer slide. If re-exporting, keep separate objects for:

| Logical part | GLB mesh names |
|---|---|
| Main body | `Body` |
| Left door | `Left_Door`, `Left_Door_Hinge`, `Left_Door_Handle`, `Left_Door_Shelves` |
| Right door | `Right_Door`, `Right_Door_Hinge`, `Right_Door_Handle`, `Right_Door_Shelves` |
| Freezer drawer | `Refregerator`, `Refregerator_Support`, `Refregerator_Handle` |
| Interior | `Interior_Shelves`, `Interior_Drawner`, `Interior_IceMaker`, lights |
| Display / dispenser | Zones on left door (spatial hit zones in `config.js`) |

### Pivot verification

Door hinges are computed from mesh bounding boxes at load time. If doors rotate incorrectly after re-export, adjust hinge logic in `refrigerator.js` `_setupPivots()`.

## Texture setup

2K JPG textures from `Samsung+Fridge/Texture File/Jpg format/2k/` are copied to `public/textures/`:

| File | Usage |
|---|---|
| `Samsung_Fridge_low_Samsung_Fridge_Diffuse.jpg` | Base color (`map`) |
| `Samsung_Fridge_low_Samsung_Fridge_Normal.jpg` | Normal map |
| `Metallic.jpg` | Metalness map |
| `Samsung_Fridge_low_Samsung_Fridge_Glossiness.jpg` | Roughness map |
| `Samsung_Fridge_low_Samsung_Fridge_Emissive.jpg` | Emissive map |

Textures are applied in `src/modelLoader.js` after GLB load (the OBJ export does not embed textures).

## WebXR requirements

- `immersive-ar` session with `hit-test` feature
- Camera permission
- Compatible hardware (ARCore / ARKit)
- Secure context (HTTPS or localhost)

## AR testing

### iPhone (Safari)

1. Run the dev server (HTTPS is enabled automatically):
   ```bash
   npm run dev
   ```
2. On your Mac terminal, Vite prints **Network** URLs. Use the **`https://`** link, e.g. `https://192.168.107.172:5173/` — **not** `http://`.
3. On iPhone Safari, open that `https://` URL.
4. Accept the **self-signed certificate warning** (“Show Details” → “visit this website”).
5. Requires **iOS 17+** for WebXR immersive AR.
6. Tap **View in AR** and allow camera access.

**Chrome on iPhone** uses Apple’s WebKit engine and often does **not** support immersive AR — use **Safari**.

### Android

1. Open the `https://` dev URL in **Chrome** (ARCore required).
2. Tap **View in AR**.

### General steps

1. Point at a horizontal floor surface
2. Tap to place the refrigerator
3. Use Move / Rotate controls
4. Doors, freezer, and display remain interactive after placement

## Browser / device limitations

| Environment | 3D viewer | WebXR AR |
|---|---|---|
| Desktop Chrome/Firefox/Safari | ✅ | ❌ (no AR hardware) |
| Android Chrome + ARCore | ✅ | ✅ |
| iOS Safari 17+ (HTTPS) | ✅ | ✅ |
| iOS Chrome | ✅ | ❌ (use Safari) |
| Older browsers without WebGL | ❌ | ❌ |

- AR button is disabled when `immersive-ar` is not supported
- Desktop users can explore the full 3D experience without AR
- Render images from `Render File/` are **not** used as textures

## AR scale

The model is authored in inches (height ≈ 70 in). The app scales to real-world meters using reference dimensions:

- Height: 70 in → 1.778 m
- Width (demo spec): 35.75 in → 0.908 m
- Depth (demo spec): 35.625 in → 0.905 m

Scale factor: `TARGET_HEIGHT_INCHES * 0.0254 / measuredHeight`.

## Known limitations

- Display and dispenser use spatial zones on the left door mesh (no separate display geometry in the low model)
- Finish selector tints materials; not separate PBR finishes from source
- No Draco/Meshopt compression applied (GLB is ~360 KB)
- AR rotation uses touch drag in Rotate mode; precision varies by device
- `dom-overlay` is optional; AR UI may appear outside passthrough on some browsers
- Demo specifications are placeholders, not official Samsung data

## Project structure

```
refrigerator-ar/
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── public/
│   ├── models/Samsung_Fridge.glb
│   └── textures/*.jpg
├── src/
│   ├── main.js          # App bootstrap
│   ├── scene.js         # Renderer, camera, lighting
│   ├── modelLoader.js   # GLB + texture loading
│   ├── refrigerator.js  # Hierarchy, pivots, animations
│   ├── interaction.js   # Raycasting / tap handling
│   ├── productViewer.js # OrbitControls
│   ├── ar.js            # WebXR AR session
│   ├── ui.js            # Product page UI
│   └── config.js        # Product + model configuration
└── styles/main.css
```

## License

Demo showcase using supplied Samsung refrigerator asset. Samsung trademarks belong to their respective owners.
