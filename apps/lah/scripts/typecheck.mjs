/** Check LAH and its selected Harness source against each vendored library's emitted types. */
import ts from 'typescript'
import { resolve } from 'node:path'
const appRoot = resolve(import.meta.dirname, '..')
const root = resolve(appRoot, '../..')
const input = ts.readConfigFile(resolve(appRoot, 'tsconfig.json'), ts.sys.readFile)
if (input.error) throw new Error(ts.flattenDiagnosticMessageText(input.error.messageText, '\n'))
const parsed = ts.parseJsonConfigFileContent(input.config, ts.sys, appRoot)
const paths = { ...parsed.options.paths }
for (const [name, directory] of [['cordis', 'cordis'], ['cosmokit', 'cosmokit'], ['schemastery', 'schemastery'], ['cordis-plugin-timer', 'timer']]) {
  paths[`@deepseek-ai/${name}`] = [resolve(root, `vendor/${directory}/lib/types/index.d.ts`)]
}
const program = ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, paths } })
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)]
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n',
  }))
  process.exitCode = 1
} else console.log('LAH_TYPECHECK_PASS')
