import { Collection, Db, MongoClient } from "mongodb";

export class TagConcept {
  private db!: Db;
  private allTags!: Collection;
  private targetTags!: Collection;

  constructor() {}

  async init() {
    const uri = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    await client.connect();
    this.db = client.db(Deno.env.get("DATABASE_NAME") || "realworld");
    this.allTags = this.db.collection("allTags");
    this.targetTags = this.db.collection("targetTags");

    // Create indexes
    await this.allTags.createIndex(
      { tag: 1 },
      { name: "tag_unique", unique: true },
    );

    await this.targetTags.createIndex(
      { target: 1, tag: 1 },
      { name: "target_tag_unique", unique: true },
    );
    await this.targetTags.createIndex(
      { target: 1 },
      { name: "target_index" },
    );
    await this.targetTags.createIndex(
      { tag: 1 },
      { name: "tag_index" },
    );
  }

  async add(
    { target, tag }: { target: string; tag: string },
  ): Promise<{ tag: string }> {
    // Ensure tag exists in global list (idempotent)
    await this.allTags.updateOne(
      { tag },
      { $setOnInsert: { tag } },
      { upsert: true },
    );

    // Ensure association exists (idempotent)
    await this.targetTags.updateOne(
      { target, tag },
      { $setOnInsert: { target, tag } },
      { upsert: true },
    );

    return { tag };
  }

  async remove(
    { target, tag }: { target: string; tag: string },
  ): Promise<{ tag: string }> {
    try {
      // Remove tag from target
      await this.targetTags.deleteOne({ target, tag });

      // Check if any other targets use this tag
      const remainingUsage = await this.targetTags.findOne({ tag });
      if (!remainingUsage) {
        // Remove from all tags if no targets use it
        await this.allTags.deleteOne({ tag });
      }

      return { tag };
    } catch (_error) {
      // Even if error, return success for idempotency
      return { tag };
    }
  }

  // Query functions
  async _getAllTags(): Promise<Array<{ tag: string }>> {
    const tags = await this.allTags.find({}).sort({ tag: 1 }).toArray();
    return tags.map((tagDoc) => ({ tag: tagDoc.tag }));
  }

  async _getByTarget(
    { target }: { target: string },
  ): Promise<Array<{ tag: string }>> {
    const targetTagDocs = await this.targetTags.find({ target }).sort({
      tag: 1,
    }).toArray();
    return targetTagDocs.map((doc) => ({ tag: doc.tag }));
  }

  async _getTargetsByTag(
    { tag }: { tag: string },
  ): Promise<Array<{ target: string }>> {
    const targetTagDocs = await this.targetTags.find({ tag }).toArray();
    return targetTagDocs.map((doc) => ({ target: doc.target }));
  }
}
