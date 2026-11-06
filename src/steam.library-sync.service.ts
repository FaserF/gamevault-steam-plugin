import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, Timeout } from "@nestjs/schedule";
import fsExtra from "fs-extra";
import path from "node:path";
import sanitizeFilename from "sanitize-filename";
import { GamesService } from "../../../src/modules/games/games.service.js";
import { UsersService } from "../../../src/modules/users/users.service.js";
import { ProgressService } from "../../../src/modules/progresses/progress.service.js";
import { State } from "../../../src/modules/progresses/models/state.enum.js";
import gamevaultConfiguration from "../../../src/configuration.js";
import { SteamApiClient } from "./client/steam-api.client.js";
import { buildSteamLauncherZip } from "./client/zip-builder.util.js";
import configuration, { getCensoredConfiguration } from "./config/configuration.js";
import type { SteamGame } from "./models/steam.models.js";

const { ensureDir, pathExists, writeFile, readdir } = fsExtra;

@Injectable()
export class SteamLibrarySyncService implements OnModuleInit {
  private readonly logger = new Logger(SteamLibrarySyncService.name);
  private isSyncing = false;

  private readonly client = new SteamApiClient(
    configuration.STEAM_API_KEY,
    configuration.STEAM_USER_ID_64,
    configuration.STORE_LANGUAGE,
    configuration.STORE_COUNTRY,
  );

  constructor(
    @Inject(GamesService) private readonly gamesService: GamesService,
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(ProgressService) private readonly progressService: ProgressService,
  ) {}

  onModuleInit() {
    this.logger.log({
      message: "Initialized Steam Integration & Library Sync Service.",
      configuration: getCensoredConfiguration(),
    });
  }

  @Timeout(15 * 1000)
  async initialSync(): Promise<void> {
    await this.syncSteamLibrary();
  }

  @Cron(`*/${configuration.INTERVAL_MINUTES ?? 24 * 60} * * * *`, {
    disabled: (configuration.INTERVAL_MINUTES ?? 0) <= 0,
  })
  public async syncSteamLibrary(): Promise<void> {
    if (this.isSyncing) {
      this.logger.debug("Steam library sync already in progress. Skipping cycle.");
      return;
    }

    if (!configuration.SYNC_LIBRARY) {
      this.logger.debug("Steam library sync is disabled via configuration.");
      return;
    }

    if (!configuration.STEAM_API_KEY || !configuration.STEAM_USER_ID_64) {
      this.logger.warn(
        "Steam library sync is enabled, but STEAM_API_KEY or STEAM_USER_ID_64 is missing. Skipping sync.",
      );
      return;
    }

    this.isSyncing = true;
    try {
      this.logger.log("Starting Steam library synchronization...");
      const steamGames = await this.client.getOwnedGames();
      this.logger.log(`Fetched ${steamGames.length} owned games from Steam API.`);

      if (steamGames.length === 0) {
        this.logger.log("No owned Steam games found or library is private.");
        return;
      }

      // 1. Generate Virtual Launcher ZIPs if enabled
      if (configuration.CREATE_VIRTUAL_LAUNCHERS) {
        await this.generateVirtualLaunchers(steamGames);
      }

      // 2. Synchronize Playtime & Game Status
      await this.syncProgressAndPlaytime(steamGames);

      this.logger.log("Steam library synchronization completed successfully.");
    } catch (error) {
      this.logger.error("Failed to synchronize Steam library:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async generateVirtualLaunchers(steamGames: SteamGame[]): Promise<void> {
    const baseFilesDir =
      (gamevaultConfiguration as any)?.VOLUMES?.FILES ||
      (gamevaultConfiguration as any)?.FILES_DIR ||
      "/files";
    const filesDir = configuration.SYNC_SUBDIRECTORY
      ? path.join(baseFilesDir, configuration.SYNC_SUBDIRECTORY)
      : baseFilesDir;

    await ensureDir(filesDir);

    let createdCount = 0;
    for (const game of steamGames) {
      const sanitizedName = sanitizeFilename(game.name || `SteamApp-${game.appid}`, {
        replacement: "",
      }).trim();

      const zipFilename = `${sanitizedName} [steamid-${game.appid}].zip`;
      const targetZipPath = path.join(filesDir, zipFilename);

      if (await pathExists(targetZipPath)) {
        continue;
      }

      try {
        const zipBuffer = buildSteamLauncherZip(
          game.appid,
          game.name || `SteamApp-${game.appid}`,
        );
        await writeFile(targetZipPath, zipBuffer);
        createdCount++;
        this.logger.debug(`Created virtual launcher: ${zipFilename}`);
      } catch (err) {
        this.logger.warn(`Could not create virtual launcher for ${game.name}: ${err}`);
      }
    }

    if (createdCount > 0) {
      this.logger.log(
        `Created ${createdCount} new virtual launcher packages in ${filesDir}.`,
      );
    }
  }

  private async syncProgressAndPlaytime(steamGames: SteamGame[]): Promise<void> {
    try {
      // Find target GameVault user
      const users = await this.usersService.find();
      if (!users || users.length === 0) {
        this.logger.debug("No GameVault users registered yet. Skipping progress sync.");
        return;
      }

      const configuredUser = configuration.GAMEVAULT_USERNAME;
      const targetUser =
        (configuredUser ? users.find((u) => u.username === configuredUser) : undefined) ||
        users.find((u) => u.username === "fabian") ||
        users[0];

      if (!targetUser) {
        this.logger.debug("Target GameVault user not found for Steam progress sync.");
        return;
      }

      // Load all vault games to map against Steam appids and titles
      const vaultGames = await this.gamesService.find({ loadRelations: true });
      if (!vaultGames || vaultGames.length === 0) {
        return;
      }

      let updatedProgressCount = 0;
      for (const steamGame of steamGames) {
        const steamIdStr = String(steamGame.appid);
        const steamTitle = (steamGame.name || "").toLowerCase().trim();

        // Match by [steamid-12345], provider_data_id, or title
        const matchingGame = vaultGames.find((vg) => {
          if (vg.file_path && vg.file_path.includes(`steamid-${steamIdStr}`)) return true;
          if (vg.metadata?.provider_slug === "steam" && vg.metadata.provider_data_id === steamIdStr)
            return true;
          if (vg.title && vg.title.toLowerCase().trim() === steamTitle) return true;
          return false;
        });

        if (!matchingGame) {
          continue;
        }

        const playtimeMinutes = steamGame.playtime_forever ?? 0;
        const state = playtimeMinutes > 0 ? State.PLAYING : State.UNPLAYED;

        try {
          await this.progressService.set(
            targetUser.id,
            matchingGame.id,
            { minutes_played: playtimeMinutes, state },
            targetUser.username,
          );
          updatedProgressCount++;
        } catch (err) {
          this.logger.debug(`Could not update progress for game ID ${matchingGame.id}: ${err}`);
        }
      }

      if (updatedProgressCount > 0) {
        this.logger.log(
          `Synchronized playtime and game status for ${updatedProgressCount} games (User: ${targetUser.username}).`,
        );
      }
    } catch (err) {
      this.logger.warn(`Error during Steam progress synchronization: ${err}`);
    }
  }
}
