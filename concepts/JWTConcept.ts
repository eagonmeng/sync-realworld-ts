import { Collection, Db, MongoClient } from "mongodb";
import jwt from "jsonwebtoken";

export class JWTConcept {
  private db!: Db;
  private tokens!: Collection;
  private secretKey!: string;

  constructor() {}

  async init() {
    const uri = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    await client.connect();
    this.db = client.db(Deno.env.get("DATABASE_NAME") || "realworld");
    this.tokens = this.db.collection("tokens");

    // Initialize secret key
    this.secretKey = Deno.env.get("JWT_SECRET") || "your-secret-key";

    // Create indexes
    await this.tokens.createIndex(
      { user: 1 },
      { name: "user_index" },
    );
    await this.tokens.createIndex(
      { token: 1 },
      { name: "token_unique", unique: true },
    );
  }

  async generate({ user }: { user: string }): Promise<{ token: string }> {
    try {
      const payload = {
        sub: user,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      };

      const token = jwt.sign(payload, this.secretKey, { algorithm: "HS256" });

      // Store token association
      await this.tokens.replaceOne(
        { user },
        { user, token },
        { upsert: true },
      );

      return { token };
    } catch (error: unknown) {
      throw new Error(
        `Token generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  async verify(
    { token }: { token: string },
  ): Promise<{ user: string } | { error: string }> {
    try {
      const payload = jwt.verify(token, this.secretKey) as jwt.JwtPayload;

      if (!payload.sub) {
        return { error: "Invalid token: no subject" };
      }

      // Verify token is still valid in our database
      const tokenDoc = await this.tokens.findOne({ token });
      if (!tokenDoc) {
        return { error: "Token not found or revoked" };
      }

      return { user: payload.sub as string };
    } catch (error: unknown) {
      return {
        error: `Token verification failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Query functions
  async _getUser(
    { token }: { token: string },
  ): Promise<Array<{ user: string; token: string }>> {
    const tokenDoc = await this.tokens.findOne({ token });
    if (!tokenDoc) return [];
    return [{ user: tokenDoc.user, token: tokenDoc.token }];
  }
}
