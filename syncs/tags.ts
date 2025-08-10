import { actions, Frames, Vars } from "../engine/mod.ts";
import { API, Tag } from "./context.ts";

const GetTags = (
  { request, tags: _tags, response, articles: _articles }: Vars,
) => ({
  when: actions(
    [API.request, { method: "GET", path: "/api/tags" }, { request }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const all = await Tag._getAllTags();
    const tags = all.map((t) => t.tag).sort((a, b) => a.localeCompare(b));
    return frames.map(($) => ({
      ...$,
      [response]: { status: 200, body: { tags } },
    })) as unknown as Frames;
  },
  then: actions([API.response, { request, output: response }]),
});

export const tagSyncs = { GetTags };
