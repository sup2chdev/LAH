/** Export the runtime's exact compiled model-facing tool menu without inference or execution. */
import { build } from 'esbuild'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const appRoot = resolve(import.meta.dirname, '..')
const root = resolve(appRoot, '../..')
const output = resolve(appRoot, 'test-output/tool-menu-export.cjs')
await mkdir(resolve(appRoot, 'test-output'), { recursive: true })
await build({
  stdin: {
    contents: `import { createTools } from './apps/lah/runtime/index.ts';
import { ReadOnlyWorkspace } from './apps/lah/runtime/filesystem.ts';
import { Config } from './apps/lah/runtime/config.ts';
async function exportMenu() {
  const workspace = await ReadOnlyWorkspace.create(Config({ model: 'schema-export', workspace: process.cwd() }));
  const tools = createTools(workspace).map(tool => ({ option_id: tool.name, name: tool.name, description: tool.description, input_schema: tool.parameters }));
  process.stdout.write(JSON.stringify({ version: 'lah-read-search-v1', source: 'apps/lah/runtime/index.ts', tools }, null, 2) + '\\n');
}
exportMenu().catch(error => { console.error(error); process.exitCode = 1; });`,
    resolveDir: root, loader: 'ts',
  },
  outfile: output, bundle: true, platform: 'node', format: 'cjs', target: 'node22',
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
  logLevel: 'silent',
})
const { stdout } = await promisify(execFile)(process.execPath, [output], { cwd: root, windowsHide: true })
JSON.parse(stdout)
await writeFile(resolve(appRoot, 'runtime/tool-menu.json'), stdout)
process.stdout.write('LAH_TOOL_MENU_EXPORTED\n')
