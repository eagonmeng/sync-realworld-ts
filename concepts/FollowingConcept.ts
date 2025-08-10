import { Collection, Db, MongoClient } from "mongodb";

export class FollowingConcept {
  private db!: Db;
  private follows!: Collection;
  private followerCounts!: Collection;

  constructor() {}

  async init() {
    const uri = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    await client.connect();
    this.db = client.db(Deno.env.get("DATABASE_NAME") || "realworld");
    this.follows = this.db.collection("follows");
    this.followerCounts = this.db.collection("followerCounts");

    // Create indexes
    await this.follows.createIndex(
      { follower: 1, target: 1 },
      { name: "follower_target_unique", unique: true },
    );
    await this.follows.createIndex(
      { follower: 1 },
      { name: "follower_index" },
    );
    await this.follows.createIndex(
      { target: 1 },
      { name: "target_index" },
    );

    await this.followerCounts.createIndex(
      { user: 1 },
      { name: "user_unique", unique: true },
    );
  }

  async follow(
    { follower, target }: { follower: string; target: string },
  ): Promise<{ target: string } | { error: string }> {
    try {
      if (follower === target) {
        return { error: "Cannot follow yourself" };
      }

      // Check if already following
      const existingFollow = await this.follows.findOne({
        follower,
        target,
      });
      if (existingFollow) {
        return { error: "Already following user" };
      }

      // Add follow relationship
      await this.follows.insertOne({ follower, target });

      // Increment follower count
      await this.followerCounts.updateOne(
        { user: target },
        { $inc: { count: 1 } },
        { upsert: true },
      );

      return { target };
    } catch (error: unknown) {
      return {
        error: `Follow failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  async unfollow(
    { follower, target }: { follower: string; target: string },
  ): Promise<{ target: string } | { error: string }> {
    try {
      // Check if currently following
      const existingFollow = await this.follows.findOne({
        follower,
        target,
      });
      if (!existingFollow) {
        return { error: "Not following user" };
      }

      // Remove follow relationship
      await this.follows.deleteOne({ follower, target });

      // Decrement follower count
      await this.followerCounts.updateOne(
        { user: target },
        { $inc: { count: -1 } },
      );

      // Clean up zero counts
      await this.followerCounts.deleteMany({ count: { $lte: 0 } });

      return { target };
    } catch (error: unknown) {
      return {
        error: `Unfollow failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Query functions
  async _isFollowing(
    { follower, target }: { follower: string; target: string },
  ): Promise<Array<{ following: boolean }>> {
    const follow = await this.follows.findOne({ follower, target });
    return [{ following: !!follow }];
  }

  async _getFollowing(
    { follower }: { follower: string },
  ): Promise<Array<{ target: string }>> {
    const follows = await this.follows.find({ follower }).toArray();
    return follows.map((follow) => ({ target: follow.target }));
  }

  async _getFollowers(
    { target }: { target: string },
  ): Promise<Array<{ follower: string }>> {
    const follows = await this.follows.find({ target }).toArray();
    return follows.map((follow) => ({ follower: follow.follower }));
  }

  async _getFollowerCount(
    { user }: { user: string },
  ): Promise<Array<{ user: string; count: number }>> {
    const countDoc = await this.followerCounts.findOne({ user });
    return [{ user, count: countDoc?.count || 0 }];
  }
}
