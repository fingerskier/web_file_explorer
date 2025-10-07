# Web File Explorer

A Vite + React (with SWC and the React Compiler) playground for exploring the
local file system using the File System Access API. The UI state is coordinated
with the URL using [`ygdrassil`](https://www.npmjs.com/package/ygdrassil) so you
can deep-link directly to the current view.

The app depends on a secure context (HTTPS or `localhost`) and browsers that
implement the File System Access API. When a directory is selected its contents
are listed through a small `web-file-api` helper package that wraps the native
APIs. Selecting a file reveals actions to rename it or request that the
operating system open it in the default application.

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on [http://localhost:5173](http://localhost:5173) by
default and will open automatically.

## Available scripts

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Start the Vite development server with React Fast Refresh. |
| `npm run build` | Produce a production build in the `dist` folder. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Lint source files using ESLint (flat config). |
| `npm run deploy` | Publish the latest build to GitHub Pages (`gh-pages`). |

## Architecture notes

- **Framework** – Vite 7 + React 19 using the SWC compiler and the
  `@ls-stack/vite-plugin-react-compiler` integration for the React Compiler.
- **State routing** – `ygdrassil` provides declarative view states that map to
  URL hash parameters so the current screen (welcome, browser, rename) can be
  linked directly.
- **File access** – The custom `web-file-api` package (located in
  `packages/web-file-api`) offers typed helpers for picking directories,
  enumerating entries, requesting permissions, renaming files, and delegating to
  the OS for opening a file.
- **Styling** – Plain CSS modules inside `src/App.css` keep dependencies light
  while offering a glassmorphism-inspired layout.

## Deploying to GitHub Pages

The project ships with the `gh-pages` package and a GitHub Actions workflow
(`.github/workflows/gh-pages.yml`) that builds and publishes the app to the
`gh-pages` branch. The workflow runs automatically for pushes to the `main`
branch and can also be triggered manually from the Actions tab.

You can publish locally at any time with:

```bash
npm run deploy
```

This command builds the project and pushes the `dist` folder to the
`gh-pages` branch using the `gh-pages` CLI.

## Browser support

This demo requires a Chromium-based browser with the File System Access API
enabled. Safari and Firefox currently gate the API behind flags or do not expose
it at all, so functionality may be limited or unavailable there.
