import { Collection, Db, MongoClient } from "mongodb";

export class CommentConcept {
  private db!: Db;
  private comments!: Collection;

  constructor() {}

  async init() {
    const uri = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    await client.connect();
    this.db = client.db(Deno.env.get("DATABASE_NAME") || "realworld");
    this.comments = this.db.collection("comments");

    // Create indexes
    await this.comments.createIndex(
      { target: 1, createdAt: -1 },
      { name: "target_created_desc" },
    );
    await this.comments.createIndex(
      { author: 1 },
      { name: "author_index" },
    );
  }

  private getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  async create({ comment, body, author, target }: {
    comment: string;
    body: string;
    author: string;
    target: string;
  }): Promise<{ comment: string } | { error: string }> {
    try {
      if (!body || body.trim().length === 0) {
        return { error: "Comment body cannot be empty" };
      }

      const now = this.getCurrentTimestamp();

      await this.comments.insertOne({
        comment,
        body: body.trim(),
        author,
        target,
        createdAt: now,
        updatedAt: now,
      });

      return { comment };
    } catch (error: unknown) {
      return {
        error: `Comment creation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  async update(
    { comment, body }: { comment: string; body: string },
  ): Promise<{ comment: string } | { error: string }> {
    try {
      const existingComment = await this.comments.findOne({
        comment,
      });
      if (!existingComment) {
        return { error: "Comment not found" };
      }

      if (!body || body.trim().length === 0) {
        return { error: "Comment body cannot be empty" };
      }

      await this.comments.updateOne(
        { comment },
        {
          $set: {
            body: body.trim(),
            updatedAt: this.getCurrentTimestamp(),
          },
        },
      );

      return { comment };
    } catch (error: unknown) {
      return {
        error: `Comment update failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  async delete(
    { comment }: { comment: string },
  ): Promise<{ comment: string } | { error: string }> {
    try {
      const result = await this.comments.deleteOne({ comment });
      if (result.deletedCount === 0) {
        return { error: "Comment not found" };
      }
      return { comment };
    } catch (error: unknown) {
      return {
        error: `Comment deletion failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Query functions
  async _get({ comment }: { comment: string }): Promise<
    Array<{
      comment: string;
      body: string;
      createdAt: string;
      updatedAt: string;
      author: string;
      target: string;
    }>
  > {
    const commentData = await this.comments.findOne({ comment });
    if (!commentData) return [];
    return [{
      comment: commentData.comment,
      body: commentData.body,
      createdAt: commentData.createdAt,
      updatedAt: commentData.updatedAt,
      author: commentData.author,
      target: commentData.target,
    }];
  }

  async _getByTarget({ target }: { target: string }): Promise<
    Array<{
      comment: string;
      body: string;
      createdAt: string;
      updatedAt: string;
      author: string;
      target: string;
    }>
  > {
    const comments = await this.comments.find({ target }).sort({
      createdAt: -1,
    }).toArray();
    return comments.map((commentData) => ({
      comment: commentData.comment,
      body: commentData.body,
      createdAt: commentData.createdAt,
      updatedAt: commentData.updatedAt,
      author: commentData.author,
      target: commentData.target,
    }));
  }

  async _getByAuthor({ author }: { author: string }): Promise<
    Array<{
      comment: string;
      body: string;
      createdAt: string;
      updatedAt: string;
      author: string;
      target: string;
    }>
  > {
    const comments = await this.comments.find({ author }).sort({
      createdAt: -1,
    }).toArray();
    return comments.map((commentData) => ({
      comment: commentData.comment,
      body: commentData.body,
      createdAt: commentData.createdAt,
      updatedAt: commentData.updatedAt,
      author: commentData.author,
      target: commentData.target,
    }));
  }
}
