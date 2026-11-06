import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SteamApiClient } from "../dist/client/steam-api.client.js";

describe("SteamApiClient", () => {
  test("generates expected Steam client protocol URIs", () => {
    assert.equal(SteamApiClient.makeLaunchUri(620), "steam://run/620");
    assert.equal(SteamApiClient.makeInstallUri(620), "steam://install/620");
    assert.equal(
      SteamApiClient.makeStoreUrl(620),
      "https://store.steampowered.com/app/620",
    );
    assert.equal(
      SteamApiClient.makeCommunityUrl(620),
      "https://steamcommunity.com/app/620",
    );
  });

  test("validates missing credentials gracefully", async () => {
    const client = new SteamApiClient();
    await assert.rejects(
      async () => client.getOwnedGames("", ""),
      /Steam API Key and SteamID64 are required/,
    );
    await assert.rejects(
      async () => client.getWishlist(""),
      /SteamID64 is required/,
    );
  });
});
