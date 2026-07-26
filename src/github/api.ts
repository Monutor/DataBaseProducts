const OWNER = import.meta.env.VITE_GITHUB_OWNER || ''
const REPO = import.meta.env.VITE_GITHUB_REPO || ''
const IS_DEV = import.meta.env.DEV
const API_BASE = IS_DEV ? '/github-proxy' : `https://api.github.com`

function decodeUTF8Base64(encoded: string): string {
  const binaryStr = atob(encoded.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

function encodeUTF8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export async function fetchJSON(token?: string): Promise<{ content: string; sha: string }> {
  if (IS_DEV) {
    const res = await fetch('/api/local/db.json')
    if (!res.ok) throw new Error('Failed to read local db.json')
    return { content: await res.text(), sha: '' }
  }
  const refRes = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/git/ref/heads/main`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (!refRes.ok) throw new Error('Failed to get repository ref')
  const ref = await refRes.json()
  const commitSha = ref.object.sha as string

  const treeRes = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/git/trees/${commitSha}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (!treeRes.ok) throw new Error('Failed to get repository tree')
  const tree = await treeRes.json()
  const entry = (tree.tree as Array<{ path: string; sha: string }>).find(e => e.path === 'db.json')
  if (!entry) throw new Error('db.json not found in repository')
  const sha = entry.sha

  const blobRes = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/git/blobs/${sha}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (!blobRes.ok) throw new Error('Failed to fetch db.json from repository')
  const blob = await blobRes.json()
  const raw = blob.encoding === 'base64' ? decodeUTF8Base64(blob.content as string) : (blob.content as string)

  return { content: raw as string, sha }
}

export async function commitJSON(
  token: string,
  content: string,
  sha: string,
  message: string
): Promise<void> {
  if (IS_DEV) {
    const res = await fetch('/api/local/db.json', {
      method: 'POST',
      body: content,
    })
    if (!res.ok) throw new Error('Failed to save local db.json')
    return
  }
  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/db.json`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: encodeUTF8Base64(content),
      sha,
    }),
  })
  if (!res.ok) throw new Error('Failed to save db.json: ' + (await res.text()))
}

export { OWNER, REPO }
