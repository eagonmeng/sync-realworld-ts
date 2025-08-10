import { Sync } from "./context.ts";
import { articleSyncs } from "./articles.ts";
import { userSyncs } from "./user.ts";
import { profileSyncs } from "./profiles.ts";
import { commentSyncs } from "./comments.ts";
import { favoriteSyncs } from "./favorites.ts";
import { healthSyncs } from "./health.ts";
import { tagSyncs } from "./tags.ts";

const syncs = {
  ...userSyncs,
  ...articleSyncs,
  ...profileSyncs,
  ...commentSyncs,
  ...favoriteSyncs,
  ...healthSyncs,
  ...tagSyncs,
};

Sync.register(syncs);

export {
  API,
  Article,
  Comment,
  Favorite,
  Following,
  JWT,
  Password,
  Profile,
  Tag,
  User,
} from "./context.ts";
export { concepts, Sync } from "./context.ts";
