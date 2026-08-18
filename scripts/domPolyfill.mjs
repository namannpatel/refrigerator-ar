/**
 * Minimal DOM stubs so THREE.USDZExporter can rasterize textures in Node.
 */
import { createCanvas, Image } from 'canvas';

const Canvas = createCanvas(1, 1).constructor;

if (typeof globalThis.HTMLCanvasElement === 'undefined') {
  globalThis.HTMLCanvasElement = Canvas;
}

if (typeof globalThis.HTMLImageElement === 'undefined') {
  globalThis.HTMLImageElement = Image;
}

if (!Canvas.prototype.toBlob) {
  Canvas.prototype.toBlob = function toBlob(callback, mimeType = 'image/png', quality) {
    const format = mimeType === 'image/jpeg' ? 'jpeg' : 'png';
    const buffer = this.toBuffer(format, { quality });
    const blob = new Blob([buffer], { type: mimeType });
    callback(blob);
  };
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement(tag) {
      if (tag === 'canvas') return createCanvas(1, 1);
      throw new Error(`document.createElement: unsupported ${tag}`);
    },
  };
}
