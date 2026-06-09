import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;

function getDatabaseName(): string {
  return process.env.MONGODB_DB_NAME ?? "ai_closet";
}

export async function getMongoDb(): Promise<Db> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL 未配置，无法连接 MongoDB");
  }

  if (!client) {
    client = new MongoClient(databaseUrl);
    await client.connect();
  }

  return client.db(getDatabaseName());
}

export async function ensureMongoIndexes(): Promise<void> {
  const db = await getMongoDb();

  await Promise.all([
    db.collection("users").createIndex({ openid: 1 }, { unique: true, sparse: true }),
    db.collection("users").createIndex({ deletedAt: 1 }),
    db.collection("clothing_items").createIndex({ userId: 1, status: 1, createdAt: -1 }),
    db.collection("user_photos").createIndex({ userId: 1, deletedAt: 1 }),
    db.collection("ai_tasks").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("ai_tasks").createIndex({ status: 1, createdAt: 1 }),
    db.collection("credit_logs").createIndex({ userId: 1, createdAt: -1 })
  ]);
}

export async function closeMongoConnection(): Promise<void> {
  if (!client) {
    return;
  }

  await client.close();
  client = null;
}
