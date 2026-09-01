import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { Cron, Timeout } from "@nestjs/schedule";
import { stringSimilarity } from "string-similarity-js";
import lodash from "lodash";
const { kebabCase } = lodash;
import { GamesService } from "../../../src/modules/games/games.service.js";
import type { GamevaultGame } from "../../../src/modules/games/gamevault-game.entity.js";
import configuration, { getCensoredConfiguration } from "./configuration.js";
import {
  GetOwnedGamesResponseWrapper,
  GetWishlistedGamesResponseWrapper,
  SteamGame,
  SteamWishlistItem,
} from "./models.js";

@Injectable()
export class SteamDupeFinderService implements OnModuleInit {
  private readonly logger = new Logger(SteamDupeFinderService.name);

  constructor(private readonly gamesService: GamesService) {}

  onModuleInit() {
    this.logger.log({
      message: "Loaded Steam Dupe Finder Configuration.",
      configuration: getCensoredConfiguration(),
    });
  }

  @Timeout(10 * 1000)
  async initialScan() {
    await this.findDuplicates();
  }

  @Cron(`*/${configuration.INTERVAL ?? 24 * 60} * * * *`, {
    disabled: (configuration.INTERVAL ?? 0) <= 0,
  })
  public async findDuplicates(): Promise<void> {
    try {
      this.logger.log("Starting duplicate detection.");

      const [steamGames, wishlistedGames, gamevaultGames] = await Promise.all([
        this.fetchSteamLibraryGames(),
        this.fetchSteamWishlistGames(),
        this.fetchGamevaultGames(),
      ]);

      this.logFetchResults(
        steamGames.length,
        wishlistedGames.length,
        gamevaultGames.length,
      );

      const libraryDuplicates = this.findMatchingGames(
        gamevaultGames,
        steamGames,
        "library",
      );
      const wishlistDuplicates = this.findMatchingGames(
        gamevaultGames,
        wishlistedGames,
        "wishlist",
      );

      this.logDuplicateResults(libraryDuplicates.size, wishlistDuplicates.size);
    } catch (error) {
      this.logger.error("Error during duplicate detection", error);
    }
  }

  private async fetchSteamLibraryGames(): Promise<SteamGame[]> {
    return this.fetchFromSteamAPI<GetOwnedGamesResponseWrapper>(
      `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?include_appinfo=1&key=${configuration.STEAM_API_KEY}&steamid=${configuration.STEAM_USER_ID}&format=json`,
      "Steam library",
    ).then((data) => data.response.games);
  }

  private async fetchSteamWishlistGames(): Promise<SteamWishlistItem[]> {
    return this.fetchFromSteamAPI<GetWishlistedGamesResponseWrapper>(
      `https://api.steampowered.com/IWishlistService/GetWishlist/v1?steamid=${configuration.STEAM_USER_ID}`,
      "Steam wishlist",
    ).then((data) => data.response.items);
  }

  private async fetchGamevaultGames(): Promise<GamevaultGame[]> {
    return this.gamesService.find({
      loadRelations: true,
      loadDeletedEntities: false,
    });
  }

  private async fetchFromSteamAPI<T>(url: string, context: string): Promise<T> {
    this.validateSteamConfig();

    const response = await fetch(url);
    if (!response.ok) {
      throw new BadRequestException(
        `${context} API fetch failed with ${response.status}: ${response.statusText}`,
      );
    }

    return response.json();
  }

  private findMatchingGames(
    gamevaultGames: GamevaultGame[],
    steamItems: (SteamGame | SteamWishlistItem)[],
    source: "library" | "wishlist",
  ): Set<GamevaultGame> {
    const steamGameMap = new Map(
      steamItems.map((game) => [String(game.appid), game]),
    );
    const duplicates = new Set<GamevaultGame>();

    gamevaultGames.forEach((vaultGame) => {
      const steamId = this.extractSteamAppId(vaultGame);
      if (steamId && steamGameMap.has(steamId)) {
        this.logDuplicate(vaultGame, steamId, source);
        duplicates.add(vaultGame);
        return;
      }

      this.matchByTitle(vaultGame, steamItems, steamId, source, duplicates);
    });

    return duplicates;
  }

  private matchByTitle(
    vaultGame: GamevaultGame,
    steamItems: (SteamGame | SteamWishlistItem)[],
    steamId: string | null,
    source: "library" | "wishlist",
    duplicates: Set<GamevaultGame>,
  ) {
    for (const steamItem of steamItems) {
      if (
        "name" in steamItem &&
        vaultGame.title &&
        stringSimilarity(
          kebabCase(vaultGame.title),
          kebabCase(steamItem.name),
        ) > 0.9
      ) {
        this.logDuplicate(vaultGame, steamId, source);
        duplicates.add(vaultGame);
        break;
      }
    }
  }

  private validateSteamConfig(): void {
    if (!configuration.STEAM_API_KEY || !configuration.STEAM_USER_ID) {
      throw new BadRequestException("Steam API key or User ID not configured.");
    }
  }

  private extractSteamAppId(game: GamevaultGame): string | null {
    return (
      game.metadata?.url_websites
        ?.map((url) => url.match(/store\.steampowered\.com\/app\/(\d+)/)?.[1])
        .find(Boolean) ?? null
    );
  }

  private logFetchResults(
    steamCount: number,
    wishlistCount: number,
    gamevaultCount: number,
  ) {
    this.logger.log(
      `Fetched ${steamCount} Steam games, ${wishlistCount} wishlisted games, and ${gamevaultCount} Gamevault games.`,
    );
  }

  private logDuplicateResults(libraryCount: number, wishlistCount: number) {
    this.logger.log({
      message: "Finished duplicate detection.",
      duplicates_in_library: libraryCount,
      duplicates_in_wishlist: wishlistCount,
    });
  }

  private logDuplicate(
    gamevaultGame: GamevaultGame,
    steamId: string | null,
    source: "library" | "wishlist",
  ) {
    this.logger.log({
      message: `Found possible duplicate game in ${source}.`,
      gamevault_id: gamevaultGame.id,
      gamevault_title: gamevaultGame.title,
      steam_id: steamId ?? "Unknown",
    });
  }
}
