import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const relative = file => path.relative(root, file).split(path.sep).join('/')
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
export const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + '\n')
}
export const fixtureFiles = fs.readdirSync(path.join(root, 'fixtures/metadata/author_elective_update'))
  .filter(name => name.endsWith('.xml')).sort()
export const expected = [
  { table: 'sys_ui_form', id: '11111111111111111111111111111111' },
  { table: 'sys_ui_form_section', id: '22222222222222222222222222222222' },
  { table: 'sys_ui_list', id: '33333333333333333333333333333333' },
  { table: 'sys_ui_list_element', id: '44444444444444444444444444444444' },
  { table: 'sys_ui_form', id: '55555555555555555555555555555555' },
]

// This local reproduction has no authentication or install code. Fail on network use.
let networkAttempts = 0
const deny = () => { networkAttempts++; throw new Error('This reproduction is local-only') }
globalThis.fetch = deny
http.request = http.get = https.request = https.get = net.connect = net.createConnection = tls.connect = deny
net.Socket.prototype.connect = deny
syncBuiltinESMExports()
export const assertOffline = () => assert.equal(networkAttempts, 0)

const require = createRequire(import.meta.url)
export const { Project, Orchestrator } = require('@servicenow/sdk/api')
const logger = { info() {}, warn() {}, error() {}, debug() {} }
const telemetryClient = { capture() {}, captureError() {}, async flush() {}, async shutdown() {} }
export const openProject = () => new Project({ rootDir: root, logger, telemetryClient })
export async function inspect(project) {
  const records = []
  for (const file of project.getFiles().filter(file => file.isInMetadataDir())) {
    for (const record of (await file.getRecords()).query()) {
      records.push({ table: record.getTable(), id: record.getId().getValue(), deleted: record.isDeleted(),
        file: relative(file.getPath()) })
    }
  }
  const registry = project.getKeys().getValue()
  const allKeys = [...Object.values(registry.explicit), ...registry.composite]
  return { records: records.sort((a, b) => a.id.localeCompare(b.id)),
    keys: allKeys.filter(key => expected.some(row => row.id === key.id))
      .map(key => ({ table: key.table, id: key.id, deleted: key.deleted === true })).sort((a, b) => a.id.localeCompare(b.id)) }
}
