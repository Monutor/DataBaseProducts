import { readFileSync } from 'fs'
const TOKEN = process.env.GITHUB_TOKEN

const content = readFileSync('db.json')
const b64 = content.toString('base64')

const shaRes = await fetch('https://api.github.com/repos/Monutor/DataBaseProducts/contents/db.json', {
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' },
})
if (!shaRes.ok) { console.error('Failed to get file info:', shaRes.status); process.exit(1) }
const shaInfo = await shaRes.json()
const sha = shaInfo.sha

const res = await fetch('https://api.github.com/repos/Monutor/DataBaseProducts/contents/db.json', {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: '[Admin] Convert CSV to JSON',
    content: b64,
    sha,
  }),
})
const json = await res.json()
console.log(res.status, json.content?.name || json.message || 'no name')
