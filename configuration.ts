export function parseNumber(
  environmentVariable: string | undefined,
  defaultValue?: number,
): number | undefined {
  const number = Number(environmentVariable);
  if (isNaN(number) || number < 0 || number > Number.MAX_SAFE_INTEGER) {
    return defaultValue ?? undefined;
  }
  return number;
}

const configuration = {
  STEAM_USER_ID: process.env.PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_USER_ID_64,
  STEAM_API_KEY: process.env.PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_API_KEY,
  INTERVAL: parseNumber(
    process.env.PLUGIN_ALFAGUN74_STEAM_DUPE_FINDER_INTERVAL,
    24 * 60,
  ),
} as const;

export function getCensoredConfiguration() {
  const censoredConfig = JSON.parse(
    JSON.stringify(configuration, (_k, v) => (v === undefined ? null : v)),
  );
  censoredConfig.STEAM_API_KEY = censoredConfig.STEAM_API_KEY
    ? "**REDACTED**"
    : null;
  return censoredConfig;
}

export default configuration;
