import { actions, Frames, Vars } from "../engine/mod.ts";
import { API, Article, Favorite, JWT, Tag, User } from "./context.ts";
import { projectFromObject, withUuid } from "./helpers.ts";
import { withArticleResponse, withArticlesResponse } from "./response.ts";

const ValidateArticleCreation = (
  { request, token }: Vars,
) => ({
  when: actions(
    [API.request, { method: "POST", path: "/api/articles" }, { request }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    return await frames.query(API._get, { request }, { token });
  },
  then: actions(
    [JWT.verify, { token }],
  ),
});

// Attach tags to the newly created article based on request body tagList
const AttachTagsOnCreate = (
  { request, articleId, articlePayload, tagList, tag }: Vars,
) => ({
  when: actions(
    [API.request, { method: "POST", path: "/api/articles" }, { request }],
    [Article.create, {}, { article: articleId }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const withReq = await frames.query(API._get, { request }, {
      article: articlePayload,
    });
    const withList = projectFromObject(withReq, articlePayload, { tagList });
    const expanded = await withList.reduce<Promise<Frames>>(async (accP, $) => {
      const acc = await accP;
      const list = Array.isArray($[tagList]) ? ($[tagList] as unknown[]) : [];
      for (const t of list) {
        if (typeof t === "string" && t.trim().length > 0) {
          acc.push({ ...$, [tag]: t.trim() } as unknown as typeof $);
        }
      }
      return acc;
    }, Promise.resolve(new Frames()));
    return expanded;
  },
  then: actions(
    [Tag.add, { target: articleId, tag }],
  ),
});

const CreateArticleAction = (
  {
    request,
    token,
    currentUser,
    title,
    description,
    body,
    tagList,
    article,
  }: Vars,
) => ({
  when: actions(
    [API.request, { method: "POST", path: "/api/articles" }, { request }],
    [JWT.verify, { token }, { user: currentUser }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const reqFrames = await frames.query(API._get, { request }, {
      token,
      article,
    });
    const projected = projectFromObject(
      reqFrames,
      article,
      { title, description, body, tagList } as Record<string, symbol>,
    );
    return withUuid(projected, article);
  },
  then: actions(
    [
      Article.create,
      { article, author: currentUser, title, description, body },
    ],
  ),
});

const ArticleCreationError = ({ request, error, response }: Vars) => ({
  when: actions(
    [API.request, { method: "POST", path: "/api/articles" }, { request }],
    [Article.create, {}, { error }],
  ),
  where: (frames: Frames): Frames => {
    return frames.map(($) => ({
      ...$,
      [response]: {
        status: 422,
        body: { errors: { body: [$[error] as unknown] } },
      },
    }));
  },
  then: actions(
    [API.response, { request, output: response }],
  ),
});

const ArticleCreationUnauthorized = (
  { request, error, response }: Vars,
) => ({
  when: actions(
    [API.request, { method: "POST", path: "/api/articles" }, { request }],
    [JWT.verify, {}, { error }],
  ),
  where: (frames: Frames): Frames =>
    frames.map(($) => ({
      ...$,
      [response]: {
        status: 401,
        body: { errors: { body: [$[error] as unknown] } },
      },
    })) as unknown as Frames,
  then: actions(
    [API.response, { request, output: response }],
  ),
});

const FormatArticleCreationResponse = (
  {
    request,
    article,
    response,
    articleObj,
    articleId,
    title,
    description,
    body: bodyContent,
    slug,
    createdAt,
    updatedAt,
    author,
    tagList: _tagList,
    favoritesCount: _favoritesCount,
    articleObj: _articleObj2,
  }: Vars,
) => ({
  when: actions(
    [API.request, { method: "POST", path: "/api/articles" }, { request }],
    [Article.create, {}, { article }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const detailed = await frames.query(Article._get, { article }, {
      article: articleId,
      title,
      description,
      body: bodyContent,
      slug,
      createdAt,
      updatedAt,
      author,
    });
    // Derive tagList from Tag concept for creation response
    const shaped = await detailed.reduce<Promise<Frames>>(async (accP, $) => {
      const acc = await accP;
      const tagDocs = await Tag._getByTarget({
        target: $[articleId] as string,
      });
      const tags = tagDocs.map((d) => d.tag);
      acc.push(
        {
          ...$,
          [articleObj]: {
            article: $[articleId],
            title: $[title],
            description: $[description],
            body: $[bodyContent],
            slug: $[slug],
            createdAt: $[createdAt],
            updatedAt: $[updatedAt],
            author: $[author],
            tagList: tags,
            favoritesCount: 0,
          },
        } as unknown as typeof $,
      );
      return acc;
    }, Promise.resolve(new Frames()));
    return withArticleResponse(shaped, response, articleObj);
  },
  then: actions([API.response, { request, output: response }]),
});

const ListArticles = (
  {
    request,
    tag,
    author,
    favorited,
    limit,
    offset,
    token,
    currentUser,
    articles,
    articlesCount,
    response,
  }: Vars,
) => ({
  when: actions(
    [
      API.request,
      {
        method: "GET",
        path: "/api/articles",
        tag,
        author,
        favorited,
        limit,
        offset,
      },
      { request },
    ],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const withToken = await frames.query(API._get, { request }, { token });
    const withAll = await withToken.query(Article._listAll, {}, { articles });

    const byAuthor = await withAll.reduce<Promise<Frames>>(async (accP, $) => {
      const acc = await accP;
      let arr = ($[articles] as unknown as Array<Record<string, unknown>>) ||
        [];
      if (typeof $[author] === "string" && $[author] !== "") {
        const users = await User._getByName({
          name: ($[author] as unknown as string),
        });
        const authorId = users[0]?.user as string | undefined;
        arr = authorId ? arr.filter((a) => a.author === authorId) : [];
      }
      acc.push({ ...$, [articles]: arr } as unknown as typeof $);
      return acc;
    }, Promise.resolve(new Frames()));

    const byTag = await byAuthor.reduce<Promise<Frames>>(async (accP, $) => {
      const acc = await accP;
      let arr = ($[articles] as unknown as Array<Record<string, unknown>>) ||
        [];
      if (typeof $[tag] === "string" && $[tag] !== "") {
        const tagVal = $[tag] as unknown as string;
        const targets = await Tag._getTargetsByTag({ tag: tagVal });
        const targetSet = new Set(targets.map((t) => t.target));
        arr = arr.filter((a) => targetSet.has(a.article as string));
      }
      acc.push({ ...$, [articles]: arr } as unknown as typeof $);
      return acc;
    }, Promise.resolve(new Frames()));

    const byFavorited = await byTag.reduce<Promise<Frames>>(async (accP, $) => {
      const acc = await accP;
      let arr = ($[articles] as unknown as Array<Record<string, unknown>>) ||
        [];
      if (typeof $[favorited] === "string" && $[favorited] !== "") {
        const users = await User._getByName({
          name: ($[favorited] as unknown as string),
        });
        const favUserId = users[0]?.user as string | undefined;
        if (favUserId) {
          const favs = await Favorite._getFavorites({ user: favUserId });
          const targets = new Set(favs.map((f) => f.target));
          arr = arr.filter((a) => targets.has(a.article as string));
        } else {
          arr = [];
        }
      }
      acc.push({ ...$, [articles]: arr } as unknown as typeof $);
      return acc;
    }, Promise.resolve(new Frames()));

    const paginated = byFavorited.map(($) => {
      const arr = ($[articles] as unknown as Array<Record<string, unknown>>) ||
        [];
      const total = arr.length;
      const off = typeof $[offset] === "number" ? ($[offset] as number) : 0;
      const lim = typeof $[limit] === "number" && ($[limit] as number) > 0
        ? ($[limit] as number)
        : arr.length;
      const paged = arr.slice(off, off + lim);
      return {
        ...$,
        [articles]: paged,
        [articlesCount]: total,
      } as unknown as typeof $;
    });

    const withUser = await paginated.reduce<Promise<Frames>>(
      async (accP, $) => {
        const acc = await accP;
        let userId: string | undefined;
        if (typeof $[token] === "string" && ($[token] as string).length > 0) {
          const users = await JWT._getUser({ token: $[token] as string });
          userId = users[0]?.user as string | undefined;
        }
        acc.push({ ...$, [currentUser]: userId } as unknown as typeof $);
        return acc;
      },
      Promise.resolve(new Frames()),
    );

    const annotated = await withUser.reduce<Promise<Frames>>(
      async (accP, $) => {
        const acc = await accP;
        const arr =
          ($[articles] as unknown as Array<Record<string, unknown>>) || [];
        let favoriteTargets = new Set<string>();
        if (typeof $[currentUser] === "string" && ($[currentUser] as string)) {
          const favs = await Favorite._getFavorites({
            user: $[currentUser] as string,
          });
          favoriteTargets = new Set(favs.map((f) => f.target));
        }
        const enriched = await Promise.all(
          arr.map(async (a) => {
            const targetId = a.article as string;
            const countRes = await Favorite._getFavoriteCount({
              target: targetId,
            });
            const count = (countRes[0]?.count as number | undefined) ?? 0;
            const isFav = favoriteTargets.has(targetId);
            const tagDocs = await Tag._getByTarget({ target: targetId });
            const tags = tagDocs.map((d) => d.tag);
            return {
              ...a,
              favoritesCount: count,
              favorited: isFav,
              tagList: tags,
            } as Record<
              string,
              unknown
            >;
          }),
        );
        acc.push({ ...$, [articles]: enriched } as unknown as typeof $);
        return acc;
      },
      Promise.resolve(new Frames()),
    );

    return withArticlesResponse(annotated, response, articles, articlesCount);
  },
  then: actions([API.response, { request, output: response }]),
});

const GetArticleFeed = (
  {
    request,
    token,
    currentUser,
    limit,
    offset,
    articles,
    response,
  }: Vars,
) => ({
  when: actions(
    [API.request, { method: "GET", path: "/api/articles/feed" }, { request }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const reqFrames = await frames.query(API._get, { request }, {
      token,
      limit,
      offset,
    });
    const all = await reqFrames.query(Article._listAll, {}, { articles });

    const withUser = await all.reduce<Promise<Frames>>(async (accP, $) => {
      const acc = await accP;
      let userId: string | undefined;
      if (typeof $[token] === "string" && ($[token] as string).length > 0) {
        const users = await JWT._getUser({ token: $[token] as string });
        userId = users[0]?.user as string | undefined;
      }
      acc.push({ ...$, [currentUser]: userId } as unknown as typeof $);
      return acc;
    }, Promise.resolve(new Frames()));

    const annotated = await withUser.reduce<Promise<Frames>>(
      async (accP, $) => {
        const acc = await accP;
        const arr =
          ($[articles] as unknown as Array<Record<string, unknown>>) || [];
        let favoriteTargets = new Set<string>();
        if (typeof $[currentUser] === "string" && ($[currentUser] as string)) {
          const favs = await Favorite._getFavorites({
            user: $[currentUser] as string,
          });
          favoriteTargets = new Set(favs.map((f) => f.target));
        }
        const enriched = await Promise.all(
          arr.map(async (a) => {
            const targetId = a.article as string;
            const countRes = await Favorite._getFavoriteCount({
              target: targetId,
            });
            const count = (countRes[0]?.count as number | undefined) ?? 0;
            const isFav = favoriteTargets.has(targetId);
            const tagDocs = await Tag._getByTarget({ target: targetId });
            const tags = tagDocs.map((d) => d.tag);
            return {
              ...a,
              favoritesCount: count,
              favorited: isFav,
              tagList: tags,
            } as Record<
              string,
              unknown
            >;
          }),
        );
        acc.push({ ...$, [articles]: enriched } as unknown as typeof $);
        return acc;
      },
      Promise.resolve(new Frames()),
    );

    return withArticlesResponse(annotated, response, articles);
  },
  then: actions([API.response, { request, output: response }]),
});

const GetArticle = (
  {
    request,
    token,
    slug,
    response,
    articleObj,
    articleId,
    title,
    description,
    body: bodyContent,
    outSlug,
    createdAt,
    updatedAt,
    author,
    tagList: _tagList2,
    favoritesCount: _favoritesCount2,
    favorited,
  }: Vars,
) => ({
  when: actions(
    [API.request, { method: "GET", path: "/api/articles/:slug", slug }, {
      request,
    }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const withToken = await frames.query(API._get, { request }, { token });
    const detailed = await withToken.query(Article._getBySlug, { slug }, {
      article: articleId,
      title,
      description,
      body: bodyContent,
      slug: outSlug,
      createdAt,
      updatedAt,
      author,
      // tagList and favoritesCount are derived below
    });
    const _withTags2 = await detailed.query(Tag._getByTarget, {
      target: articleId,
    }, { tag: _tagList2 });
    const enriched = await detailed.reduce<Promise<Frames>>(async (accP, $) => {
      const acc = await accP;
      const targetId = $[articleId] as string;
      const countRes = await Favorite._getFavoriteCount({ target: targetId });
      const count = (countRes[0]?.count as number | undefined) ?? 0;
      let isFav = false;
      const tagDocs = await Tag._getByTarget({ target: targetId });
      const tags = tagDocs.map((d) => d.tag);
      if (typeof $[token] === "string" && ($[token] as string).length > 0) {
        const users = await JWT._getUser({ token: $[token] as string });
        const userId = users[0]?.user as string | undefined;
        if (userId) {
          const fav = await Favorite._isFavorited({
            user: userId,
            target: targetId,
          });
          isFav = !!fav[0]?.favorited;
        }
      }
      acc.push(
        {
          ...$,
          [_favoritesCount2]: count,
          [favorited]: isFav,
          [_tagList2]: tags,
        } as unknown as typeof $,
      );
      return acc;
    }, Promise.resolve(new Frames()));

    const shaped = enriched.map(($) => ({
      ...$,
      [articleObj]: {
        article: $[articleId],
        title: $[title],
        description: $[description],
        body: $[bodyContent],
        slug: $[outSlug],
        createdAt: $[createdAt],
        updatedAt: $[updatedAt],
        author: $[author],
        tagList: $[_tagList2],
        favoritesCount: $[_favoritesCount2],
        favorited: $[favorited],
      },
    }));
    return withArticleResponse(shaped, response, articleObj);
  },
  then: actions([API.response, { request, output: response }]),
});

const UpdateArticle = (
  {
    request,
    token,
    currentUser,
    slug,
    title,
    description,
    body,
    article,
    existingArticle,
    articleAuthor,
    existingTitle,
    existingDescription,
    existingBody,
    finalTitle,
    finalDescription,
    finalBody,
  }: Vars,
) => ({
  when: actions(
    [API.request, { method: "PUT", path: "/api/articles/:slug" }, { request }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const reqFrames = await frames.query(API._get, { request }, {
      token,
      slug,
      article,
    });
    const projected = projectFromObject(
      reqFrames,
      article,
      { title, description, body } as Record<string, symbol>,
    );
    const verified = await projected.query(
      JWT._getUser,
      { token },
      { user: currentUser },
    );
    const existing = await verified.query(
      Article._getBySlug,
      { slug },
      {
        article: existingArticle,
        author: articleAuthor,
        title: existingTitle,
        description: existingDescription,
        body: existingBody,
      },
    );
    const withFinals = existing.map(($) => ({
      ...$,
      [finalTitle]: $[title] !== undefined ? $[title] : $[existingTitle],
      [finalDescription]: $[description] !== undefined
        ? $[description]
        : $[existingDescription],
      [finalBody]: $[body] !== undefined ? $[body] : $[existingBody],
    }));
    const filtered = withFinals.filter(($) =>
      $[articleAuthor] === $[currentUser]
    );
    return filtered;
  },
  then: actions(
    [Article.update, {
      article: existingArticle,
      title: finalTitle,
      description: finalDescription,
      body: finalBody,
    }],
  ),
});

const FormatUpdateArticleResponse = (
  {
    request,
    article,
    response,
    articleObj,
    articleId,
    title,
    description,
    body: bodyContent,
    slug: outSlug,
    createdAt,
    updatedAt,
    author,
    tagList: _tagList,
    favoritesCount: _favoritesCount,
  }: Vars,
) => ({
  when: actions(
    [API.request, { method: "PUT", path: "/api/articles/:slug" }, { request }],
    [Article.update, {}, { article }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const detailed = await frames.query(Article._get, { article }, {
      article: articleId,
      title,
      description,
      body: bodyContent,
      slug: outSlug,
      createdAt,
      updatedAt,
      author,
    });
    const shaped = await detailed.reduce<Promise<Frames>>(async (accP, $) => {
      const acc = await accP;
      const tagDocs = await Tag._getByTarget({
        target: $[articleId] as string,
      });
      const tags = tagDocs.map((d) => d.tag);
      acc.push(
        {
          ...$,
          [articleObj]: {
            article: $[articleId],
            title: $[title],
            description: $[description],
            body: $[bodyContent],
            slug: $[outSlug],
            createdAt: $[createdAt],
            updatedAt: $[updatedAt],
            author: $[author],
            tagList: tags,
            favoritesCount: 0,
          },
        } as unknown as typeof $,
      );
      return acc;
    }, Promise.resolve(new Frames()));
    return withArticleResponse(shaped, response, articleObj);
  },
  then: actions([API.response, { request, output: response }]),
});

const DeleteArticle = (
  { request, token, currentUser, slug, existingArticle, articleAuthor }: Vars,
) => ({
  when: actions(
    [API.request, { method: "DELETE", path: "/api/articles/:slug" }, {
      request,
    }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const reqFrames = await frames.query(API._get, { request }, {
      token,
      slug,
    });
    const verified = await reqFrames.query(
      JWT._getUser,
      {
        token,
      },
      { user: currentUser },
    );
    const existing = await verified.query(
      Article._getBySlug,
      { slug },
      { article: existingArticle, author: articleAuthor },
    );
    const filtered = existing.filter(($) =>
      $[articleAuthor] === $[currentUser]
    );
    return filtered;
  },
  then: actions(
    [Article.delete, { article: existingArticle }],
  ),
});

const FormatDeleteArticleResponse = ({ request, response }: Vars) => ({
  when: actions(
    [API.request, { method: "DELETE", path: "/api/articles/:slug" }, {
      request,
    }],
    [Article.delete, {}, {}],
  ),
  where: (frames: Frames): Frames => {
    return frames.map(($) => ({
      ...$,
      [response]: { status: 200, body: {} },
    }));
  },
  then: actions(
    [API.response, { request, output: response }],
  ),
});

export const articleSyncs = {
  ValidateArticleCreation,
  CreateArticleAction,
  AttachTagsOnCreate,
  ArticleCreationError,
  ArticleCreationUnauthorized,
  FormatArticleCreationResponse,
  ListArticles,
  GetArticleFeed,
  GetArticle,
  UpdateArticle,
  FormatUpdateArticleResponse,
  DeleteArticle,
  FormatDeleteArticleResponse,
};
