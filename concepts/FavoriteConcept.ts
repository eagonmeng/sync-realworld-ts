import { Collection, Db, MongoClient } from "mongodb";

export class FavoriteConcept {
  private db!: Db;
  private favorites!: Collection;
  private favoriteCounts!: Collection;

  constructor() {}

  async init() {
    const uri = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    await client.connect();
    this.db = client.db(Deno.env.get("DATABASE_NAME") || "realworld");
    this.favorites = this.db.collection("favorites");
    this.favoriteCounts = this.db.collection("favoriteCounts");

    // Create indexes
    await this.favorites.createIndex(
      { user: 1, target: 1 },
      { name: "user_target_unique", unique: true },
    );
    await this.favorites.createIndex(
      { user: 1 },
      { name: "user_index" },
    );
    await this.favorites.createIndex(
      { target: 1 },
      { name: "target_index" },
    );

    await this.favoriteCounts.createIndex(
      { target: 1 },
      { name: "target_unique", unique: true },
    );
  }

  async add(
    { user, target }: { user: string; target: string },
  ): Promise<{ target: string }> {
    try {
      // Add favorite (ignore if already exists)
      await this.favorites.insertOne({ user, target });

      // Increment favorite count
      await this.favoriteCounts.updateOne(
        { target },
        { $inc: { count: 1 } },
        { upsert: true },
      );

      return { target };
    } catch (error) {
      // If duplicate key error, still increment count and return success
      if ((error as Error).message?.includes("duplicate key")) {
        return { target };
      }
      throw error;
    }
  }

  async remove(
    { user, target }: { user: string; target: string },
  ): Promise<{ target: string }> {
    try {
      // Remove favorite
      const result = await this.favorites.deleteOne({ user, target });

      // Only decrement if actually removed
      if (result.deletedCount > 0) {
        await this.favoriteCounts.updateOne(
          { target },
          { $inc: { count: -1 } },
        );

        // Clean up zero counts
        await this.favoriteCounts.deleteMany({ count: { $lte: 0 } });
      }

      return { target };
    } catch (_error) {
      // Even if error, return success for idempotency
      return { target };
    }
  }

  // Query functions
  async _isFavorited(
    { user, target }: { user: string; target: string },
  ): Promise<Array<{ favorited: boolean }>> {
    const favorite = await this.favorites.findOne({ user, target });
    return [{ favorited: !!favorite }];
  }

  async _getFavorites(
    { user }: { user: string },
  ): Promise<Array<{ target: string }>> {
    const favorites = await this.favorites.find({ user }).toArray();
    return favorites.map((fav) => ({ target: fav.target }));
  }

  async _getFavoriteCount(
    { target }: { target: string },
  ): Promise<Array<{ target: string; count: number }>> {
    const countDoc = await this.favoriteCounts.findOne({ target });
    return [{ target, count: countDoc?.count || 0 }];
  }
}
