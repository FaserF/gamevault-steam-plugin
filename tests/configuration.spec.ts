import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseBoolean, parseNumber, getCensoredConfiguration } from "../dist/config/configuration.js";

describe("ConfigurationUtil", () => {
  test("parses boolean environment variables with truthy and falsy strings", () => {
    assert.equal(parseBoolean("true", false), true);
    assert.equal(parseBoolean("1", false), true);
    assert.equal(parseBoolean("enable", false), true);
    assert.equal(parseBoolean("yes", false), true);

    assert.equal(parseBoolean("false", true), false);
    assert.equal(parseBoolean("0", true), false);
    assert.equal(parseBoolean("disable", true), false);
    assert.equal(parseBoolean("no", true), false);

    assert.equal(parseBoolean(undefined, true), true);
    assert.equal(parseBoolean(undefined, false), false);
  });

  test("parses numeric values correctly with bounds checking", () => {
    assert.equal(parseNumber("1440", 60), 1440);
    assert.equal(parseNumber("0", 60), 0);
    assert.equal(parseNumber("invalid", 60), 60);
    assert.equal(parseNumber("-5", 60), 60);
    assert.equal(parseNumber(undefined, 60), 60);
  });

  test("redacts sensitive Steam API keys in censored configuration", () => {
    const censored = getCensoredConfiguration();
    if (censored.STEAM_API_KEY) {
      assert.equal(censored.STEAM_API_KEY, "**REDACTED**");
    }
  });
});
