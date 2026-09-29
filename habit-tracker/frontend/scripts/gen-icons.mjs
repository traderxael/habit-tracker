import sharp from "sharp";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, "..", "public");
const svg = readFileSync(path.join(pub, "icon.svg"));

// Normal: relleno completo con la marca (esquina cuadrada + círculo indigo + check).
for (const [name, size] of [
  ["pwa-192x192.png", 192],
  ["pwa-512x512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  await sharp(svg).resize(size, size).png().toFile(path.join(pub, name));
}

// Maskable: marca al 60% sobre fondo brand, respetando la safe zone (~80%).
const mask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
     <rect width="512" height="512" fill="#4f46e5"/>
     <g transform="translate(51.2 51.2) scale(1.6)">
       <path d="M76 132l34 34 70-72" stroke="white" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
     </g>
   </svg>`,
);
await sharp(mask).resize(512, 512).png().toFile(path.join(pub, "pwa-maskable-512.png"));

console.log("Iconos PWA generados en frontend/public/");
