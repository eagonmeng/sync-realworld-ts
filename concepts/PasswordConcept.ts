import { Collection, Db, MongoClient } from "mongodb";

export class PasswordConcept {
  private db!: Db;
  private passwords!: Collection;

  constructor() {}

  async init() {
    const uri = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    await client.connect();
    this.db = client.db(Deno.env.get("DATABASE_NAME") || "realworld");
    this.passwords = this.db.collection("passwords");

    // Create index for user lookup
    await this.passwords.createIndex(
      { user: 1 },
      { name: "user_unique", unique: true },
    );
  }

  private validatePassword(password: string): boolean {
    // Basic password validation: at least 6 characters
    return password.length >= 6;
  }

  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const digest = await crypto.subtle.digest("SHA-256", data);
    // Convert ArrayBuffer to hex string for storage
    const hashArray = Array.from(new Uint8Array(digest));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    return hashHex;
  }

  async set(
    { user, password }: { user: string; password: string },
  ): Promise<{ user: string } | { error: string }> {
    try {
      if (!this.validatePassword(password)) {
        return { error: "Password must be at least 6 characters long" };
      }

      const hashedPassword = await this.hashPassword(password);

      await this.passwords.replaceOne(
        { user },
        { user, password: hashedPassword },
        { upsert: true },
      );

      return { user };
    } catch (error: unknown) {
      return {
        error: `Password set failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  async check(
    { user, password }: { user: string; password: string },
  ): Promise<{ valid: boolean } | { error: string }> {
    try {
      const userPassword = await this.passwords.findOne({ user });
      if (!userPassword) {
        return { error: "User has no password set" };
      }

      const hashed = await this.hashPassword(password);
      const isValid = hashed === (userPassword.password as string);
      return { valid: isValid };
    } catch (error: unknown) {
      return {
        error: `Password check failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  validate(
    { password }: { password: string },
  ): { valid: boolean } {
    return { valid: this.validatePassword(password) };
  }

  async update(
    { user, password }: { user: string; password: string },
  ): Promise<{ user: string } | { error: string }> {
    try {
      const existingPassword = await this.passwords.findOne({ user });
      if (!existingPassword) {
        return { error: "User has no password set" };
      }

      if (!this.validatePassword(password)) {
        return { error: "Password must be at least 6 characters long" };
      }

      const hashedPassword = await this.hashPassword(password);

      await this.passwords.updateOne(
        { user },
        { $set: { password: hashedPassword } },
      );

      return { user };
    } catch (error: unknown) {
      return {
        error: `Password update failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Query functions
  async _hasPassword(
    { user }: { user: string },
  ): Promise<Array<{ user: string; hasPassword: boolean }>> {
    const userPassword = await this.passwords.findOne({ user });
    return [{ user, hasPassword: !!userPassword }];
  }
}
