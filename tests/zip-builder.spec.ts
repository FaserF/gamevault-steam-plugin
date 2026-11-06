import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildInMemoryZip,
  buildSteamLauncherZip,
  calculateCrc32,
  dateToDosDateTime,
} from "../dist/client/zip-builder.util.js";

describe("ZipBuilderUtil", () => {
  test("calculates standard CRC32 checksum correctly", () => {
    const data = Buffer.from("123456789", "utf8");
    const crc = calculateCrc32(data);
    // Standard CRC-32 for "123456789" is 0xCBF43926 (3421780262)
    assert.equal(crc, 3421780262);
  });

  test("converts JS date to MS-DOS date time", () => {
    const testDate = new Date(2026, 10, 6, 12, 30, 0);
    const { time, date } = dateToDosDateTime(testDate);
    assert.ok(time > 0);
    assert.ok(date > 0);
  });

  test("builds valid in-memory zip archive with proper signatures", () => {
    const zipBuffer = buildInMemoryZip([
      { name: "steam_appid.txt", content: "620\n" },
      { name: "launch.url", content: "[InternetShortcut]\nURL=steam://run/620\n" },
    ]);

    assert.ok(zipBuffer.length > 50);

    // Verify Local File Header signature (PK\x03\x04)
    assert.equal(zipBuffer.readUInt32LE(0), 0x04034b50);

    // Verify End of Central Directory signature (PK\x05\x06) at the tail
    const eocdOffset = zipBuffer.length - 22;
    assert.equal(zipBuffer.readUInt32LE(eocdOffset), 0x06054b50);
    assert.equal(zipBuffer.readUInt16LE(eocdOffset + 8), 2); // 2 total entries
    assert.equal(zipBuffer.readUInt16LE(eocdOffset + 10), 2);
  });

  test("buildSteamLauncherZip creates complete launcher package with 7 entries including native PE binaries", () => {
    const zipBuffer = buildSteamLauncherZip(2379780, "Balatro");
    assert.ok(zipBuffer.length > 5000);

    // Verify End of Central Directory signature (PK\x05\x06) at the tail
    const eocdOffset = zipBuffer.length - 22;
    assert.equal(zipBuffer.readUInt32LE(eocdOffset), 0x06054b50);
    assert.equal(zipBuffer.readUInt16LE(eocdOffset + 8), 7); // 7 total entries
    assert.equal(zipBuffer.readUInt16LE(eocdOffset + 10), 7);
  });
});
