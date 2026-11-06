import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AgeRatingUtil } from "../dist/client/age-rating.util.js";
import type { SteamAppDetailsData } from "../dist/models/steam.models.js";

describe("SteamAgeRatingResolution", () => {
  it("resolves USK age rating 18", () => {
    const data = {
      steam_appid: 292030,
      name: "The Witcher 3",
      required_age: 18,
      ratings: {
        usk: { rating: "18", required_age: "18" },
        pegi: { rating: "18", required_age: "18" },
      },
    } as unknown as SteamAppDetailsData;

    assert.equal(AgeRatingUtil.parse(data), 18);
  });

  it("resolves USK / steam_germany age rating 0 (all ages / Balatro)", () => {
    const data = {
      steam_appid: 2379780,
      name: "Balatro",
      required_age: 0,
      ratings: {
        dejus: { rating: "l", required_age: "0" },
        steam_germany: { rating: "0", required_age: "0" },
      },
    } as unknown as SteamAppDetailsData;

    assert.equal(AgeRatingUtil.parse(data), 0);
  });

  it("resolves CS2 rating when required_age is 0 but usk is 16", () => {
    const data = {
      steam_appid: 730,
      name: "Counter-Strike 2",
      required_age: 0,
      ratings: {
        usk: { rating: "16" },
        steam_germany: { required_age: "16" },
      },
    } as unknown as SteamAppDetailsData;

    assert.equal(AgeRatingUtil.parse(data), 16);
  });

  it("maps ESRB letter ratings to numeric age (T -> 13, M -> 17, E -> 0)", () => {
    const dataT = {
      steam_appid: 1,
      name: "Teen Game",
      ratings: { esrb: { rating: "t" } },
    } as unknown as SteamAppDetailsData;
    assert.equal(AgeRatingUtil.parse(dataT), 13);

    const dataM = {
      steam_appid: 2,
      name: "Mature Game",
      ratings: { esrb: { rating: "m" } },
    } as unknown as SteamAppDetailsData;
    assert.equal(AgeRatingUtil.parse(dataM), 17);

    const dataE = {
      steam_appid: 3,
      name: "Everyone Game",
      ratings: { esrb: { rating: "e" } },
    } as unknown as SteamAppDetailsData;
    assert.equal(AgeRatingUtil.parse(dataE), 0);
  });

  it("returns undefined when no rating is available", () => {
    const data = {
      steam_appid: 999,
      name: "Unrated Indie Game",
    } as unknown as SteamAppDetailsData;

    assert.equal(AgeRatingUtil.parse(data), undefined);
  });
});
