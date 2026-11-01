import { MongoClient } from "mongodb";

const globalWithMongo = globalThis as typeof globalThis & { _mongoClientPromise?: Promise<MongoClient> };

export default function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI. Add it to your local .env.local file.");
  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = new MongoClient(uri).connect();
  }
  return globalWithMongo._mongoClientPromise;
}
