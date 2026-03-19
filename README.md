# AsterNote

AsterNote is a local-first desktop Markdown editor built with Electron, Vite, React, TypeScript, and TipTap. It focuses on a document-first writing workflow with rich-text editing, source mode, integrated AI, configurable web search, and a bottom terminal.

License: MIT

## Features

- Rich-text Markdown editing with source-mode toggle
- Multi-tab local file workflow
- Right sidebar with outline, document info, find/replace, and syntax help
- AI sidebar with session history, OpenAI-compatible model providers, and quick writing actions
- Configurable web search providers including Brave, Tavily, Perplexity, and Google Custom Search
- Native desktop menu bar for file, edit, view, insert, settings, window, and help actions
- Export to HTML and PDF

## Development

```bash
npm ci
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run build
```

## Packaging

Linux packages:

```bash
npm run dist:linux
```

Windows installer:

```bash
npm run dist:win
```

Note: building Windows packages from Linux requires `wine`. The bundled GitHub Actions workflow handles this by running the Windows packaging job on `windows-latest`.

Windows unpacked app without NSIS:

```bash
npm run dist:win:dir
```

Linux unpacked app:

```bash
npm run dist:linux:dir
```

macOS packages:

```bash
npm run dist:mac
```

Note: macOS packaging is best produced on a macOS runner. The bundled GitHub Actions workflow handles this on `macos-latest`.

## Icons

The desktop packaging assets live under `build/icons`. To regenerate the committed PNG and ICO files from the source SVG:

```bash
npm run generate:icons
```

This command uses ImageMagick's `convert`.

## CI

GitHub Actions workflow:

- Linux: builds `.AppImage` and `.deb`
- Windows: builds `.exe` via NSIS
- macOS: builds `.dmg` and `.zip`
- Tag builds (`v*`) upload package files to a GitHub Release

Workflow file:

- `.github/workflows/build-packages.yml`
