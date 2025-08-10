import { Frames } from "../engine/mod.ts";

// Generate a UUID (thin wrapper for clarity and testability)
export function generateUUID(): string {
  return crypto.randomUUID();
}

// Add a freshly generated UUID bound to `out`
export function withUuid(frames: Frames, out: symbol): Frames {
  return frames.map(($) => ({
    ...$,
    [out]: generateUUID(),
  })) as unknown as Frames;
}

// Shape a common user response body
// moved to syncs/response.ts

// Filter frames requiring certain symbols to be bound (non-undefined)
export function requireBound(frames: Frames, ...symbols: symbol[]): Frames {
  return frames.filter((frame) => symbols.every((s) => frame[s] !== undefined));
}

// Project fields from an object bound at `source` into destination symbols
export function projectFromObject(
  frames: Frames,
  source: symbol,
  mapping: Record<string, symbol>,
): Frames {
  return frames.map((frame) => {
    const obj = (frame[source] as Record<string, unknown>) || {};
    const next: Record<symbol, unknown> = { ...frame } as unknown as Record<
      symbol,
      unknown
    >;
    for (const [key, dest] of Object.entries(mapping)) {
      next[dest] = obj[key];
    }
    return next as typeof frame;
  }) as unknown as Frames;
}
