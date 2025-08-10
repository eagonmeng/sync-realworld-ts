import { Frames } from "../engine/mod.ts";

export type Bindings = Record<string, symbol>;

export function withUserResponse(
  frames: Frames,
  response: symbol,
  { email, token, username, bio, image }: Bindings,
): Frames {
  return frames.map(($) => ({
    ...$,
    [response]: {
      status: 200,
      body: {
        user: {
          email: $[email] as unknown,
          token: $[token] as unknown,
          username: $[username] as unknown,
          bio: bio ? ($[bio] as unknown) : "",
          image: image ? ($[image] as unknown) : null,
        },
      },
    },
  })) as unknown as Frames;
}

export function withArticleResponse(
  frames: Frames,
  response: symbol,
  article: symbol,
): Frames {
  return frames.map(($) => {
    const art = $[article] as unknown as Record<string, unknown>;
    const safe: Record<string, unknown> = {
      ...(typeof art === "object" && art !== null ? art : {}),
    };
    if (!("tagList" in safe)) safe.tagList = [];
    if (!("favoritesCount" in safe)) safe.favoritesCount = 0;
    if (!("favorited" in safe)) safe.favorited = false;
    return {
      ...$,
      [response]: { status: 200, body: { article: safe } },
    };
  }) as unknown as Frames;
}

export function withArticlesResponse(
  frames: Frames,
  response: symbol,
  articles: symbol,
  articlesCount?: symbol,
): Frames {
  return frames.map(($) => {
    const arr = (($[articles] as unknown[]) || []).map((a) => {
      const art = a as Record<string, unknown>;
      return {
        ...art,
        tagList: Array.isArray(art.tagList) ? art.tagList : [],
        favoritesCount: typeof art.favoritesCount === "number"
          ? art.favoritesCount
          : 0,
        favorited: typeof art.favorited === "boolean" ? art.favorited : false,
      };
    });
    const count = arr.length;
    return {
      ...$,
      ...(articlesCount ? { [articlesCount]: count } : {}),
      [response]: {
        status: 200,
        body: {
          articles: arr,
          articlesCount: count,
        },
      },
    };
  }) as unknown as Frames;
}

export function withCommentResponse(
  frames: Frames,
  response: symbol,
  comment: symbol,
): Frames {
  return frames.map(($) => {
    const raw = $[comment] as unknown;
    let shaped: Record<string, unknown>;
    if (typeof raw === "string") {
      shaped = { id: raw };
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      // Prefer renaming `comment` field to `id` if present
      if (Object.prototype.hasOwnProperty.call(obj, "comment")) {
        const { comment: id, ...rest } = obj;
        shaped = { id, ...rest } as Record<string, unknown>;
      } else {
        shaped = obj;
      }
    } else {
      shaped = {};
    }
    return {
      ...$,
      [response]: { status: 200, body: { comment: shaped } },
    } as unknown as typeof $;
  }) as unknown as Frames;
}

export function withCommentsResponse(
  frames: Frames,
  response: symbol,
  comments: symbol,
): Frames {
  return frames.map(($) => {
    const arr = (($[comments] as unknown[]) || []).map((a) => {
      if (typeof a === "string") return { id: a } as Record<string, unknown>;
      if (a && typeof a === "object") {
        const obj = a as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(obj, "comment")) {
          const { comment: id, ...rest } = obj;
          return { id, ...rest } as Record<string, unknown>;
        }
        return obj;
      }
      return {} as Record<string, unknown>;
    });
    return {
      ...$,
      [response]: { status: 200, body: { comments: arr } },
    } as unknown as typeof $;
  }) as unknown as Frames;
}

export function withProfileResponse(
  frames: Frames,
  response: symbol,
  { username, bio, image, following }: Bindings,
): Frames {
  return frames.map(($) => ({
    ...$,
    [response]: {
      status: 200,
      body: {
        profile: {
          username: $[username] as unknown,
          bio: $[bio] as unknown,
          image: $[image] as unknown,
          following: ($[following] as unknown) || false,
        },
      },
    },
  })) as unknown as Frames;
}

export function withOkEmptyResponse(frames: Frames, response: symbol): Frames {
  return frames.map(($) => ({
    ...$,
    [response]: { status: 200, body: {} },
  })) as unknown as Frames;
}

export function withErrorsResponse(
  frames: Frames,
  response: symbol,
  errors: unknown[],
  status = 422,
): Frames {
  return frames.map(($) => ({
    ...$,
    [response]: { status, body: { errors: { body: errors } } },
  })) as unknown as Frames;
}
