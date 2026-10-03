/** Bundle the LAH profile and desktop carrier from this fork's source tree. */
import { build } from 'esbuild'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const appRoot = resolve(import.meta.dirname, '..')
const root = resolve(appRoot, '../..')
const manifest = JSON.parse(await readFile(resolve(appRoot, 'package.json'), 'utf8'))
await mkdir(resolve(appRoot, 'dist'), { recursive: true })
await build({
  entryPoints: [resolve(appRoot, 'kernel.ts')],
  outfile: resolve(appRoot, 'dist/kernel.cjs'),
  bundle: true, platform: 'node', format: 'cjs', target: 'node22',
  tsconfig: resolve(root, 'tsconfig.base.json'),
  plugins: [{
    name: 'lah-product-identity',
    setup(builder) {
      builder.onResolve({ filter: /^\.\/attribution\.ts$/ }, args => {
        if (args.importer.replaceAll('\\', '/').includes('/packages/llm/llm/src/')) {
          return { path: resolve(appRoot, 'support/attribution.ts') }
        }
      })
    },
  }],
  sourcemap: true,
  logLevel: 'info',
})
await cp(resolve(appRoot, 'main.cjs'), resolve(appRoot, 'dist/main.cjs'))
await cp(resolve(appRoot, 'preload.cjs'), resolve(appRoot, 'dist/preload.cjs'))
await cp(resolve(appRoot, 'renderer'), resolve(appRoot, 'dist/renderer'), { recursive: true })
// The standalone carrier consumes the fork's theme assets and existing icon geometry.
const themeRoot = resolve(root, 'packages/client/ui-theme/src/styles')
await mkdir(resolve(appRoot, 'dist/renderer/theme'), { recursive: true })
for (const file of ['base.css', 'design-platform.css', 'gradient-shadow-text.css', 'corner-shape.css', 'brand-font.css',
  'montserrat-regular.woff2', 'montserrat-medium.woff2', 'montserrat-light.woff2', 'Montserrat-OFL.txt']) {
  await cp(resolve(themeRoot, file), resolve(appRoot, 'dist/renderer/theme', file))
}
const iconRoot = resolve(root, 'packages/client/ui-primitives/src/icons')
const artwork = await readFile(resolve(iconRoot, 'shared-artwork.tsx'), 'utf8')
const icons = await readFile(resolve(iconRoot, 'index.tsx'), 'utf8')
const shieldPath = icons.match(/export const SHIELD_OUTLINE_PATH = '([^']+)'/)?.[1]
if (!shieldPath) throw new Error('LAH: missing upstream shield artwork')
const symbols = [
  ['new-chat', artwork, 'NewChatOutlineArtwork'], ['folder', artwork, 'FolderCloseArtwork'],
  ['browse', artwork, 'BrowseOutlineArtwork'], ['chat', artwork, 'ChatLinesOutlineArtwork'],
  ['search', icons, 'IconSearchOutlineArtwork'], ['settings', icons, 'IconSettingsOutlineArtwork'],
  ['light', icons, 'IconLightOutlineArtwork'], ['dark', icons, 'IconDarkOutlineArtwork'],
  ['send', icons, 'IconSendOutlineArtwork'], ['chevron', icons, 'IconChevronDownOutlineArtwork'],
  ['close', icons, 'IconCloseOutlineArtwork'], ['stop', icons, 'IconStopFillArtwork'],
  ['plus', icons, 'IconPlusOutlineArtwork'], ['shield', icons, 'IconShieldOutlineArtwork'],
  ['model', icons, 'IconDatabaseOutlineArtwork'], ['agent', icons, 'IconAgentPresetOutlineArtwork'],
  ['sidebar', icons, 'IconPanelLeftOutlineArtwork'],
].map(([id, source, component]) => {
  const start = source.indexOf(`const ${component} =`)
  const body = start < 0 ? undefined : source.slice(start).match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1]
    ?.replaceAll('d={SHIELD_OUTLINE_PATH}', `d="${shieldPath}"`)
  if (!body || /[{}]/.test(body)) throw new Error(`LAH: unsupported upstream icon ${component}`)
  const markup = body.replaceAll('strokeLinecap=', 'stroke-linecap=').replaceAll('strokeLinejoin=', 'stroke-linejoin=')
    .replaceAll('strokeMiterlimit=', 'stroke-miterlimit=').replaceAll('fillRule=', 'fill-rule=').replaceAll('clipRule=', 'clip-rule=')
  return `<symbol id="icon-${id}" viewBox="0 0 16 16" fill="none" stroke-width="1.2">${markup}</symbol>`
}).join('\n')
const brand = await readFile(resolve(appRoot, 'renderer/brand/lah-mark.svg'), 'utf8')
const brandBody = brand.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1]?.replace(/<title>[\s\S]*?<\/title>/, '')
if (!brandBody) throw new Error('LAH: missing brand artwork')
const brandSymbol = `<symbol id="lah-mark" viewBox="0 0 32 32" fill="none">${brandBody}</symbol>`
const page = await readFile(resolve(appRoot, 'renderer/index.html'), 'utf8')
await writeFile(resolve(appRoot, 'dist/renderer/index.html'), page.replace('<!-- LAH_ICON_SYMBOLS -->',
  `<svg xmlns="http://www.w3.org/2000/svg" class="icon-definitions" aria-hidden="true"><defs>${symbols}${brandSymbol}</defs></svg>`))
await writeFile(resolve(appRoot, 'dist/package.json'), JSON.stringify({
  name: 'lah', productName: 'LAH', version: manifest.version, main: 'main.cjs', description: manifest.description,
}, null, 2) + '\n')
await cp(resolve(root, 'LICENSE'), resolve(appRoot, 'dist/LICENSE'))
await cp(resolve(root, 'THIRD_PARTY_NOTICES.md'), resolve(appRoot, 'dist/THIRD_PARTY_NOTICES.md'))
