# GitHub Pages setup (free, about 5 minutes)

GitHub Pages only hosts web pages, so the login "server" runs for free on Google instead.
You do this once.

## A. Create the Google server
1. Go to https://script.google.com and sign in with the school Google account. Click **New project**.
2. Delete the sample code, open `google-backend/Code.gs` from this folder, copy everything and paste it in. Click **Save**.
3. Click **Deploy -> New deployment -> (gear icon) Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click **Deploy**, then **Authorize access** (Advanced -> Go to project -> Allow).
4. Copy the **Web app URL** (it ends in `/exec`).
5. Test it: paste that URL in a browser tab. You should see `{"service":"Viraj Form Tutor Portal (Google backend)", ... "storage":"ok"}`.

## B. Point the website at it
Open `config.js` and paste the URL:
```
window.VIRAJ_API = "https://script.google.com/macros/s/AKfycb.../exec";
```

## C. Publish on GitHub Pages
1. Create a GitHub repository and upload everything in this folder (the `.nojekyll` file too).
2. Repository **Settings -> Pages -> Branch: main, folder: / (root) -> Save**.
3. After a minute your site is at `https://YOUR-NAME.github.io/REPO-NAME/`.

## D. First login
- **Register the administrator account FIRST** (Create account, with the school access code `Viraj@2026`).
  The first account ever created becomes the administrator automatically.
- Then protect the site: in Apps Script -> Project Settings -> Script properties, add
  `ACCESS_CODE` = a private code of your own (tutors need it to register).
  Optionally add `ADMIN_EMAIL` = the admin's email to fix the administrator permanently.
- Admin Center: add classes, add/import learners, post messages. Tutors register, choose a class and see only that class.

## If you change Code.gs later
Deploy -> Manage deployments -> pencil icon -> Version: **New version** -> Deploy. (The URL stays the same.)

## Notes
- "Forgot password" email is not available on this server: use Admin Center -> Manage Tutors -> Reset password.
- Data lives in a private Drive file called `viraj-portal-db.json` in the Google account that deployed the script.
