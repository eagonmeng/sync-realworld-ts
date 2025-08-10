import { actions, Frames, Vars } from "../engine/mod.ts";
import { API, Following, JWT, Profile, User } from "./context.ts";
import { withProfileResponse } from "./response.ts";

const GetProfile = (
  {
    request,
    username,
    user,
    bio,
    image,
    currentUser,
    currentUserId,
    following,
    response,
  }: Vars,
) => ({
  when: actions(
    [API.request, { method: "GET", path: "/api/profiles/:username" }, {
      request,
    }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const mapped = await frames.query(API._get, { request }, {
      username,
      token: currentUser,
    });
    const f1 = await mapped.query(User._getByName, {
      name: username,
    }, { user });
    const f2 = await f1.query(Profile._getByUser, { user }, { bio, image });
    const f3 = await f2.query(JWT._getUser, { token: currentUser }, {
      user: currentUserId,
    });
    const f4 = await f3.query(
      Following._isFollowing,
      { follower: currentUserId, target: user },
      { following },
    );
    return withProfileResponse(f4, response, {
      username,
      bio,
      image,
      following,
    });
  },
  then: actions([API.response, { request, output: response }]),
});

const FollowUser = (
  {
    request,
    token,
    currentUser,
    username,
    targetUser,
    bio,
    image,
    following,
    response,
  }: Vars,
) => ({
  when: actions(
    [API.request, { method: "POST", path: "/api/profiles/:username/follow" }, {
      request,
    }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const mapped = await frames.query(API._get, { request }, {
      token,
      username,
    });
    const f1 = await mapped.query(JWT._getUser, {
      token,
    }, { user: currentUser });
    const f2 = await f1.query(User._getByName, { name: username }, {
      user: targetUser,
    });
    const f3 = await f2.query(Profile._getByUser, { user: targetUser }, {
      bio,
      image,
    });
    const flagged = f3.map(($) => ({
      ...$,
      [following]: true,
    })) as unknown as Frames;
    return withProfileResponse(flagged, response, {
      username,
      bio,
      image,
      following,
    });
  },
  then: actions(
    [Following.follow, { follower: currentUser, followee: targetUser }],
    [API.response, { request, output: response }],
  ),
});

const UnfollowUser = (
  {
    request,
    token,
    currentUser,
    username,
    targetUser,
    bio,
    image,
    following,
    response,
  }: Vars,
) => ({
  when: actions(
    [
      API.request,
      { method: "DELETE", path: "/api/profiles/:username/follow" },
      { request },
    ],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const mapped = await frames.query(API._get, { request }, {
      token,
      username,
    });
    const f1 = await mapped.query(JWT._getUser, {
      token,
    }, { user: currentUser });
    const f2 = await f1.query(User._getByName, { name: username }, {
      user: targetUser,
    });
    const f3 = await f2.query(Profile._getByUser, { user: targetUser }, {
      bio,
      image,
    });
    const flagged = f3.map(($) => ({
      ...$,
      [following]: false,
    })) as unknown as Frames;
    return withProfileResponse(flagged, response, {
      username,
      bio,
      image,
      following,
    });
  },
  then: actions(
    [Following.unfollow, { follower: currentUser, followee: targetUser }],
    [API.response, { request, output: response }],
  ),
});

export const profileSyncs = {
  GetProfile,
  FollowUser,
  UnfollowUser,
};
