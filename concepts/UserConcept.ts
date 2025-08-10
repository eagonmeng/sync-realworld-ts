import { Collection, Db, MongoClient } from "mongodb";

export class UserConcept {
  private db!: Db;
  private users!: Collection;

  constructor() {}

  async init() {
    const uri = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    await client.connect();
    this.db = client.db(Deno.env.get("DATABASE_NAME") || "realworld");
    this.users = this.db.collection("users");

    // Create indexes for unique constraints
    await this.users.createIndex(
      { name: 1 },
      { name: "name_unique", unique: true },
    );
    await this.users.createIndex(
      { email: 1 },
      { name: "email_unique", unique: true },
    );
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async register(
    { user, name, email }: { user: string; name: string; email: string },
  ): Promise<{ user: string } | { error: string }> {
    try {
      // Validate email format
      if (!this.isValidEmail(email)) {
        return { error: "Invalid email format" };
      }

      // Check uniqueness
      const existingByName = await this.users.findOne({ name });
      if (existingByName) {
        return { error: "Username already exists" };
      }

      const existingByEmail = await this.users.findOne({ email });
      if (existingByEmail) {
        return { error: "Email already exists" };
      }

      // Insert user
      await this.users.insertOne({
        user,
        name,
        email,
      });

      return { user };
    } catch (error: unknown) {
      return {
        error: `Registration failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  async update(
    { user, name, email }: { user: string; name?: string; email?: string },
  ): Promise<{ user: string } | { error: string }> {
    try {
      const existingUser = await this.users.findOne({ user });
      if (!existingUser) {
        return { error: "User not found" };
      }

      const updateData: Record<string, unknown> = {};

      if (name !== undefined) {
        // Check name uniqueness
        const existingByName = await this.users.findOne({
          name,
          user: { $ne: user },
        });
        if (existingByName) {
          return { error: "Username already exists" };
        }
        updateData.name = name;
      }

      if (email !== undefined) {
        // Validate email format
        if (!this.isValidEmail(email)) {
          return { error: "Invalid email format" };
        }

        // Check email uniqueness
        const existingByEmail = await this.users.findOne({
          email,
          user: { $ne: user },
        });
        if (existingByEmail) {
          return { error: "Email already exists" };
        }
        updateData.email = email;
      }

      await this.users.updateOne({ user }, { $set: updateData });
      return { user };
    } catch (error: unknown) {
      return {
        error: `Update failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Query functions
  async _getByName(
    { name }: { name: string },
  ): Promise<Array<{ user: string; name: string; email: string }>> {
    const userData = await this.users.findOne({ name });
    if (!userData) return [];
    return [{
      user: userData.user,
      name: userData.name,
      email: userData.email,
    }];
  }

  async _getByEmail(
    { email }: { email: string },
  ): Promise<Array<{ user: string; name: string; email: string }>> {
    const userData = await this.users.findOne({ email });
    if (!userData) return [];
    return [{
      user: userData.user,
      name: userData.name,
      email: userData.email,
    }];
  }

  async _get(
    { user }: { user: string },
  ): Promise<Array<{ user: string; name: string; email: string }>> {
    const userData = await this.users.findOne({ user });
    if (!userData) return [];
    return [{
      user: userData.user,
      name: userData.name,
      email: userData.email,
    }];
  }
}
