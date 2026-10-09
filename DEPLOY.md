# Viraj Form Tutor Portal — how to put it online

Pick ONE. Both give admin + form tutor logins that share the same data.

## Option 1 — Netlify (easiest, nothing to configure)
1. Put this whole folder in a GitHub repo (keep the `netlify/functions` folder) and in Netlify choose
   **Add new site -> Import from Git**. Build command: empty. Publish directory: `.`
   (or run `netlify deploy --prod --dir=.` from this folder).
   Do not drag-and-drop the folder onto Netlify Drop - the server part is often not attached that way.
2. Open `https://YOUR-SITE.netlify.app/api` - you should see `"storage":"ok"`.
3. **Register the administrator account first** (school access code `Viraj@2026`).
   The first account ever created becomes the administrator. No environment variables are required.
4. Then protect it: Netlify -> Site configuration -> Environment variables -> add `ACCESS_CODE` (your own private code)
   and optionally `ADMIN_EMAIL`, then redeploy.

## Option 2 — GitHub Pages
GitHub Pages cannot run a login server, so use the free Google backend: follow `google-backend/SETUP.md`.

## Folder contents
```
index.html  config.js  netlify.toml  _headers  _redirects  robots.txt  package.json  .nojekyll
viraj-logo.png  viraj-icon.png  google75c4d956ec608c89.html
netlify/functions/api.mjs   <- Netlify server
google-backend/Code.gs      <- Google server (for GitHub Pages)
```
