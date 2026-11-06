import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, Timeout } from "@nestjs/schedule";
import { stringSimilarity } from "string-similarity-js";
import lodash from "lodash";
const { kebabCase } = lodash;
import { GamesService } from "../../../src/modules/games/games.service.js";
import type { GamevaultGame } from "../../../src/modules/games/gamevault-game.entity.js";
import { SteamApiClient } from "./client/steam-api.client.js";
import configuration, { getCensoredConfiguration } from "./config/configuration.js";
import type {
  DuplicateMatchResult,
  SteamGame,
  SteamWishlistItem,
} from "./models/steam.models.js";

@Injectable()
export class SteamDupeFinderService implements OnModuleInit {
  private readonly logger = new Logger(SteamDupeFinderService.name);

  private readonly client = new SteamApiClient(
    configuration.STEAM_API_KEY,
    configuration.STEAM_USER_ID_64,
    configuration.STORE_LANGUAGE,
    configuration.STORE_COUNTRY,
  );

  constructor(private readonly gamesService: GamesService) {}

  onModuleInit() {
    this.logger.log({
      message: "Loaded Steam Duplicate Finder Service.",
      configuration: getCensoredConfiguration(),
    });
  }

  @Timeout(30 * 1000)
  async initialScan() {
    await this.findDuplicates();
  }

  @Cron(`*/${configuration.INTERVAL_MINUTES ?? 24 * 60} * * * *`, {
    disabled: (configuration.INTERVAL_MINUTES ?? 0) <= 0,
  })
  public async findDuplicates(): Promise<DuplicateMatchResult[]> {
    if (!configuration.STEAM_API_KEY || !configuration.STEAM_USER_ID_64) {
      this.logger.debug(
        "Duplicate search skipped: STEAM_API_KEY or STEAM_USER_ID_64 is not set.",
      );
      return [];
    }

    this.logger.log("Initiating Steam duplicate and wishlist scan...");
    try {
      const [ownedGames, wishlistItems, vaultGames] = await Promise.all([
        this.client.getOwnedGames().catch((err) => {
          this.logger.warn(`Could not fetch Steam owned games: ${err}`);
          return [] as SteamGame[];
        }),
        configuration.COMPARE_WISHLIST
          ? this.client.getWishlist().catch((err) => {
              this.logger.warn(`Could not fetch Steam wishlist: ${err}`);
              return [] as SteamWishlistItem[];
            })
          : Promise.resolve([] as SteamWishlistItem[]),
        this.gamesService.find(),
      ]);

      const duplicates = this.matchVaultToSteam(vaultGames, ownedGames, wishlistItems);

      this.logger.log({
        message: `Found ${duplicates.length} duplicate or wishlist matches.`,
        duplicates: duplicates.map((d) => ({
          vaultTitle: d.gamevaultTitle,
          steamTitle: d.steamName,
          appId: d.steamAppId,
          similarity: d.similarity ? d.similarity.toFixed(2) : "1.00",
          category: d.category,
        })),
      });

      return duplicates;
    } catch (error) {
      this.logger.error("Error executing Steam duplicate scan:", error);
      return [];
    }
  }

  public matchVaultToSteam(
    vaultGames: GamevaultGame[],
    ownedGames: SteamGame[],
    wishlistItems: SteamWishlistItem[],
  ): DuplicateMatchResult[] {
    const results: DuplicateMatchResult[] = [];
    const minSimilarity = configuration.MIN_SIMILARITY;

    for (const vaultGame of vaultGames) {
      const rawTitle = vaultGame.title ?? "";
      if (vaultGame.file_path && vaultGame.file_path.includes("[steamid-")) {
        continue;
      }

      const cleanVaultTitle = kebabCase(rawTitle);
      if (!cleanVaultTitle) continue;

      // 1. Check Owned Games
      for (const steamGame of ownedGames) {
        const cleanSteamTitle = kebabCase(steamGame.name);
        if (!cleanSteamTitle) continue;

        const similarity = stringSimilarity(cleanVaultTitle, cleanSteamTitle);
        if (similarity >= minSimilarity) {
          results.push({
            gamevaultGameId: vaultGame.id,
            gamevaultTitle: rawTitle,
            steamAppId: steamGame.appid,
            steamName: steamGame.name,
            matchType: similarity === 1 ? "exact_title" : "levenshtein_title",
            similarity,
            category: "library",
          });
          break;
        }
      }

      // 2. Check Wishlist
      if (configuration.COMPARE_WISHLIST) {
        for (const wishItem of wishlistItems) {
          const wishName = wishItem.name || "";
          const cleanWishTitle = kebabCase(wishName);
          if (!cleanWishTitle) continue;

          const similarity = stringSimilarity(cleanVaultTitle, cleanWishTitle);
          if (similarity >= minSimilarity) {
            results.push({
              gamevaultGameId: vaultGame.id,
              gamevaultTitle: rawTitle,
              steamAppId: wishItem.appid,
              steamName: wishName,
              matchType: similarity === 1 ? "exact_title" : "levenshtein_title",
              similarity,
              category: "wishlist",
            });
            break;
          }
        }
      }
    }

    return results;
  }
}
