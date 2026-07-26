import { Octokit } from 'octokit'

const OWNER = import.meta.env.VITE_GITHUB_OWNER || ''
const REPO = import.meta.env.VITE_GITHUB_REPO || ''

function createClient(token: string) {
  return new Octokit({ auth: token })
}

export async function fetchCSV(token: string) {
  const octokit = createClient(token)
  const response = await octokit.rest.repos.getContent({
    owner: OWNER,
    repo: REPO,
    path: 'db.csv',
  })
  const data = response.data as { content?: string; sha?: string }
  if (!data.content) throw new Error('db.csv not found in repository')
  return {
    content: atob(data.content.replace(/\n/g, '')),
    sha: data.sha!,
  }
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
