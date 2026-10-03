/** Create an unsigned portable Windows application, keeping all runtime files together. */
import { cp, mkdir, rename, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
if (process.platform !== 'win32') throw new Error('Windows packaging must run on Windows.')
const appRoot = resolve(import.meta.dirname, '..')
const electron = require('electron')
const directory = resolve(appRoot, 'release/LAH-win32-x64')
await mkdir(directory, { recursive: true })
await cp(dirname(electron), directory, { recursive: true })
await rename(resolve(directory, 'electron.exe'), resolve(directory, 'LAH.exe'))
await mkdir(resolve(directory, 'resources/app'), { recursive: true })
await cp(resolve(appRoot, 'dist'), resolve(directory, 'resources/app'), { recursive: true })
await writeFile(resolve(directory, 'README.txt'), 'LAH — Local Agent Harness, prealpha\r\nRun LAH.exe. Keep this entire directory together.\r\nNo model is bundled. Choose a workspace and configure a running local OpenAI-compatible server.\r\nUnsigned development build; no automatic updates or cloud accounts.\r\n')
console.log(directory)
