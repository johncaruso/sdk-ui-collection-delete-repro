import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { root, expected, fixtureFiles, sha256, readJson, writeJson, assertOffline } from './sdk.mjs'

const transform = readJson('results/transform.json')
const build = readJson('results/build.json')
const identities = rows => rows.map(({ table, id }) => `${table}/${id}`).sort()
for (const stage of [transform, build]) {
  assert.deepEqual(identities(stage.records), identities(expected), 'Unexpected parsed records')
  assert.ok(stage.records.every(row => row.deleted), 'SDK parser did not mark each record deleted')
  assert.deepEqual(identities(stage.keys), identities(expected), 'Unexpected generated key identities')
  assert.ok(stage.keys.every(row => row.deleted), 'SDK keys did not mark each identity deleted')
}
assert.ok(transform.inputs.every(row => row.unchanged), 'Transform modified input fixtures')
assert.equal(sha256(fs.readFileSync(path.join(root, build.packageFile))), build.packageSha256)

const observations = fixtureFiles.map(name => {
  const original = fs.readFileSync(path.join(root, 'fixtures/metadata/author_elective_update', name))
  const packedFiles = build.unpackedFiles.filter(file => path.basename(file) === name)
  assert.equal(packedFiles.length, 1, `Expected exactly one packed ${name}`)
  const metadataFile = transform.records.find(row => path.basename(row.file) === name)?.file
  assert.ok(metadataFile, `No transformed metadata for ${name}`)
  assert.equal(sha256(fs.readFileSync(path.join(root, metadataFile))), sha256(original), 'Transformed metadata changed')
  const builtFile = path.join(root, build.outputDir, path.relative('results/unpacked', packedFiles[0]))
  const built = fs.readFileSync(builtFile)
  const packed = fs.readFileSync(path.join(root, packedFiles[0]))
  assert.equal(sha256(built), sha256(packed), 'Build and packed XML differ')
  const unchanged = sha256(packed) === sha256(original)
  const collection = name !== 'sys_ui_form_55555555555555555555555555555555.xml'
  const retainedInnerUpserts = collection && packed.toString('utf8').includes('action="INSERT_OR_UPDATE"')
  if (!collection) {
    assert.ok(unchanged, 'Ordinary parent DELETE control changed')
    assert.ok(!packed.toString('utf8').includes('INSERT_OR_UPDATE'), 'Ordinary DELETE control has an upsert')
  }
  return { fixture: name, sha256: sha256(original), packedFile: packedFiles[0], collection,
    sourceMetadataUnchanged: true, packedXmlUnchanged: unchanged, retainedInnerUpserts }
})
assertOffline()
const reproduced = observations.filter(row => row.collection).every(row => row.packedXmlUnchanged && row.retainedInnerUpserts)
writeJson('results/assertion.json', { sdkVersion: '4.14.0', parsedAndKeyRecordsDeleted: true,
  packagingConditionReproduced: reproduced, networkAttempts: 0, observations,
  limitation: 'This local packaging check does not establish live importer behavior or platform fix status.' })
if (reproduced) {
  console.error('PACKAGING_CONDITION_REPRODUCED: SDK records and keys are deleted, but both collection payloads retain their original inner INSERT_OR_UPDATE bytes in the ZIP. Ordinary DELETE control stays DELETE.')
  console.error('Local packaging evidence only; this does not prove form/list recreation or determine platform fix status.')
  process.exitCode = 1
} else {
  console.log('PACKAGING_CONDITION_NOT_REPRODUCED: serialization differs; inspect results/assertion.json and qualify deletion behavior on a disposable instance.')
}
