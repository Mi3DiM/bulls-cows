# Deployment

The game is a **static site**. `npm run build` produces a `dist/` folder that
is the entire application: no server, no function, no environment variable,
no database.

```bash
npm ci
npm run build
# → dist/
```

Every host below serves that same folder.

---

## 1. GitHub Pages

### Automatic

The repository already contains
[`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml).
It builds and publishes on every push to `main`.

1. Go to **Settings → Pages**
2. Under **Source**, choose **GitHub Actions**
3. Push to `main`

The site appears at `https://<user>.github.io/<repo>/`.

### Why the path prefix matters

On GitHub Pages the app is served from `https://<user>.github.io/<repo>/`,
so every asset URL needs the repository segment. `vite.config.js` reads the
`GITHUB_REPOSITORY` environment variable that the workflow provides and
derives the base path from it:

```js
const repo = process.env.GITHUB_REPOSITORY;
const base = repo ? `/${repo.split('/')[1]}/` : '/';
```

On Netlify and Vercel the app lives at the domain root, so `base` stays `/`.

### Manual

```bash
npm ci
npm run build
# upload the contents of dist/ to the gh-pages branch
```

---

## 2. Netlify

### From the command line

```bash
npx netlify-cli deploy --prod --dir=dist
```

### From the repository

Connect the repository in the Netlify UI. Everything it needs is already in
[`netlify.toml`](../netlify.toml):

| Setting           | Value           |
| ----------------- | --------------- |
| Build command     | `npm run build` |
| Publish directory | `dist`          |
| Node version      | `22.12.0`       |

### A note on the redirect

`netlify.toml` sends every unmatched path to `index.html`. The game uses
query parameters (`/?room=K7P4`) rather than paths, so this is a safety net
rather than a requirement — but it means a hand-typed `/whatever` still lands
on the game instead of a 404.

---

## 3. Vercel

### From the command line

```bash
npx vercel --prod
```

### From the repository

Import the repository in the Vercel UI. [`vercel.json`](../vercel.json)
already declares the build command, the output directory and the headers.

---

## 4. Any other static host

Upload the contents of `dist/` to any web server. There is nothing else to
configure.

Two things to keep in mind:

- **HTTPS is required.** Browsers only allow WebRTC on secure origins
  (HTTPS, or `http://localhost` during development). A game served over
  plain HTTP will not connect to anyone.
- **The signaling server must be reachable.** PeerJS's public server is
  `0.peerjs.com` over port 443. If your users cannot reach it, point
  `SIGNALING_HOST` in `src/config.js` at your own PeerServer.

---

## 5. A self-hosted signaling server (optional)

The public server is free and fine for a small game, but it is a shared
resource in the EU. If you want your own, run the
[PeerServer](https://github.com/peerjs/peerjs-server):

```bash
npx peerjs-server --port 443 --path /peerjs
```

Then change one line in `src/config.js`:

```js
export const SIGNALING_HOST = 'signal.example.com';
```

Nothing else changes. The game traffic is direct peer-to-peer either way.

---

## 6. After deploying

| Check                    | How                                                                   |
| ------------------------ | --------------------------------------------------------------------- |
| The game loads           | Open the deployed URL.                                                |
| A room can be created    | Click **Create room**; a four-character code appears.                 |
| A guest can join         | Open the share link in another browser or on a phone.                 |
| The camera is not needed | The game uses data channels only — no `getUserMedia`.                 |
| It works on a phone      | Open the share link on a phone on mobile data, not on the same Wi-Fi. |

The last one is the real test: a Wi-Fi-to-Wi-Fi connection is the easy case.
Mobile data is where NAT traversal actually matters.

---

## 7. Continuous deployment

The CI workflow in
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs every gate on
each push. The Pages workflow deploys. For Netlify and Vercel, connect the
repository to their own CI and they will build the same way.
