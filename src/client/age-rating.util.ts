import type { SteamAppDetailsData } from "../models/steam.models.js";

/**
 * Utility to resolve minimum age rating across regional rating boards
 * provided by the Steam Storefront API (USK, steam_germany, PEGI, ESRB, Dejus, CERO, etc.).
 */
export class AgeRatingUtil {
  public static parse(data: SteamAppDetailsData): number | undefined {
    const ratings = data.ratings ?? {};

    // 1. USK (0, 6, 12, 16, 18)
    const uskRating =
      ratings.usk?.rating ??
      (ratings.usk?.required_age != null ? String(ratings.usk.required_age) : undefined);
    if (uskRating) {
      const parsed = Number(uskRating);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 21) {
        return parsed;
      }
    }

    // 2. steam_germany (0, 6, 12, 16, 18)
    const steamDe = ratings.steam_germany?.required_age ?? ratings.steam_germany?.rating;
    if (steamDe != null) {
      const parsed = Number(steamDe);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 21) {
        return parsed;
      }
    }

    // 3. PEGI (3, 7, 12, 16, 18)
    const pegiRating =
      ratings.pegi?.rating ??
      (ratings.pegi?.required_age != null ? String(ratings.pegi.required_age) : undefined);
    if (pegiRating) {
      const parsed = Number(pegiRating);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 21) {
        return parsed;
      }
    }

    // 4. ESRB (ec/e -> 0, e10 -> 10, t -> 13, m -> 17, ao -> 18)
    const esrbRating = ratings.esrb?.rating?.toLowerCase().trim();
    if (esrbRating) {
      const esrbMap: Record<string, number> = {
        ec: 0,
        e: 0,
        e10: 10,
        t: 13,
        m: 17,
        ao: 18,
      };
      if (esrbRating in esrbMap) {
        return esrbMap[esrbRating];
      }
      const parsed = Number(esrbRating);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 21) {
        return parsed;
      }
    }
    if (ratings.esrb?.required_age != null) {
      const parsed = Number(ratings.esrb.required_age);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 21) {
        return parsed;
      }
    }

    // 5. Dejus (Brazil: l -> 0, 10, 12, 14, 16, 18)
    const dejus = ratings.dejus?.rating?.toLowerCase().trim();
    if (dejus === "l") return 0;
    if (dejus) {
      const parsed = Number(dejus);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 21) return parsed;
    }

    // 6. CERO (Japan: a -> 0, b -> 12, c -> 15, d -> 17, z -> 18)
    const cero = ratings.cero?.rating?.toLowerCase().trim();
    const ceroMap: Record<string, number> = { a: 0, b: 12, c: 15, d: 17, z: 18 };
    if (cero && cero in ceroMap) return ceroMap[cero];

    // 7. Generic check across all other rating boards
    for (const [, val] of Object.entries(ratings)) {
      if (val && typeof val === "object") {
        if (val.required_age != null) {
          const parsed = Number(val.required_age);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 21) return parsed;
        }
        if (val.rating) {
          const parsed = Number(val.rating);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 21) return parsed;
        }
      }
    }

    // 8. Fallback: top-level required_age
    if (data.required_age != null && data.required_age !== "") {
      const parsed = Number(data.required_age);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 21) {
        return parsed;
      }
    }

    return undefined;
  }
}
