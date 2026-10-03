import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'node:path'
import { standardDecoratorPlugin, vitestExecArgv } from '../../vitest.shared.ts'

export default defineConfig({
  plugins: [tsconfigPaths({ projects: [resolve(import.meta.dirname, '../../tsconfig.base.json')] }), standardDecoratorPlugin()],
  test: { include: ['tests/**/*.spec.ts'], testTimeout: 20000, execArgv: vitestExecArgv },
})
