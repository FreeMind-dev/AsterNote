# Changelog

All notable changes to this project will be documented in this file.

## [0.1.2] - 2026-03-19

### Changed

- Replaced the repository license with MIT
- Updated repository documentation and package metadata to match the MIT license

## [0.1.1] - 2026-03-19

### Fixed

- Added macOS `.icns` generation to the release pipeline so GitHub Actions can build `.dmg` and `.zip` packages reliably
- Improved release automation metadata for tagged builds

## [0.1.0] - 2026-03-19

### Added

- Local-first desktop Markdown editor built with Electron, React, TypeScript, and TipTap
- Rich-text and source editing modes for Markdown documents
- Multi-tab local file workflow with HTML and PDF export
- Integrated AI sidebar with session history and long-term memory support
- OpenAI-compatible model provider configuration
- Configurable web search providers: Brave, Tavily, Perplexity, and Google Custom Search
- Integrated terminal panel and desktop menu bar actions
- GitHub Actions workflow for Linux, Windows, and macOS package builds

### Changed

- Unified product copy and packaging metadata for GitHub distribution
- Added repository-safe local secret loading from `.env.local`
- Improved desktop packaging support for cross-platform release automation

### Security

- Removed local test API keys from persisted app settings
- Cleared local recent files and AI session history before repository publication
