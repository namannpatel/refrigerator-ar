/**
 * Product, model, and interaction configuration.
 * Object names come from the supplied Samsung_Fridge_low asset (OBJ/GLB export).
 */

/** Model is authored in inches; convert to meters for WebXR 1:1 scale. */
export const INCH_TO_METER = 0.0254;

/** Target real-world height from reference dimensions (70 in). */
export const TARGET_HEIGHT_INCHES = 70;

/** Vite `base` prefix — required for GitHub Pages project URLs (/repo-name/). */
const assetBase = import.meta.env.BASE_URL;

export const MODEL_PATH = `${assetBase}models/Samsung_Fridge.glb`;

export const TEXTURE_BASE = `${assetBase}textures/`;

export const TEXTURES = {
  diffuse: 'Samsung_Fridge_low_Samsung_Fridge_Diffuse.jpg',
  normal: 'Samsung_Fridge_low_Samsung_Fridge_Normal.jpg',
  glossiness: 'Samsung_Fridge_low_Samsung_Fridge_Glossiness.jpg',
  emissive: 'Samsung_Fridge_low_Samsung_Fridge_Emissive.jpg',
  metallic: 'Metallic.jpg',
  height: 'Samsung_Fridge_low_Samsung_Fridge_Height.jpg',
};

/** Exact GLB mesh names → assembly group (from obj2gltf export). */
export const MESH_GROUPS = {
  chassis: [
    'Body_1',
    'Interior_Support_1',
    'Interior_Shelves_1',
    'Interior_IceMaker_1',
    'Interior_Drawner_2',
    'Left_Door_Support_1',
    'Right_Door_Support_1',
    'Interior_Light_Top_1',
    'Interior_Light_Left_1',
    'Interior_Light_Right_1',
  ],
  leftDoor: [
    'Left_Door_1',
    'Left_Door_Hinge_1',
    'Left_Door_Handle_1',
    'Left_Door_Shelves_1',
  ],
  rightDoor: [
    'Right_Door_1',
    'Right_Door_Hinge_1',
    'Right_Door_Handle_1',
    'Right_Door_Shelves_1',
  ],
  freezer: [
    'Refregerator_1',
    'Refregerator_Support_1',
    'Refregerator_Handle_1',
    'Interior_Drawner_3',
  ],
};

export function getMeshGroup(meshName) {
  const normalized = meshName.trim();
  for (const [group, names] of Object.entries(MESH_GROUPS)) {
    if (names.includes(normalized)) return group;
  }
  return 'chassis';
}

/** Name-pattern → logical part mapping (case-insensitive substring match). */
export const PART_PATTERNS = {
  body: ['body'],
  interiorSupport: ['interior_support'],
  interiorDrawer: ['interior_drawner', 'interior_drawer'],
  interiorShelves: ['interior_shelves'],
  interiorIceMaker: ['interior_icemaker'],
  leftDoorSupport: ['left_door_support'],
  rightDoorSupport: ['right_door_support'],
  freezerBody: ['refregerator_1'],
  freezerSupport: ['refregerator_support'],
  freezerHandle: ['refregerator_handle'],
  leftDoor: ['left_door_1'],
  leftDoorHinge: ['left_door_hinge'],
  leftDoorHandle: ['left_door_handle'],
  leftDoorShelves: ['left_door_shelves'],
  rightDoor: ['right_door_1'],
  rightDoorHinge: ['right_door_hinge'],
  rightDoorHandle: ['right_door_handle'],
  rightDoorShelves: ['right_door_shelves'],
  interiorLightTop: ['interior_light_top'],
  interiorLightLeft: ['interior_light_left'],
  interiorLightRight: ['interior_light_right'],
};

export const ANIMATION = {
  doorOpenAngle: Math.PI * 0.42,
  doorDuration: 0.85,
  freezerSlideDistance: 14,
  freezerSlideSign: 1,
  freezerDuration: 0.9,
  easing: 0.12,
};

export const PRODUCT = {
  name: 'Samsung Refrigerator',
  category: 'French-door refrigerator',
  modelRef: 'RF263BEAE',
  demoPrice: '$2,499',
  dimensions: {
    widthIn: 35.75,
    depthIn: 35.625,
    heightIn: 70,
    widthCm: 91,
    depthCm: 91,
    heightCm: 178,
  },
  capacity: '~25 cu ft (demo)',
  energy: 'Energy Star class (demo label)',
  features: [
    'Twin cooling zones with independent temperature control',
    'External water and ice dispenser',
    'LED interior lighting',
    'Spill-proof glass shelves',
    'Energy-efficient inverter compressor (demo)',
  ],
  specs: [
    { label: 'Product', value: 'Samsung French-door refrigerator (demo showcase)' },
    { label: 'Model reference', value: 'RF263BEAE' },
    { label: 'Width', value: '35.75 in (91 cm)' },
    { label: 'Depth (with handles)', value: '35.63 in (91 cm)' },
    { label: 'Height', value: '70 in (178 cm)' },
    { label: 'Capacity', value: '~25 cu ft (placeholder)' },
    { label: 'Refrigerator temp (simulated)', value: '3°C default' },
    { label: 'Freezer temp (simulated)', value: '-18°C default' },
    { label: 'Finish', value: 'Stainless steel (demo)' },
    { label: 'Energy information', value: 'Demo Energy Star label — not official data' },
    { label: 'Cooling system', value: 'Twin cooling (demo description)' },
  ],
};

export const FINISHES = [
  { name: 'Stainless Steel', color: 0xffffff, metalness: 0.85, roughness: 0.35 },
  { name: 'Matte Black', color: 0x2a2a2e, metalness: 0.6, roughness: 0.45 },
  { name: 'Slate Gray', color: 0x6b7280, metalness: 0.7, roughness: 0.4 },
];

export const CAMERA = {
  fov: 42,
  near: 0.01,
  far: 100,
  minDistance: 0.8,
  maxDistance: 6,
  autoRotateSpeed: 0.35,
  idleAutoRotateDelay: 4000,
};

/** Display panel hit zone on left door (model space, inches). */
export const DISPLAY_ZONE = {
  minX: -20,
  maxX: -8,
  minY: 48,
  maxY: 62,
  minZ: 30,
  maxZ: 38,
};

/** Dispenser hit zone on left door exterior (model space, inches). */
export const DISPENSER_ZONE = {
  minX: -20,
  maxX: -8,
  minY: 28,
  maxY: 44,
  minZ: 32,
  maxZ: 40,
};
