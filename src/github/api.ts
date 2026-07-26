import { Octokit } from 'octokit'

const OWNER = import.meta.env.VITE_GITHUB_OWNER || ''
const REPO = import.meta.env.VITE_GITHUB_REPO || ''

function createClient(token: string) {
  return new Octokit({ auth: token })
}

export async function fetchCSV(token: string) {
  const octokit = createClient(token)

  const meta = await octokit.rest.repos.getContent({
    owner: OWNER,
    repo: REPO,
    path: 'db.csv',
  })
  const sha = (meta.data as { sha?: string }).sha
  if (!sha) throw new Error('db.csv not found in repository')

  const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/db.csv`
  const raw = await fetch(rawUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (!raw.ok) throw new Error('Failed to fetch db.csv from repository')
  const content = await raw.text()

  return { content, sha }
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
