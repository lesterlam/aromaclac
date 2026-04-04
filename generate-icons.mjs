// Script to generate PWA icons
// Run: node generate-icons.mjs
import sharp from 'sharp'
import { mkdirSync, existsSync } from 'fs'

const SIZE_192 = 192
const SIZE_512 = 512

// Ensure output directory exists
if (!existsSync('public')) {
  mkdirSync('public', { recursive: true })
}

// Create a simple gradient icon with "AC" text
async function createIcon(size, filename) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#34d399;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00000033"/>
        </filter>
      </defs>
      <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
      <text 
        x="50%" 
        y="55%" 
        text-anchor="middle" 
        dominant-baseline="middle" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-weight="700" 
        font-size="${size * 0.45}px" 
        fill="white"
        filter="url(#shadow)"
      >AC</text>
    </svg>
  `

  await sharp(Buffer.from(svg))
    .png()
    .toFile(`public/${filename}`)

  console.log(`Created ${filename} (${size}x${size})`)
}

async function main() {
  try {
    await createIcon(SIZE_192, 'icon-192.png')
    await createIcon(SIZE_512, 'icon-512.png')
    console.log('\n✓ PWA icons generated successfully!')
    console.log('  - public/icon-192.png')
    console.log('  - public/icon-512.png')
  } catch (error) {
    console.error('Error generating icons:', error)
    process.exit(1)
  }
}

main()