/** Render the SVG brand into the portable carrier's Windows window icon. */
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const appRoot = resolve(import.meta.dirname, '..')
// The repository's desktop packaging workspace owns this existing raster renderer.
const require = createRequire(resolve(appRoot, '../desktop/package.json'))
const sharp = require('sharp')
const svg = await readFile(resolve(appRoot, 'renderer/brand/lah-mark.svg'), 'utf8')
const body = svg.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1]?.replace(/<title>[\s\S]*?<\/title>/, '')
if (!body) throw new Error('LAH: missing brand artwork')
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="#1b1b1c"/><g transform="translate(32 32) scale(6)" color="#f9fafb" fill="none">${body}</g></svg>`
await sharp(Buffer.from(icon)).png().toFile(resolve(appRoot, 'renderer/brand/lah-icon.png'))
console.log('LAH_BRAND_ICON_RENDERED')
