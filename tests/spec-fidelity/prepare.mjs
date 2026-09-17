#!/usr/bin/env node
/* Builds a run directory: the stub, a clone of THIS commit at stub/shared, and docs/
   holding only what the model is allowed to read. Docs are copied at run time so they
   are the current ones, not a snapshot that drifts. Usage: node prepare.mjs <out-dir> */
import { cpSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const OUT = resolve(process.argv[2] ?? 'run')
mkdirSync(join(OUT, 'docs'), { recursive: true })

cpSync(join(HERE, 'stub'), join(OUT, 'stub'), { recursive: true })
execSync(`git clone -q "${ROOT}" "${join(OUT, 'stub', 'shared')}" && git -C "${join(OUT, 'stub', 'shared')}" checkout -q ${execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim()}`)
execSync('npm install --silent --no-audit --no-fund', { cwd: join(OUT, 'stub'), stdio: 'ignore' })

// What the model may read. The props JSDoc and the CSS header are docs by intent.
for (const f of ['DIAL.md', 'GESTURES.md', 'TYPOGRAPHY.md', 'SLIDERS.md']) cpSync(join(ROOT, f), join(OUT, 'docs', f))
const tsx = readFileSync(join(ROOT, 'src/AxisSlider.tsx'), 'utf8')
const props = tsx.slice(tsx.indexOf('export interface AxisSliderProps'), tsx.indexOf('export function AxisSlider'))
writeFileSync(join(OUT, 'docs', 'AxisSlider.props.ts'), '// The props, verbatim from src/AxisSlider.tsx\n' + props)
const css = readFileSync(join(ROOT, 'src/AxisSlider.css'), 'utf8')
writeFileSync(join(OUT, 'docs', 'AxisSlider.css-header.txt'), css.slice(0, css.indexOf('@layer wm.controls')))
cpSync(join(HERE, 'tasks.md'), join(OUT, 'tasks.md'))
console.log(OUT)
