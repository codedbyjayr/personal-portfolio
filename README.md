# ROOT@PORTFOLIO:~#

Terminal / cyber-brutalist developer portfolio of **Julia Rose L. Maghanoy**, a cybersecurity and software developer based in Iligan City, PH.

Live site: `https://YOUR-DOMAIN.vercel.app` (replace after deploying)

## Features

- **Live GitHub data** for [`codedbyjayr`](https://github.com/codedbyjayr): stars, repos, followers, 1-year contribution grid, language mix, recent repos and a live event feed, so visitors never have to leave the site.
- **Pinned project**: `myimcc-portal` (Capstone 1) with repo and demo links.
- **Experience_Log**: filterable timeline of school awards, volunteering, competitions and work, with Facebook/LinkedIn/GitHub links and `VIEW_SCAN` buttons.
- **Credential_Vault**: scanned certificates as filterable cards with a full-size viewer (prev/next, arrow keys, Esc to close).
- **Contact form** through Formspree, with validation and a honeypot spam field.
- **Aesthetic**: black `#000`, matrix green `#00FF41`, cyan, magenta and yellow accents, Courier monospace, zero border-radius, hard offset shadows. Includes Matrix rain, typewriter text, a glitching hooded-hacker avatar (click to unmask), a "getting hacked" intro and a "SYSTEM COMPROMISED" takeover about once a minute.
- **Accessibility**: skip link, keyboard-friendly controls, ARIA labels, native `<dialog>` for the viewer, and all motion effects switched off for `prefers-reduced-motion`.

## Tech stack

HTML5, CSS3 and vanilla JavaScript (ES6+), with no framework and no build step. Hosted on Vercel as a static site, deployed from the `main` branch on GitHub.

## Project structure

```
/
├── index.html        # Single-page layout (semantic sections)
├── style.css         # Design tokens, brutalist UI, effects
├── script.js         # GitHub feed, vault, experience log, form, effects
├── vercel.json       # Security headers
├── README.md
└── assets/
    ├── profile/      # pic1.jpeg, hacker.svg, og-image.png
    └── certs/        # <name>.jpg + <name>-thumb.jpg for every certificate
```

## Run locally

Any static server works. Open the page over `http://`, not by double-clicking the file.

```bash
npx serve .
# or
python3 -m http.server 3000
# or use the VS Code "Live Server" extension
```

Open `http://localhost:3000/index.html?intro` to replay the hack intro.

## Configuration

Everything you will edit lives in `script.js`.

| What | Where |
| --- | --- |
| GitHub username | `const GH` |
| Contact form | `FORMSPREE_ID` (the part after `/f/` from your Formspree form) |
| Pinned project links | `PIN_LINKS` |
| Certificates | `CERTS` list |
| Experience entries | `XP` list (set `draft: true` to hide an entry) |
| Takeover timing | `BREACH_EVERY_MS`, `BREACH_DURATION_MS` |
| Matrix rain words | `WORDS` inside `initMatrix()` |

### Add a certificate

1. Save the scan as `assets/certs/<name>.jpg` (about 1600 px wide) and `assets/certs/<name>-thumb.jpg` (about 520 px wide). Both files are required.
2. Add a line to `CERTS` with `title`, `issuer`, `date` (`YYYY-MM-DD`), `cat` (`school`, `cybersec`, `ai`, `dev` or `creative`), `type`, `img: '<name>'` and `status`.
3. To show it in the Experience_Log too, add `cert: '<name>'` to that entry in `XP`.

### Add an experience entry

Copy a line in `XP`. Use `cat: 'school' | 'volunteer' | 'competition' | 'work'`, a `YYYY-MM-DD` date, and paste URLs into `links: [...]`. Button labels are chosen automatically (`VIEW_ON_FACEBOOK`, `VIEW_ON_LINKEDIN`, `VIEW_ON_GITHUB`, `OPEN_DEMO`). Only `https://` links are accepted. Set Facebook posts to Public so visitors can open them without logging in.

## Data sources and limits

- GitHub REST API (`api.github.com`) for profile, repos and public events. Unauthenticated requests are limited to 60 per hour per visitor, so responses are cached for 10 minutes in `sessionStorage`.
- Contribution calendar from [github-contributions-api.jogruber.de](https://github-contributions-api.jogruber.de) (third party), because GitHub's REST API has no calendar endpoint.
- If a source fails, only its section shows an offline message.

## Deploy to Vercel

1. Push to GitHub:
   ```bash
   git add .
   git commit -m "feat: deploy portfolio"
   git push origin main
   ```
2. In Vercel, choose **Add New > Project**, import the repo, set the Framework Preset to **Other**, leave the build command empty and deploy.
3. Update `YOUR-DOMAIN` in the Open Graph and canonical tags in `index.html`, then add `assets/profile/og-image.png` (about 1200×630) for link previews.

All asset paths are relative (`./assets/...`) and file names are case-sensitive on Vercel, so keep them lowercase and exact.

## Commit style

Semantic messages: `feat: add experience filters`, `fix: resolve relative image path for vercel deployment`, `style: update terminal brutalist shadow offsets`.

## Notes

The certificate images and personal photos in `assets/` are personal documents and are not licensed for reuse. Code is free to read and learn from.
