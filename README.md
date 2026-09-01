# 🎮 Steam Dupe Finder Plugin

Easily identify duplicate games in your vault that are also present in your Steam library or wishlist. The plugin logs matches for review, ensuring you keep track of your collection.

> **ESM compatibility (GameVault v17.0.1+):** The GameVault backend is now ESM (NodeNext). Plugins must be compiled as ESM with explicit `.js` extensions on relative imports and `import type` for type-only imports. This plugin already follows that structure and is built together with the backend (`pnpm build`), producing a `steam-dupe-finder.plugin.module.js` entry.

## 🚀 Quick Setup

1. **Download & Install:**

   - Get the [latest release](https://github.com/Alfagun74/gamevault-steam-dupe-finder-plugin/releases/latest).
   - Extract it into your server’s mounted `plugins` directory.

2. **Obtain Your Steam API Key:**

   - Retrieve your personal Steam API Key [here](https://steamcommunity.com/dev/apikey).

3. **Set Your SteamID64:**

   - Find your SteamID64 [here](https://steamid.io).
   - Save it in the environment variable: `PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_USER_ID_64`.

4. **Configure Your API Key:**
   - Assign your Steam API Key to the environment variable: `PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_API_KEY`.

✅ You’re all set!

## 🎯 How It Works

The plugin automatically scans your Steam library and wishlist, comparing them to the games in your vault. If duplicates are detected, they are logged in the application logs for easy review.

### Enhanced Matching with IGDB

For improved accuracy, connect your GameVault Server to IGDB. This allows the plugin to use Steam IDs directly from IGDB metadata, providing:

- **Precise Matching:** Matches games based on Steam ID rather than name similarity.
- **Wishlist Checks:** Identifies games in your vault that are also on your Steam wishlist.

📌 **Note:** This plugin only logs matches—it does not modify or tag your games. Find relevant logs under the `SteamDupeFinderService` context.

### Running Without IGDB

- Without IGDB, the plugin relies on **Levenshtein distance** to identify closely named duplicates.
- **Wishlist matching is not supported** without IGDB.

## ⚙️ Usage & Customization

- **Automatic Scans:** Runs every 24 hours by default.
- **Initial Scan:** A first-time scan runs 1 minute after the server starts.
- **Disable the Plugin:** Set `PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_INTERVAL` to `0`.

## 🛠️ Configuration Options

| Environment Variable                            | Description                                                                | Default |
| ----------------------------------------------- | -------------------------------------------------------------------------- | ------- |
| `PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_API_KEY`    | Your Steam API Key ([Get it here](https://steamcommunity.com/dev/apikey)). | -       |
| `PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_USER_ID_64` | Your SteamID64 ([Find yours](https://steamid.io)).                         | -       |
| `PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_INTERVAL`   | Check interval in minutes (`0` disables the plugin).                       | `1440`  |

📌 Need Help? Check the [GitHub repository](https://github.com/Alfagun74/gamevault-steam-dupe-finder-plugin) for further support and updates!
