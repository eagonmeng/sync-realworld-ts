import { actions, Frames, Vars } from "../engine/mod.ts";
import { API } from "./context.ts";

const Health = ({ request, response }: Vars) => ({
  when: actions(
    [API.request, { method: "GET", path: "/api/health" }, { request }],
  ),
  where: (frames: Frames): Frames =>
    frames.map(($) => ({
      ...$,
      [response]: { status: 200, body: { status: "ok" } },
    })) as unknown as Frames,
  then: actions([API.response, { request, output: response }]),
});

export const healthSyncs = { Health };
