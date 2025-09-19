export interface RNG {
  readonly seedString: string;
  readonly seed: number;
  next(): number;
  nextInt(maxExclusive: number): number;
  nextRange(min: number, max: number): number;
  pick<T>(list: readonly T[]): T;
  shuffleInPlace<T>(array: T[]): void;
}

const UINT32_MAX = 0xffffffff;

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / (UINT32_MAX + 1);
  };
}

export function normalizeSeed(seedString: string): { seedString: string; seed: number } {
  const trimmed = seedString.trim() || "wanderer";
  const hashFunc = xmur3(trimmed);
  const seed = hashFunc();
  return { seedString: trimmed, seed };
}

export function rngFromString(seedString: string): RNG {
  const normalized = normalizeSeed(seedString);
  const next = mulberry32(normalized.seed);
  return {
    seedString: normalized.seedString,
    seed: normalized.seed,
    next: () => next(),
    nextInt: (maxExclusive: number) => {
      if (maxExclusive <= 0) {
        throw new Error("maxExclusive must be positive");
      }
      return Math.floor(next() * maxExclusive);
    },
    nextRange: (min: number, max: number) => {
      if (max <= min) {
        return min;
      }
      const span = max - min;
      return min + next() * span;
    },
    pick<T>(list: readonly T[]): T {
      if (list.length === 0) {
        throw new Error("Cannot pick from empty list");
      }
      const index = Math.floor(next() * list.length);
      return list[index];
    },
    shuffleInPlace<T>(array: T[]): void {
      for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    },
  };
}

export function seedFromQuery(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const seed = params.get("seed");
  return seed ? seed.trim() : null;
}
