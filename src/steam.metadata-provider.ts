import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { MetadataProvider } from "../../../src/modules/metadata/providers/abstract.metadata-provider.service.js";
import { MetadataService } from "../../../src/modules/metadata/metadata.service.js";
import { GameMetadataService } from "../../../src/modules/metadata/games/game.metadata.service.js";
import { DeveloperMetadataService } from "../../../src/modules/metadata/developers/developer.metadata.service.js";
import { PublisherMetadataService } from "../../../src/modules/metadata/publishers/publisher.metadata.service.js";
import { TagMetadataService } from "../../../src/modules/metadata/tags/tag.metadata.service.js";
import { GenreMetadataService } from "../../../src/modules/metadata/genres/genre.metadata.service.js";
import { MediaService } from "../../../src/modules/media/media.service.js";
import type { MinimalGameMetadataDto } from "../../../src/modules/metadata/games/minimal-game.metadata.dto.js";
import type { GameMetadata } from "../../../src/modules/metadata/games/game.metadata.entity.js";
import type { GamevaultGame } from "../../../src/modules/games/gamevault-game.entity.js";
import type { GenreMetadata } from "../../../src/modules/metadata/genres/genre.metadata.entity.js";
import type { TagMetadata } from "../../../src/modules/metadata/tags/tag.metadata.entity.js";
import type { DeveloperMetadata } from "../../../src/modules/metadata/developers/developer.metadata.entity.js";
import type { PublisherMetadata } from "../../../src/modules/metadata/publishers/publisher.metadata.entity.js";
import type { Media } from "../../../src/modules/media/media.entity.js";
import { SteamApiClient } from "./client/steam-api.client.js";
import { HtmlToMarkdownUtil } from "./client/html-to-markdown.util.js";
import { AgeRatingUtil } from "./client/age-rating.util.js";
import configuration from "./config/configuration.js";
import type { SteamAppDetailsData } from "./models/steam.models.js";

@Injectable()
export class SteamMetadataProviderService extends MetadataProvider {
  override enabled = configuration.METADATA_ENABLED;
  override request_interval_ms = 1000;
  override readonly slug = "steam";
  override readonly name = "Steam";
  override readonly priority = configuration.METADATA_PRIORITY;

  private readonly client = new SteamApiClient(
    configuration.STEAM_API_KEY,
    configuration.STEAM_USER_ID_64,
    configuration.STORE_LANGUAGE,
    configuration.STORE_COUNTRY,
  );

  constructor(
    @Inject(MetadataService) metadataService: MetadataService,
    @Inject(GameMetadataService) gameMetadataService: GameMetadataService,
    @Inject(DeveloperMetadataService) developerMetadataService: DeveloperMetadataService,
    @Inject(PublisherMetadataService) publisherMetadataService: PublisherMetadataService,
    @Inject(TagMetadataService) tagMetadataService: TagMetadataService,
    @Inject(GenreMetadataService) genreMetadataService: GenreMetadataService,
    @Inject(MediaService) mediaService: MediaService,
  ) {
    super(
      metadataService,
      gameMetadataService,
      developerMetadataService,
      publisherMetadataService,
      tagMetadataService,
      genreMetadataService,
      mediaService,
    );
  }

  public override async search(query: string): Promise<MinimalGameMetadataDto[]> {
    if (!query || !query.trim()) {
      return [];
    }

    const items = await this.client.searchStore(query);
    return items.map((item) => ({
      title: item.name,
      provider_slug: this.slug,
      provider_data_id: String(item.id),
      cover_url: item.tiny_image,
    }));
  }

  public override async getByProviderDataIdOrFail(
    provider_data_id: string,
  ): Promise<GameMetadata> {
    const details = await this.client.getAppDetails(provider_data_id);
    if (!details) {
      return this.mapDelistedAppToMetadata(provider_data_id);
    }

    return this.mapSteamDetailsToMetadata(details);
  }

