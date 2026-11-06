/**
 * Steam Web API and Storefront API data models.
 */

export interface GetOwnedGamesResponseWrapper {
  response: GetOwnedGamesResponse;
}

export interface GetOwnedGamesResponse {
  game_count: number;
  games?: SteamGame[];
}

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url?: string;
  has_community_visible_stats?: boolean;
  playtime_windows_forever?: number;
  playtime_mac_forever?: number;
  playtime_linux_forever?: number;
  playtime_deck_forever?: number;
  rtime_last_played?: number;
  content_descriptorids?: number[];
  playtime_disconnected?: number;
  has_leaderboards?: boolean;
  playtime_2weeks?: number;
}

export interface GetWishlistedGamesResponseWrapper {
  response: GetWishlistedGamesResponse;
}

export interface GetWishlistedGamesResponse {
  items?: SteamWishlistItem[];
}

export interface SteamWishlistItem {
  appid: number;
  name?: string;
  priority: number;
  date_added: number;
}

export interface SteamStoreSearchResponse {
  total: number;
  items: SteamStoreSearchItem[];
}

export interface SteamStoreSearchItem {
  id: number;
  name: string;
  type?: string;
  tiny_image?: string;
  metascore?: string;
  price?: {
    currency?: string;
    initial?: number;
    final?: number;
    discount_percent?: number;
  };
}

export interface SteamAppDetailsResponse {
  [appid: string]: {
    success: boolean;
    data?: SteamAppDetailsData;
  };
}

export interface SteamAppDetailsData {
  type: string;
  name: string;
  steam_appid: number;
  required_age: number | string;
  is_free: boolean;
  detailed_description?: string;
  about_the_game?: string;
  short_description?: string;
  supported_languages?: string;
  header_image?: string;
  capsule_image?: string;
  background?: string;
  background_raw?: string;
  website?: string | null;
  developers?: string[];
  publishers?: string[];
  demos?: Array<{ appid: number; description: string }>;
  price_overview?: {
    currency: string;
    initial: number;
    final: number;
    discount_percent: number;
    initial_formatted: string;
    final_formatted: string;
  };
  platforms?: {
    windows: boolean;
    mac: boolean;
    linux: boolean;
  };
  metacritic?: {
    score: number;
    url: string;
  };
  categories?: Array<{ id: number; description: string }>;
  genres?: Array<{ id: string; description: string }>;
  screenshots?: Array<{
    id: number;
    path_thumbnail: string;
    path_full: string;
  }>;
  movies?: Array<{
    id: number;
    name: string;
    thumbnail: string;
    webm?: { 480: string; max: string };
    mp4?: { 480: string; max: string };
    highlight: boolean;
  }>;
  recommendations?: { total: number };
  release_date?: {
    coming_soon: boolean;
    date: string;
  };
  content_descriptors?: {
    ids: number[];
    notes: string | null;
  };
}

export interface ZipEntry {
  name: string;
  content: string | Buffer;
}

export interface DuplicateMatchResult {
  gamevaultGameId: number | string;
  gamevaultTitle: string;
  steamAppId: number;
  steamName: string;
  matchType: "id" | "exact_title" | "levenshtein_title";
  similarity?: number;
  category: "library" | "wishlist";
}
