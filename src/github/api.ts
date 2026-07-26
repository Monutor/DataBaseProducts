import { Octokit } from 'octokit'

const OWNER = import.meta.env.VITE_GITHUB_OWNER || ''
const REPO = import.meta.env.VITE_GITHUB_REPO || ''

function createClient(token: string) {
  return new Octokit({ auth: token })
}

export async function fetchCSV(token: string) {
  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/db.csv`

  const metaRes = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (!metaRes.ok) throw new Error('db.csv not found in repository')
  const meta = await metaRes.json()
  const sha = (meta as { sha?: string }).sha
  if (!sha) throw new Error('db.csv not found in repository')

  const blobRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${sha}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (!blobRes.ok) throw new Error('Failed to fetch db.csv from repository')
  const blob = await blobRes.json()
  const raw = blob.encoding === 'base64' ? atob((blob.content as string).replace(/\n/g, '')) : (blob.content as string)

  return { content: raw as string, sha }
}

export async function commitCSV(
  token: string,
  content: string,
  sha: string,
  message: string
): Promise<void> {
  const octokit = createClient(token)
  await octokit.rest.repos.createOrUpdateFileContents({
    owner: OWNER,
    repo: REPO,
    path: 'db.csv',
    message,
    content: btoa(content),
    sha,
  })
}

export { OWNER, REPO }
