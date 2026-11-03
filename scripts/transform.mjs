import fs from 'node:fs'
import path from 'node:path'
import { root, fixtureFiles, sha256, openProject, Orchestrator, inspect, writeJson, assertOffline } from './sdk.mjs'

// Reset only this reproduction's generated directories. Fixtures remain immutable.
for (const directory of ['metadata', 'src/fluent/generated', 'dist', 'results']) {
  fs.rmSync(path.join(root, directory), { recursive: true, force: true })
}
const inputs = fixtureFiles.map(name => path.join(root, 'fixtures/metadata/author_elective_update', name))
const before = inputs.map(file => sha256(fs.readFileSync(file)))
fs.cpSync(path.join(root, 'fixtures/baseline'), path.join(root, 'metadata'), { recursive: true })
const project = openProject()
try {
  const orchestrator = new Orchestrator(project)
  // Model an earlier positive pull. The SDK ignores deletes for identities it has
  // never seen; building positive metadata creates genuine SDK keys.
  const baseline = await orchestrator.build()
  if (!baseline.success) throw new Error('Positive baseline SDK build failed')
  await orchestrator.transform({ paths: inputs, format: false })
  const observation = await inspect(project)
  writeJson('results/transform.json', { ...observation,
    inputs: inputs.map((file, index) => ({ file: `fixtures/metadata/author_elective_update/${fixtureFiles[index]}`,
      sha256: before[index], unchanged: sha256(fs.readFileSync(file)) === before[index] })) })
  assertOffline()
  console.log(`TRANSFORMED: ${observation.records.length} parsed records; see results/transform.json`)
} finally { project.dispose() }
