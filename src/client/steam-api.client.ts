import { Logger } from "@nestjs/common";
import type {
  GetOwnedGamesResponseWrapper,
  GetWishlistedGamesResponseWrapper,
  SteamAppDetailsData,
  SteamAppDetailsResponse,
  SteamGame,
  SteamStoreSearchItem,
  SteamStoreSearchResponse,
  SteamWishlistItem,
} from "../models/steam.models.js";

export class SteamApiClient {
  private readonly logger = new Logger(SteamApiClient.name);
  private readonly userAgent =
    "GameVault-Steam-Plugin/2.0.0 (https://github.com/FaserF/gamevault-steam-plugin)";

  constructor(
    private readonly apiKey?: string,
    private readonly steamUserId?: string,
    private readonly defaultLanguage: string = "english",
    private readonly defaultCountry: string = "DE",
  ) {}

  public static makeLaunchUri(appId: number | string): string {
    return `steam://run/${appId}`;
  }

  public static makeInstallUri(appId: number | string): string {
    return `steam://install/${appId}`;
  }

  public static makeStoreUrl(appId: number | string): string {
    return `https://store.steampowered.com/app/${appId}`;
  }

  public static makeCommunityUrl(appId: number | string): string {
    return `https://steamcommunity.com/app/${appId}`;
  }

  /**
   * Fetches owned games from Steam Web API (IPlayerService).
   */
  public async getOwnedGames(
    apiKey: string = this.apiKey ?? "",
    steamId: string = this.steamUserId ?? "",
  ): Promise<SteamGame[]> {
    if (!apiKey || !steamId) {
      throw new Error("Steam API Key and SteamID64 are required to fetch owned games.");
    }

    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?include_appinfo=1&include_played_free_games=1&key=${encodeURIComponent(
      apiKey,
    )}&steamid=${encodeURIComponent(steamId)}&format=json`;

    const res = await this.fetchJson<GetOwnedGamesResponseWrapper>(url);
    return res?.response?.games ?? [];
  }

  /**
   * Fetches wishlist items from Steam Web API (IWishlistService).
   */
  public async getWishlist(
    steamId: string = this.steamUserId ?? "",
  ): Promise<SteamWishlistItem[]> {
    if (!steamId) {
      throw new Error("SteamID64 is required to fetch wishlist.");
    }

    const url = `https://api.steampowered.com/IWishlistService/GetWishlist/v1?steamid=${encodeURIComponent(
      steamId,
    )}`;

    const res = await this.fetchJson<GetWishlistedGamesResponseWrapper>(url);
    return res?.response?.items ?? [];
  }

  /**
   * Searches the public Steam Storefront API by term.
   */
  public async searchStore(
    term: string,
    language: string = this.defaultLanguage,
    country: string = this.defaultCountry,
  ): Promise<SteamStoreSearchItem[]> {
    if (!term || !term.trim()) {
      return [];
    }

    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
      term.trim(),
    )}&l=${encodeURIComponent(language)}&cc=${encodeURIComponent(country)}`;

    try {
      const res = await this.fetchJson<SteamStoreSearchResponse>(url);
      return res?.items ?? [];
    } catch (error) {
      this.logger.warn(`Store search failed for term "${term}": ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Retrieves full details for a given Steam App ID from Steam Storefront API.
   */
  public async getAppDetails(
    appId: number | string,
    language: string = this.defaultLanguage,
    country: string = this.defaultCountry,
  ): Promise<SteamAppDetailsData | null> {
    const id = String(appId).trim();
    if (!id || !/^\d+$/.test(id)) {
      return null;
    }

    const url = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(
      id,
    )}&l=${encodeURIComponent(language)}&cc=${encodeURIComponent(country)}`;

    try {
      const res = await this.fetchJson<SteamAppDetailsResponse>(url);
      const appRecord = res?.[id];
      if (appRecord?.success && appRecord.data) {
        return appRecord.data;
      }
      return null;
    } catch (error) {
      this.logger.warn(`App details query failed for AppID ${id}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async fetchJson<T>(
    url: string,
    timeoutMs: number = 10000,
    retries: number = 2,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
      });

      if (response.status === 429 && retries > 0) {
        this.logger.warn(`Steam API rate limited (HTTP 429). Retrying after 8s...`);
        await new Promise((resolve) => setTimeout(resolve, 8000));
        return this.fetchJson<T>(url, timeoutMs, retries - 1);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
