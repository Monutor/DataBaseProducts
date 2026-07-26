# Admin Panel

React SPA for editing `db.csv` via GitHub API.

## Local Development

1. Copy `.env.example` to `.env` and fill in your GitHub owner/repo
2. Set `VITE_ADMIN_PASSWORD` in `.env` (password for app access)
3. Create a [Personal Access Token](https://github.com/settings/tokens) with `repo` scope
4. Run:

```bash
npm install
npm run dev
```

4. Open the URL shown in terminal, paste your PAT and start editing.

## Deploy

Push to `main` branch — GitHub Actions auto-deploys to Pages.

Set repository variables and secrets:
- `VITE_GITHUB_OWNER` — your GitHub username (variable)
- `VITE_GITHUB_REPO` — repository name (variable)
- `ADMIN_PASSWORD` — password for admin panel access (secret)
