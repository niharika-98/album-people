# Public deployment

Public app: https://album-people.onrender.com/  
Source: https://github.com/niharika-98/album-people

The current deployment is a free Node web service in Singapore, connected using Render's **Public Git Repository** option. Build command: `node --check server.cjs`. Start command: `node server.cjs`. Environment: `NODE_VERSION=22`. This connection does not automatically deploy every GitHub commit; use **Manual Deploy → Deploy latest commit** after app changes, or configure a Blueprint/Git provider integration for automatic deployments.

Deploy the UI and Node backend together to preserve shared-album link import. GitHub Pages alone cannot execute the importer or image proxy.

## GitHub + Render free web service

1. Create a public repository named `album-people` under `niharika-98` and push the project source.
2. Sign in to Render and choose **New → Blueprint**. Connect the GitHub repository. `render.yaml` defines one free Node web service with no database or disk.
3. Review that the plan is **Free**, then deploy. Use the returned `https://…onrender.com` URL to open the app. Render's `RENDER_EXTERNAL_URL` supplies the accepted public origin automatically.
4. Add the deployed link to the GitHub repository's **About → Website** and README. Visitors open that link to use the app; the repository URL displays source code.

No Google client ID is required for album import, browser face grouping, matching-photo links, ZIP exports, or manual Drive upload. Optional automated Google Photos uploads need a separate OAuth setup; without it the dialog explains that setup is missing.

## Configuration

- `PORT`: platform-provided server port; defaults to 3000 locally.
- `HOST`: defaults to loopback locally; Render sets it to `0.0.0.0`.
- `APP_ORIGIN`: exact HTTPS app URL on another host. Render's `RENDER_EXTERNAL_URL` is used when this is unset.
- `GOOGLE_CLIENT_ID`: optional; not required for the client-ID-free workflows.

Imports/images/export jobs are isolated per visitor using an HttpOnly session cookie. Sessions expire after two hours of inactivity; capacity is 100 concurrent sessions. Importing another album in the same browser session replaces that session's current photos. Face descriptors stay in browser memory. Server restarts expire photo links and export progress, so users must reimport. No photo or face data is committed to GitHub or persisted to a server disk.

## Practical limits

Render's free service sleeps after 15 idle minutes and may take about a minute to wake. Free hosting has usage limits; choose a paid plan only if you deliberately want it. The importer depends on Google's undocumented public-album page format, pagination is not implemented, and face groups are estimates. This deployment preserves current app functionality and limitations.

Run `npm test` before publication. Check `/health`, import a shared album, scan faces, select a person, and verify a ZIP or original-photo link on the deployed URL before describing the deployment as verified.
