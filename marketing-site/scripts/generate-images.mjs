import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

async function convert(svgName, pngName, width, height) {
  const svg = readFileSync(join(publicDir, svgName));
  await sharp(svg, { density: 300 })
    .resize(width, height)
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(join(publicDir, pngName));
  console.log(`✓ ${pngName} (${width}×${height})`);
}

await convert('og-image.svg', 'og-image.png', 1200, 630);
await convert('apple-touch-icon.svg', 'apple-touch-icon.png', 180, 180);
await convert('apple-touch-icon.svg', 'icon-512.png', 512, 512);
await convert('apple-touch-icon.svg', 'icon-192.png', 192, 192);

console.log('\nAll images generated in public/');
