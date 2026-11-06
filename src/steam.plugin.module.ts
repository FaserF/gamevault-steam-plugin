import { Module } from "@nestjs/common";
import {
  type GameVaultPluginModule,
  type GameVaultPluginModuleMetadataV1,
} from "../../../src/globals.js";
import { GamesModule } from "../../../src/modules/games/games.module.js";
import { MetadataModule } from "../../../src/modules/metadata/metadata.module.js";
import { MediaModule } from "../../../src/modules/media/media.module.js";
import { UsersModule } from "../../../src/modules/users/users.module.js";
import { ProgressModule } from "../../../src/modules/progresses/progress.module.js";
import { SteamDupeFinderService } from "./steam.dupe-finder.service.js";
import { SteamLibrarySyncService } from "./steam.library-sync.service.js";
import { SteamMetadataProviderService } from "./steam.metadata-provider.js";

@Module({
  imports: [GamesModule, MetadataModule, MediaModule, UsersModule, ProgressModule],
  controllers: [],
  providers: [
    SteamMetadataProviderService,
    SteamLibrarySyncService,
    SteamDupeFinderService,
  ],
  exports: [
    SteamMetadataProviderService,
    SteamLibrarySyncService,
    SteamDupeFinderService,
  ],
})
export default class SteamPluginModule implements GameVaultPluginModule {
  metadata: GameVaultPluginModuleMetadataV1 = {
    name: "Steam Integration & Metadata Provider",
    author: "Fabian Seitz (FaserF) & Alfagun74",
    version: "2.0.0",
    description:
      "Universal Steam integration for GameVault: native metadata scraper, library sync with auto-launcher zip generation, desktop/browser launch redirection, playtime sync, and duplicate detection.",
    keywords: [
      "steam",
      "metadata",
      "library",
      "sync",
      "launcher",
      "desktop-launch",
      "playtime-sync",
      "duplicate-finder",
    ],
    license: "MIT",
    website: "https://github.com/FaserF/gamevault-steam-plugin",
  };
}
