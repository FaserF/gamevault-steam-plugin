# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-11-06

### 💥 Breaking Changes
- **ESM NodeNext Architecture**: Complete refactor to pure ECMAScript Modules (`NodeNext`) required for GameVault v17.0.1+.
- **Unified Configuration Environment Variables**: Standardized configuration keys to `PLUGIN_STEAM_*` while maintaining backwards compatibility with legacy `PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_*` variables.

### ✨ New Features
- **Native Steam Metadata Provider**: Scrapes GameVault game metadata directly from Steam Storefront API (titles, descriptions, release dates, high-resolution header/capsule images, screenshots, tags, categories, developers, and publishers).
- **Automated Steam Library Synchronization**: Automatically fetches user's owned games and wishlist items via Steam Web API and creates lightweight virtual launcher packages in `/files/Steam/`.
- **Seamless Desktop & Web Launch Redirection**:
  - Automatically provisions `steam://run/<appId>` protocols for instant native launcher execution on Windows, macOS, and Linux Steam desktop clients.
  - Generates web browser store fallbacks (`https://store.steampowered.com/app/<appId>`) and Internet Shortcut (`.url`) files.
- **Zero-Dependency In-Memory Zip Engine**: Produces lightweight, valid PKZIP launcher packages in memory without external binary dependencies.
- **Auto Duplicate Detection**: Modernized and enhanced duplicate detection engine checking vault titles against Steam library and wishlist items using exact AppID matching and Levenshtein distance similarity.

### 🤖 CI/CD & Automation
- Added GitHub Actions continuous integration matrix (`Node.js 20.x & 22.x`).
- Added automated GitHub Releases workflow with semantic version calculation, automated changelog generation, and archive artifact generation.
- Added issue templates, PR template, CODEOWNERS, and local packaging helper (`build-local.ps1`).

---

## [1.1.0] - 2025-10-15

### ✨ New Features
- Added Steam Wishlist scanning support.
- Improved game title matching using IGDB external IDs.

---

## [1.0.0] - 2025-06-01

### ✨ New Features
- Initial release by Alfagun74 for GameVault duplicate checking against personal Steam library via Web API.