  public override async getBestMatch(
    game: GamevaultGame,
  ): Promise<MinimalGameMetadataDto> {
    const title = (game.title ?? "").replaceAll("  ", " ").trim();

    // 1. Check for explicit [steamid-12345] or [steam-12345] in title or filepath
    const titleMatch = title.match(/\[steam(?:id)?-(?<id>\d+)\]/i);
    const fileMatch = (game.file_path ?? "").match(/\[steam(?:id)?-(?<id>\d+)\]/i);
    const steamId = titleMatch?.groups?.id || fileMatch?.groups?.id;

    if (steamId) {
      this.logger.debug({
        message: `Extracted Steam AppID ${steamId} from game title/path. Using direct lookup.`,
        title,
        steamId,
      });

      try {
        const details = await this.client.getAppDetails(steamId);
        if (details) {
          return {
            title: details.name,
            provider_slug: this.slug,
            provider_data_id: steamId,
            cover_url: details.header_image,
            description: details.short_description,
          };
        }
      } catch (err) {
        this.logger.warn({
          message: `Direct Steam AppID ${steamId} lookup failed; falling back.`,
          error: err,
        });
      }

      // Fallback for delisted or non-storefront Steam items
      const cleanTitle = title.replace(/\s*\[steam(?:id)?-\d+\]/gi, "").trim();
      return {
        title: cleanTitle || `SteamApp-${steamId}`,
        provider_slug: this.slug,
        provider_data_id: steamId,
        cover_url: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamId}/header.jpg`,
        description: `Steam application (${cleanTitle || steamId}).`,
      };
    }

    // 2. Standard search via string similarity
    return super.getBestMatch(game);
  }

  private async mapDelistedAppToMetadata(appId: string): Promise<GameMetadata> {
    const storeUrl = SteamApiClient.makeStoreUrl(appId);
    const launchUri = SteamApiClient.makeLaunchUri(appId);

    let cover: Media | undefined;
    const coverCandidates = [
      `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`,
      `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
      `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`,
    ];

    for (const url of coverCandidates) {
      try {
        if (this.mediaService?.downloadByUrl) {
          cover = await this.mediaService.downloadByUrl(url);
          if (cover) break;
        }
      } catch (err) {
        this.logger.debug?.(`Could not download Steam cover from ${url}: ${err}`);
      }
    }

    const metadata: Partial<GameMetadata> = {
      title: `Steam App ${appId}`,
      provider_slug: this.slug,
      provider_data_id: appId,
      provider_data_url: storeUrl,
      url_websites: [storeUrl, launchUri],
      description: `Steam application ${appId}.`,
      developers: [],
      publishers: [],
      genres: [],
      tags: [],
      cover,
    };

    return metadata as GameMetadata;
  }

  private async mapSteamDetailsToMetadata(
    data: SteamAppDetailsData,
  ): Promise<GameMetadata> {
    const appId = String(data.steam_appid);
    const storeUrl = SteamApiClient.makeStoreUrl(appId);
    const launchUri = SteamApiClient.makeLaunchUri(appId);

    // Cover image download: prefer vertical library grid (600x900), fallback to header_image
    let cover: Media | undefined;
    const coverCandidates = [
      `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`,
      `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900_2x.jpg`,
      data.header_image,
      data.capsule_image,
    ].filter(Boolean);

    for (const url of coverCandidates) {
      try {
        if (this.mediaService?.downloadByUrl) {
          cover = await this.mediaService.downloadByUrl(url);
          if (cover) break;
        }
      } catch (err) {
        this.logger.debug?.(`Could not download Steam cover from ${url}: ${err}`);
      }
    }

    // Background image download
    let background: Media | undefined;
    const bgUrl = data.background_raw || data.background || data.screenshots?.[0]?.path_full;
    if (bgUrl && this.mediaService?.downloadByUrl) {
      try {
        background = await this.mediaService.downloadByUrl(bgUrl);
      } catch (err) {
        this.logger.debug?.(`Could not download Steam background from ${bgUrl}: ${err}`);
      }
    }

    // Age rating parse across regional rating boards (USK, steam_germany, PEGI, ESRB, etc.)
    const ageRating = AgeRatingUtil.parse(data);

    // Release date
    let releaseDate: Date | undefined;
    if (data.release_date?.date && !data.release_date.coming_soon) {
      const parsedDate = new Date(data.release_date.date);
      if (!isNaN(parsedDate.getTime())) {
        releaseDate = parsedDate;
      }
    }

    // Clean description: convert Steam HTML/BBCode into clean GameVault-compatible Markdown
    const rawDescription =
      data.about_the_game || data.detailed_description || data.short_description;
    const cleanDescription =
      HtmlToMarkdownUtil.convert(rawDescription) || data.short_description || "";

    const metadata: Partial<GameMetadata> = {
      title: data.name,
      provider_slug: this.slug,
      provider_data_id: appId,
      provider_data_url: storeUrl,
      url_websites: [storeUrl, launchUri, data.website].filter(
        (url): url is string => Boolean(url && url.trim()),
      ),
      url_screenshots: (data.screenshots ?? []).map((s) => s.path_full),
      url_trailers: (data.movies ?? [])
        .map((m) => m.mp4?.max || m.webm?.max)
        .filter((url): url is string => Boolean(url)),
      description: cleanDescription,
      developers: (data.developers ?? []).map((dev) => ({
        name: dev,
        provider_slug: this.slug,
        provider_data_id: `${appId}-dev-${dev}`,
      } as DeveloperMetadata)),
      publishers: (data.publishers ?? []).map((pub) => ({
        name: pub,
        provider_slug: this.slug,
        provider_data_id: `${appId}-pub-${pub}`,
      } as PublisherMetadata)),
      genres: (data.genres ?? []).map((g) => ({
        name: g.description,
        provider_slug: this.slug,
        provider_data_id: String(g.id),
      } as GenreMetadata)),
      tags: (data.categories ?? []).map((cat) => ({
        name: cat.description,
        provider_slug: this.slug,
        provider_data_id: String(cat.id),
      } as TagMetadata)),
      rating: data.metacritic?.score ?? undefined,
      cover,
      background,
      age_rating: ageRating,
      release_date: releaseDate,
    };

    return metadata as GameMetadata;
  }

  /**
   * Resolves the minimum age rating across all available Steam rating boards.
   */
  public static parseAgeRating(data: SteamAppDetailsData): number | undefined {
    return AgeRatingUtil.parse(data);
  }
}
