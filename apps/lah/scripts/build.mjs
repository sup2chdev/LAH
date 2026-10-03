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
await writeFile(resolve(appRoot, 'dist/package.json'), JSON.stringify({
  name: 'lah', productName: 'LAH', version: manifest.version, main: 'main.cjs', description: manifest.description,
}, null, 2) + '\n')
await cp(resolve(root, 'LICENSE'), resolve(appRoot, 'dist/LICENSE'))
await cp(resolve(root, 'THIRD_PARTY_NOTICES.md'), resolve(appRoot, 'dist/THIRD_PARTY_NOTICES.md'))
