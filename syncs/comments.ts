import { actions, Frames, Vars } from "../engine/mod.ts";
import { API, Comment, JWT } from "./context.ts";
import { projectFromObject, withUuid } from "./helpers.ts";
import { withCommentResponse, withCommentsResponse } from "./response.ts";

const AddComment = (
  { request, token, currentUser, slug, body, comment, commentId }: Vars,
) => ({
  when: actions(
    [API.request, { method: "POST", path: "/api/articles/:slug/comments" }, {
      request,
    }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const reqFrames = await frames.query(API._get, { request }, {
      token,
      slug,
      comment,
    });
    const withBody = projectFromObject(reqFrames, comment, { body });
    const withId = withUuid(withBody, commentId);
    const verified = await withId.query(
      JWT._getUser,
      { token },
      { user: currentUser },
    );
    return verified;
  },
  then: actions(
    [Comment.create, {
      comment: commentId,
      author: currentUser,
      target: slug,
      body,
    }],
  ),
});

const FormatAddCommentResponse = (
  {
    request,
    comment,
    response,
    commentObj,
    commentId,
    body: bodyContent,
    createdAt,
    updatedAt,
    author,
    target,
  }: Vars,
) => ({
  when: actions(
    [API.request, { method: "POST", path: "/api/articles/:slug/comments" }, {
      request,
    }],
    [Comment.create, {}, { comment }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const detailed = await frames.query(Comment._get, { comment }, {
      comment: commentId,
      body: bodyContent,
      createdAt,
      updatedAt,
      author,
      target,
    });
    const shaped = detailed.map(($) => ({
      ...$,
      [commentObj]: {
        id: $[commentId],
        body: $[bodyContent],
        createdAt: $[createdAt],
        updatedAt: $[updatedAt],
        author: $[author],
        target: $[target],
      },
    }));
    return withCommentResponse(shaped, response, commentObj);
  },
  then: actions([API.response, { request, output: response }]),
});

const GetComments = (
  { request, slug, comments, response }: Vars,
) => ({
  when: actions(
    [
      API.request,
      { method: "GET", path: "/api/articles/:slug/comments", slug },
      { request },
    ],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const aggregated = await frames.reduce<Promise<Frames>>(async (accP, $) => {
      const acc = await accP;
      const list = await Comment._getByTarget({ target: $[slug] as string });
      acc.push({ ...$, [comments]: list } as unknown as typeof $);
      return acc;
    }, Promise.resolve(new Frames()));
    return withCommentsResponse(aggregated, response, comments);
  },
  then: actions([API.response, { request, output: response }]),
});

const DeleteComment = (
  { request, token, currentUser, slug: _slug, commentId, commentAuthor }: Vars,
) => ({
  when: actions(
    [API.request, {
      method: "DELETE",
      path: "/api/articles/:slug/comments/:id",
    }, { request }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const reqFrames = await frames.query(API._get, { request }, {
      token,
      id: commentId,
    });
    const verified = await reqFrames.query(
      JWT._getUser,
      { token },
      { user: currentUser },
    );
    const existing = await verified.query(
      Comment._get,
      { comment: commentId },
      { author: commentAuthor },
    );
    const filtered = existing.filter(($) =>
      $[commentAuthor] === $[currentUser]
    );
    return filtered;
  },
  then: actions(
    [Comment.delete, { comment: commentId }],
  ),
});

const FormatDeleteCommentResponse = ({ request, response }: Vars) => ({
  when: actions(
    [API.request, {
      method: "DELETE",
      path: "/api/articles/:slug/comments/:id",
    }, { request }],
    [Comment.delete, {}, {}],
  ),
  where: (frames: Frames): Frames => {
    return frames.map(($) => ({
      ...$,
      [response]: { status: 200, body: {} },
    }));
  },
  then: actions([API.response, { request, output: response }]),
});

export const commentSyncs = {
  AddComment,
  FormatAddCommentResponse,
  GetComments,
  DeleteComment,
  FormatDeleteCommentResponse,
};
