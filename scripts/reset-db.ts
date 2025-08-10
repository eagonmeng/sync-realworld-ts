import "@std/dotenv/load";
import { MongoClient } from "mongodb";

async function main() {
  const uri = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017";
  const dbName = Deno.env.get("DATABASE_NAME") || "realworld";
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const collections = await db.collections();
    for (const c of collections) {
      await db.collection(c.collectionName).deleteMany({});
    }
    console.log(`✅ Cleared all collections in database: ${dbName}`);
  } finally {
    await client.close();
  }
}

if (import.meta.main) {
  await main();
}
