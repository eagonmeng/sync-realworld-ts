import { Collection, Db, MongoClient } from "mongodb";

export class ArticleConcept {
  private db!: Db;
  private articles!: Collection;

  constructor() {}

  async init() {
    const uri = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    await client.connect();
    this.db = client.db(Deno.env.get("DATABASE_NAME") || "realworld");
    this.articles = this.db.collection("articles");

    // Create indexes
    await this.articles.createIndex(
      { slug: 1 },
      { name: "slug_unique", unique: true },
    );
    await this.articles.createIndex(
      { author: 1 },
      { name: "author_index" },
    );
    await this.articles.createIndex(
      { createdAt: -1 },
      { name: "created_desc" },
    );
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .trim();
  }

  private getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  async create({ article, title, description, body, author }: {
    article: string;
    title: string;
    description: string;
    body: string;
    author: string;
  }): Promise<{ article: string } | { error: string }> {
    try {
      const slug = this.generateSlug(title);

      // Check if slug already exists
      const existingArticle = await this.articles.findOne({ slug });
      if (existingArticle) {
        return { error: "Article with similar title already exists" };
      }

      const now = this.getCurrentTimestamp();

      await this.articles.insertOne({
        article,
        title,
        description,
        body,
        slug,
        createdAt: now,
        updatedAt: now,
        author,
      });

      return { article };
    } catch (error: unknown) {
      return {
        error: `Article creation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  async update({ article, title, description, body }: {
    article: string;
    title?: string;
    description?: string;
    body?: string;
  }): Promise<{ article: string } | { error: string }> {
    try {
      const existingArticle = await this.articles.findOne({
        article,
      });
      if (!existingArticle) {
        return { error: "Article not found" };
      }

      const updateData: Record<string, unknown> = {
        updatedAt: this.getCurrentTimestamp(),
      };

      if (title !== undefined) {
        const newSlug = this.generateSlug(title);
        // Check if new slug conflicts with existing articles
        const conflictingArticle = await this.articles.findOne({
          slug: newSlug,
          article: { $ne: article },
        });
        if (conflictingArticle) {
          return {
            error: "Article with similar title already exists",
          };
        }
        updateData.title = title;
        updateData.slug = newSlug;
      }

      if (description !== undefined) {
        updateData.description = description;
      }

      if (body !== undefined) {
        updateData.body = body;
      }

      // favoritesCount and tags are modeled in separate concepts

      await this.articles.updateOne({ article }, {
        $set: updateData,
      });
      return { article };
    } catch (error: unknown) {
      return {
        error: `Article update failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  async delete(
    { article }: { article: string },
  ): Promise<{ article: string } | { error: string }> {
    try {
      const result = await this.articles.deleteOne({ article });
      if (result.deletedCount === 0) {
        return { error: "Article not found" };
      }
      return { article };
    } catch (error: unknown) {
      return {
        error: `Article deletion failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Query functions
  async _get({ article }: { article: string }): Promise<
    Array<{
      article: string;
      title: string;
      description: string;
      body: string;
      slug: string;
      createdAt: string;
      updatedAt: string;
      author: string;
    }>
  > {
    const articleData = await this.articles.findOne({ article });
    if (!articleData) return [];
    return [{
      article: articleData.article,
      title: articleData.title,
      description: articleData.description,
      body: articleData.body,
      slug: articleData.slug,
      createdAt: articleData.createdAt,
      updatedAt: articleData.updatedAt,
      author: articleData.author,
    }];
  }

  async _getBySlug({ slug }: { slug: string }): Promise<
    Array<{
      article: string;
      title: string;
      description: string;
      body: string;
      slug: string;
      createdAt: string;
      updatedAt: string;
      author: string;
    }>
  > {
    const articleData = await this.articles.findOne({ slug });
    if (!articleData) return [];
    return [{
      article: articleData.article,
      title: articleData.title,
      description: articleData.description,
      body: articleData.body,
      slug: articleData.slug,
      createdAt: articleData.createdAt,
      updatedAt: articleData.updatedAt,
      author: articleData.author,
    }];
  }

  async _getByAuthor({ author }: { author: string }): Promise<
    Array<{
      article: string;
      title: string;
      description: string;
      body: string;
      slug: string;
      createdAt: string;
      updatedAt: string;
      author: string;
    }>
  > {
    const articles = await this.articles.find({ author }).sort({
      createdAt: -1,
    }).toArray();
    return articles.map((articleData) => ({
      article: articleData.article,
      title: articleData.title,
      description: articleData.description,
      body: articleData.body,
      slug: articleData.slug,
      createdAt: articleData.createdAt,
      updatedAt: articleData.updatedAt,
      author: articleData.author,
    }));
  }

  async _getAll(): Promise<
    Array<{
      article: string;
      title: string;
      description: string;
      body: string;
      slug: string;
      createdAt: string;
      updatedAt: string;
      author: string;
    }>
  > {
    const articles = await this.articles.find({}).sort({ createdAt: -1 })
      .toArray();
    return articles.map((articleData) => ({
      article: articleData.article,
      title: articleData.title,
      description: articleData.description,
      body: articleData.body,
      slug: articleData.slug,
      createdAt: articleData.createdAt,
      updatedAt: articleData.updatedAt,
      author: articleData.author,
    }));
  }

  async _listAll(): Promise<
    Array<{
      articles: Array<{
        article: string;
        title: string;
        description: string;
        body: string;
        slug: string;
        createdAt: string;
        updatedAt: string;
        author: string;
      }>;
    }>
  > {
    const items = await this._getAll();
    return [{ articles: items }];
  }
}
