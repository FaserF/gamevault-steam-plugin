import type { ZipEntry } from "../models/steam.models.js";
import { getSteamLauncherExe } from "./launcher-binary.js";

/**
 * Pre-computed CRC32 lookup table for wire-speed checksums.
 */
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

/**
 * Calculates standard IEEE 802.3 CRC32 checksum for a Buffer.
 */
export function calculateCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Converts a JS Date into MS-DOS Date (16-bit) and Time (16-bit).
 */
export function dateToDosDateTime(date: Date = new Date()): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  return { time: dosTime & 0xffff, date: dosDate & 0xffff };
}

/**
 * Generates a valid, zero-compression (Store mode) PKZIP archive entirely in memory.
 * Compatible with 7-Zip, WinRAR, Windows Explorer, macOS Archive Utility, unzip, and GameVault indexer.
 */
export function buildInMemoryZip(entries: ZipEntry[], mtime: Date = new Date()): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;
  const { time: dosTime, date: dosDate } = dateToDosDateTime(mtime);

  for (const entry of entries) {
    const filenameBuf = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const dataBuf = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, "utf8");
    const crc = calculateCrc32(dataBuf);
    const length = dataBuf.length;

    // --- Local File Header (30 bytes + filename) ---
    const localHeader = Buffer.alloc(30 + filenameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);         // version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // flags (UTF-8 encoded filename)
    localHeader.writeUInt16LE(0, 8);          // compression method (0 = store)
    localHeader.writeUInt16LE(dosTime, 10);   // last mod file time
    localHeader.writeUInt16LE(dosDate, 12);   // last mod file date
    localHeader.writeUInt32LE(crc, 14);       // crc-32
    localHeader.writeUInt32LE(length, 18);    // compressed size
    localHeader.writeUInt32LE(length, 22);    // uncompressed size
    localHeader.writeUInt16LE(filenameBuf.length, 26); // file name length
    localHeader.writeUInt16LE(0, 28);         // extra field length
    filenameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, dataBuf);

    // --- Central Directory Header (46 bytes + filename) ---
    const centralHeader = Buffer.alloc(46 + filenameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4);         // version made by (2.0)
    centralHeader.writeUInt16LE(20, 6);         // version needed to extract (2.0)
    centralHeader.writeUInt16LE(0x0800, 8);     // general purpose bit flag (UTF-8)
    centralHeader.writeUInt16LE(0, 10);         // compression method (0 = store)
    centralHeader.writeUInt16LE(dosTime, 12);   // last mod file time
    centralHeader.writeUInt16LE(dosDate, 14);   // last mod file date
    centralHeader.writeUInt32LE(crc, 16);       // crc-32
    centralHeader.writeUInt32LE(length, 20);    // compressed size
    centralHeader.writeUInt32LE(length, 24);    // uncompressed size
    centralHeader.writeUInt16LE(filenameBuf.length, 28); // file name length
    centralHeader.writeUInt16LE(0, 30);         // extra field length
    centralHeader.writeUInt16LE(0, 32);         // file comment length
    centralHeader.writeUInt16LE(0, 34);         // disk number start
    centralHeader.writeUInt16LE(0, 36);         // internal file attributes
    centralHeader.writeUInt32LE(0, 38);         // external file attributes
    centralHeader.writeUInt32LE(offset, 42);    // relative offset of local header
    filenameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);
    offset += localHeader.length + dataBuf.length;
  }

  const centralDirSize = centralHeaders.reduce((sum, h) => sum + h.length, 0);

  // --- End of Central Directory Record (22 bytes) ---
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4);          // number of this disk
  eocd.writeUInt16LE(0, 6);          // number of disk with start of central directory
  eocd.writeUInt16LE(entries.length, 8);  // total entries in central dir on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries in central dir
  eocd.writeUInt32LE(centralDirSize, 12); // size of central directory
  eocd.writeUInt32LE(offset, 16);         // offset of start of central directory
  eocd.writeUInt16LE(0, 20);              // zip file comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Creates a complete virtual launcher ZIP archive for a Steam game containing
 * steam_appid.txt, launch.url, launch.cmd, launch.sh, native Windows launcher PE binaries
 * (launch.exe & <GameName>.exe), and README.txt.
 */
export function buildSteamLauncherZip(appId: number | string, gameName: string): Buffer {
  const launcherExe = getSteamLauncherExe();
  const sanitizedTitle = (gameName || "game")
    .replace(/[<>:"/\\|?*]/g, "")
    .trim() || "game";

  const entries: ZipEntry[] = [
    { name: "launch.exe", content: launcherExe },
    { name: `${sanitizedTitle}.exe`, content: launcherExe },
    { name: "steam_appid.txt", content: `${appId}\n` },
    { name: "launch.url", content: `[InternetShortcut]\nURL=steam://run/${appId}\n` },
    { name: "launch.cmd", content: `@echo off\nstart "" "steam://run/${appId}"\n` },
    {
      name: "launch.sh",
      content: `#!/usr/bin/env sh\nxdg-open "steam://run/${appId}" || open "steam://run/${appId}" 2>/dev/null || sensible-browser "steam://run/${appId}"\n`,
    },
    {
      name: "README.txt",
      content: `Steam Virtual Launcher for ${gameName}\nSteam App ID: ${appId}\nLaunch URL: steam://run/${appId}\n`,
    },
  ];

  return buildInMemoryZip(entries);
}
