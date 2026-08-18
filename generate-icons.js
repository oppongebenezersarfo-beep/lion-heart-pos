const sharp = require('sharp');
const path = require('path');

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#111827"/>
  <rect x="32" y="32" width="448" height="448" rx="48" fill="#1f2937"/>
  <text x="256" y="200" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="140" fill="#b8860b">LH</text>
  <text x="256" y="310" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="64" fill="#ffffff">POS</text>
  <rect x="100" y="340" width="312" height="10" rx="5" fill="#b8860b"/>
</svg>`;

const publicDir = path.join(__dirname, 'client', 'public');

async function generateIcons() {
  const sizes = [192, 512];
  
  for (const size of sizes) {
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, `icon-${size}.png`));
    
    console.log(`Generated icon-${size}.png`);
  }
  
  // Also generate favicon
  await sharp(Buffer.from(svgIcon))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  
  console.log('Generated favicon.png');
}

generateIcons().catch(console.error);
