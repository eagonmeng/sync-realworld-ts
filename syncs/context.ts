import "@std/dotenv/load";

import { SyncConcept } from "../engine/mod.ts";

import { APIConcept } from "../concepts/APIConcept.ts";
import { UserConcept } from "../concepts/UserConcept.ts";
import { PasswordConcept } from "../concepts/PasswordConcept.ts";
import { JWTConcept } from "../concepts/JWTConcept.ts";
import { ProfileConcept } from "../concepts/ProfileConcept.ts";
import { FollowingConcept } from "../concepts/FollowingConcept.ts";
import { ArticleConcept } from "../concepts/ArticleConcept.ts";
import { CommentConcept } from "../concepts/CommentConcept.ts";
import { FavoriteConcept } from "../concepts/FavoriteConcept.ts";
import { TagConcept } from "../concepts/TagConcept.ts";

// Initialize concepts
const concepts = {
  API: new APIConcept(),
  User: new UserConcept(),
  Password: new PasswordConcept(),
  JWT: new JWTConcept(),
  Profile: new ProfileConcept(),
  Following: new FollowingConcept(),
  Article: new ArticleConcept(),
  Comment: new CommentConcept(),
  Favorite: new FavoriteConcept(),
  Tag: new TagConcept(),
};

// Initialize all concepts
for (const concept of Object.values(concepts)) {
  await concept.init();
}

// Create Sync engine and instrument concepts
const Sync = new SyncConcept();

const {
  API,
  User,
  Password,
  JWT,
  Profile,
  Following,
  Article,
  Comment,
  Favorite,
  Tag,
} = Sync.instrument(concepts);

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
};

export { concepts, Sync };
