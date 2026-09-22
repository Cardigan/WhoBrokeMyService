# Local `.ai` Mind Map Viewer

Read-only local viewer for a troubleshooting project's Markdown-backed `.ai` investigation folder.

```powershell
npm install
npm run build
npm test
npm start -- .\fixtures\sanitized-investigation
```

`npm start` accepts either a project directory containing `.ai` or the `.ai` directory itself. The server binds to `127.0.0.1`, defaults to port `4173`, and serves a frontend from `apps\web\dist` when one is available.

API: `GET /api/health`, `/api/investigation`, `/api/mind-map`, `/api/entities/:id`, `/api/events`, and `POST /api/open-editor`.
