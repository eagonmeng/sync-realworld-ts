import { Collection, Db, MongoClient } from "mongodb";

export class ProfileConcept {
  private db!: Db;
  private profiles!: Collection;

  constructor() {}

  async init() {
    const uri = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    await client.connect();
    this.db = client.db(Deno.env.get("DATABASE_NAME") || "realworld");
    this.profiles = this.db.collection("profiles");

    // Create indexes
    await this.profiles.createIndex(
      { user: 1 },
      { name: "user_unique", unique: true },
    );
  }

  private isValidImageUrl(image: string): boolean {
    try {
      new URL(image);
      return true;
    } catch {
      // Check if it's a valid base64 data URL
      return image.startsWith("data:image/") && image.includes("base64,");
    }
  }

  async register(
    { profile, user }: { profile: string; user: string },
  ): Promise<{ profile: string }> {
    try {
      await this.profiles.insertOne({
        profile,
        user,
        bio: "",
        image: "",
      });

      return { profile };
    } catch (error: unknown) {
      throw new Error(
        `Profile registration failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  async update(
    { profile, bio, image }: {
      profile: string;
      bio?: string;
      image?: string;
    },
  ): Promise<{ profile: string } | { error: string }> {
    try {
      const existingProfile = await this.profiles.findOne({
        profile,
      });
      if (!existingProfile) {
        return { error: "Profile not found" };
      }

      const updateData: Record<string, unknown> = {};

      if (bio !== undefined) {
        updateData.bio = bio;
      }

      if (image !== undefined) {
        if (image && !this.isValidImageUrl(image)) {
          return { error: "Invalid image URL or format" };
        }
        updateData.image = image;
      }

      await this.profiles.updateOne({ profile }, {
        $set: updateData,
      });
      return { profile };
    } catch (error: unknown) {
      return {
        error: `Profile update failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Query functions
  async _getByUser(
    { user }: { user: string },
  ): Promise<
    Array<{ profile: string; user: string; bio: string; image: string }>
  > {
    const profileData = await this.profiles.findOne({ user });
    if (!profileData) return [];
    return [{
      profile: profileData.profile,
      user: profileData.user,
      bio: profileData.bio,
      image: profileData.image,
    }];
  }

  async _get(
    { profile }: { profile: string },
  ): Promise<
    Array<{ profile: string; user: string; bio: string; image: string }>
  > {
    const profileData = await this.profiles.findOne({ profile });
    if (!profileData) return [];
    return [{
      profile: profileData.profile,
      user: profileData.user,
      bio: profileData.bio,
      image: profileData.image,
    }];
  }
}
