import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { root, relative, sha256, readJson, openProject, Orchestrator, inspect, writeJson, assertOffline } from './sdk.mjs'

readJson('results/transform.json') // Require this run's transform, rather than stale build output.
const project = openProject()
try {
  const orchestrator = new Orchestrator(project)
  const result = await orchestrator.build()
  assert.equal(result.success, true, 'SDK build failed')
  const packageFile = await orchestrator.pack()
  const unpacked = await orchestrator.unpack(packageFile, path.join(root, 'results/unpacked'))
  const outputDir = project.resolvePath(project.getConfig().appOutputDir)
  writeJson('results/build.json', { packageFile: relative(packageFile), packageSha256: sha256(fs.readFileSync(packageFile)),
    outputDir: relative(outputDir), unpackedFiles: unpacked.files.map(relative).sort(), ...(await inspect(project)) })
  assertOffline()
  console.log('BUILT_AND_PACKED: unchanged direct SDK output; see results/build.json')
} finally { project.dispose() }
