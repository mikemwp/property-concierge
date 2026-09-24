import { auStubPack } from "./au-stub";
import { auUkMarketPack } from "./au-uk";
import { ewMarketPack } from "./ew";
import { ukAuMarketPack } from "./uk-au";
import { ukUsMarketPack } from "./uk-us";
import { usUkMarketPack } from "./us-uk";
import { MarketPackError, type MarketPack } from "./types";

/** The only place in TypeScript that names the v1 market. */
export const DEFAULT_MARKET_PACK_ID = "ew";

/** Sorted ids of the enabled bidirectional corridor packs. The au stub is not in this list. */
export const CORRIDOR_PACK_IDS = ["au_uk", "uk_au", "uk_us", "us_uk"] as const;

const PACKS: readonly MarketPack[] = [
  ewMarketPack,
  auStubPack,
  auUkMarketPack,
  usUkMarketPack,
  ukAuMarketPack,
  ukUsMarketPack,
];

export function listMarketPacks(): MarketPack[] {
  return [...PACKS].sort((left, right) => left.id.localeCompare(right.id));
}

export function findMarketPack(id: string): MarketPack | null {
  return PACKS.find((pack) => pack.id === id) ?? null;
}

/** Fail closed: unknown ids and disabled packs both refuse to back a case. */
export function resolveMarketPack(id: string): MarketPack {
  const pack = findMarketPack(id);
  if (!pack) {
    throw new MarketPackError(`Unknown market pack: ${id}`);
  }
  if (!pack.enabled) {
    throw new MarketPackError(`Market pack is not enabled: ${id}`);
  }
  return pack;
}
