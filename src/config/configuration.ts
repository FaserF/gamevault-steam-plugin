export function parseNumber(value: unknown, defaultValue?: number, min?: number): number | undefined {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const parsed = Number(value);
  if (isNaN(parsed) || (min !== undefined && parsed < min) || parsed < 0) {
    return defaultValue;
  }
  return parsed;
}

export function parseBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return defaultValue;

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "1":
    case "true":
    case "yes":
    case "y":
    case "on":
    case "enable":
    case "enabled":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
    case "disable":
    case "disabled":
      return false;
    default:
      return defaultValue;
  }
}

const configuration = {
  // Steam Credentials
  STEAM_API_KEY:
    process.env.PLUGIN_STEAM_API_KEY ||
    process.env.PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_API_KEY,
  STEAM_USER_ID_64:
    process.env.PLUGIN_STEAM_USER_ID_64 ||
    process.env.PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_USER_ID_64,

  // Automation & Library Synchronization
  SYNC_LIBRARY: parseBoolean(process.env.PLUGIN_STEAM_SYNC_LIBRARY, true),
  CREATE_VIRTUAL_LAUNCHERS: parseBoolean(
    process.env.PLUGIN_STEAM_CREATE_VIRTUAL_LAUNCHERS ??
      process.env.PLUGIN_STEAM_AUTO_CREATE_FILES,
    true,
  ),
  SYNC_SUBDIRECTORY: process.env.PLUGIN_STEAM_FILES_DIR || "Steam",
  INTERVAL_MINUTES: parseNumber(
    process.env.PLUGIN_STEAM_INTERVAL ??
      process.env.PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_INTERVAL,
    24 * 60,
  ),
  GAMEVAULT_USERNAME: process.env.PLUGIN_STEAM_GAMEVAULT_USERNAME || "fabian",

  // Duplicate Finder & Wishlist Comparison
  COMPARE_WISHLIST: parseBoolean(
    process.env.PLUGIN_STEAM_COMPARE_WISHLIST ??
      process.env.PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_COMPARE_WISHLIST,
    true,
  ),
  MIN_SIMILARITY: parseNumber(process.env.PLUGIN_STEAM_MIN_SIMILARITY, 0.75) ?? 0.75,

  // Native Metadata Scraper
  METADATA_ENABLED: parseBoolean(process.env.PLUGIN_STEAM_METADATA_ENABLED, true),
  METADATA_PRIORITY: parseNumber(process.env.PLUGIN_STEAM_METADATA_PRIORITY, 10) ?? 10,
  STORE_LANGUAGE: process.env.PLUGIN_STEAM_STORE_LANGUAGE || "german",
  STORE_COUNTRY: process.env.PLUGIN_STEAM_STORE_COUNTRY || "DE",
} as const;

export function getCensoredConfiguration(): Record<string, unknown> {
  const censoredConfig: Record<string, unknown> = {
    ...configuration,
    STEAM_API_KEY: configuration.STEAM_API_KEY ? "**REDACTED**" : null,
    STEAM_USER_ID_64: configuration.STEAM_USER_ID_64
      ? `${configuration.STEAM_USER_ID_64.substring(0, 4)}...${configuration.STEAM_USER_ID_64.slice(-4)}`
      : null,
  };
  return censoredConfig;
}

export default configuration;
