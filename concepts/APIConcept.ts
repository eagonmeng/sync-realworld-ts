import { Collection, Db, MongoClient } from "mongodb";

export class APIConcept {
  private db!: Db;
  private requests!: Collection;

  constructor() {}

  async init() {
    const uri = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    await client.connect();
    this.db = client.db(Deno.env.get("DATABASE_NAME") || "realworld");
    this.requests = this.db.collection("requests");

    // Create indexes
    await this.requests.createIndex(
      { request: 1 },
      { name: "request_unique", unique: true },
    );
  }

  async request(
    args: { request: string } & Record<string, unknown>,
  ): Promise<{ request: string }> {
    const { request, ...rest } = args;
    try {
      await this.requests.insertOne({ request, ...rest, output: null });

      return { request };
    } catch (error: unknown) {
      throw new Error(
        `Request registration failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  async response(
    { request, output }: { request: string; output: Record<string, unknown> },
  ): Promise<{ request: string }> {
    try {
      await this.requests.updateOne(
        { request },
        { $set: { output } },
      );

      return { request };
    } catch (error: unknown) {
      throw new Error(
        `Response recording failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  // Query functions
  async _get({ request }: { request: string }): Promise<
    Array<Record<string, unknown>>
  > {
    const requestData = await this.requests.findOne({ request });
    if (!requestData) return [];
    return [requestData as unknown as Record<string, unknown>];
  }
}
