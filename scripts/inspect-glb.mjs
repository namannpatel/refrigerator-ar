import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('public/models/Samsung_Fridge.glb');
const root = doc.getRoot();
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  console.log(node.getName(), mesh ? `mesh: ${mesh.getName()}` : '', node.listChildren().map(c => c.getName()));
}
