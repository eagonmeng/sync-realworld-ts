import { actions, Frames, Vars } from "../engine/mod.ts";
import { API, Article, Favorite, JWT, Tag } from "./context.ts";
import { withArticleResponse } from "./response.ts";

const FavoriteArticle = (
  {
    request,
    token,
    currentUser,
    slug,
    response,
    favoritesCount,
    articleObj,
    articleId,
    title,
    description,
    body: bodyContent,
    slug: outSlug,
    createdAt,
    updatedAt,
    author,
    tagList,
  }: Vars,
) => ({
  when: actions(
    [API.request, { method: "POST", path: "/api/articles/:slug/favorite" }, {
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
      { token },
      { user: currentUser },
    );
    const detailed = await verified.query(Article._getBySlug, { slug }, {
      article: articleId,
      title,
      description,
      body: bodyContent,
      slug: outSlug,
      createdAt,
      updatedAt,
      author,
      tagList,
      favoritesCount,
    });
    const shaped = await detailed.reduce<Promise<Frames>>(async (accP, $) => {
      const acc = await accP;
      const tagDocs = await Tag._getByTarget({
        target: $[articleId] as string,
      });
      const tags = tagDocs.map((d) => d.tag);
      const base = ($ as unknown as { favoritesCount?: number }).favoritesCount;
      const favCount = typeof base === "number" ? base + 1 : 1;
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
            favoritesCount: favCount,
            favorited: true,
          },
        } as unknown as typeof $,
      );
      return acc;
    }, Promise.resolve(new Frames()));
    return withArticleResponse(shaped, response, articleObj);
  },
  then: actions(
    [Favorite.add, { user: currentUser, target: articleId }],
    [API.response, { request, output: response }],
  ),
});

const UnfavoriteArticle = (
  {
    request,
    token,
    currentUser,
    slug,
    response,
    favoritesCount,
    articleObj,
    articleId,
    title,
    description,
    body: bodyContent,
    slug: outSlug,
    createdAt,
    updatedAt,
    author,
    tagList,
  }: Vars,
) => ({
  when: actions(
    [API.request, { method: "DELETE", path: "/api/articles/:slug/favorite" }, {
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
      { token },
      { user: currentUser },
    );
    const detailed = await verified.query(Article._getBySlug, { slug }, {
      article: articleId,
      title,
      description,
      body: bodyContent,
      slug: outSlug,
      createdAt,
      updatedAt,
      author,
      tagList,
      favoritesCount,
    });
    const shaped = await detailed.reduce<Promise<Frames>>(async (accP, $) => {
      const acc = await accP;
      const tagDocs = await Tag._getByTarget({
        target: $[articleId] as string,
      });
      const tags = tagDocs.map((d) => d.tag);
      const base = ($ as unknown as { favoritesCount?: number }).favoritesCount;
      const favCount = Math.max(0, typeof base === "number" ? base - 1 : 0);
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
            favoritesCount: favCount,
            favorited: false,
          },
        } as unknown as typeof $,
      );
      return acc;
    }, Promise.resolve(new Frames()));
    return withArticleResponse(shaped, response, articleObj);
  },
  then: actions(
    [Favorite.remove, { user: currentUser, target: articleId }],
    [API.response, { request, output: response }],
  ),
});

export const favoriteSyncs = {
  FavoriteArticle,
  UnfavoriteArticle,
};
