const fs = require('node:fs');
const crypto = require('node:crypto');
const { loadEnvConfig } = require('@next/env');
const { MongoClient } = require('mongodb');
const normalize = (value) => value.normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const key = (e) => crypto.createHash('sha256').update(JSON.stringify([e.type, normalize(e.bangla), normalize(e.english)])).digest('hex');
async function main() {
  loadEnvConfig(process.cwd());
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
  if (!Array.isArray(input) || input.some((e) => e.type !== 'sentence' || !e.bangla?.trim() || !e.english?.trim() || !e.category?.trim())) throw new Error('Invalid import data');
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<db_password>')) throw new Error('MongoDB configuration incomplete');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const collection = client.db(process.env.MONGODB_DB || 'bhasha_app').collection('entries');
    const existing = await collection.find({}).toArray();
    const seen = new Set(existing.map(key));
    const pending = [];
    for (const e of input) { const importKey = key(e); if (!seen.has(importKey)) { seen.add(importKey); pending.push({ ...e, importKey }); } }
    console.log(JSON.stringify({ input: input.length, existing: existing.length, newEntries: pending.length, duplicatesSkipped: input.length - pending.length, categories: [...new Set(input.map((e) => e.category))].length }));
    if (!process.argv.includes('--apply')) return;
    const output = process.argv[3];
    if (!output || output.startsWith('--')) throw new Error('Receipt directory required');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(output + '/database-before-import.json', JSON.stringify(existing, null, 2));
    const createdAt = new Date();
    const documents = pending.sort((a, b) => b.sourceNumber - a.sourceNumber).map((e) => ({ ...e, createdAt }));
    const result = documents.length ? await collection.insertMany(documents, { ordered: true }) : { insertedCount: 0, insertedIds: {} };
    const verified = documents.length ? await collection.countDocuments({ importKey: { $in: documents.map((e) => e.importKey) } }) : 0;
    const receipt = { importedAt: createdAt, insertedCount: result.insertedCount, verified, duplicatesSkipped: input.length - pending.length, insertedIds: result.insertedIds, categories: [...new Set(input.map((e) => e.category))].sort() };
    fs.writeFileSync(output + '/import-receipt.json', JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify({ inserted: result.insertedCount, verified, totalEntries: await collection.countDocuments({}) }));
  } finally { await client.close(); }
}
main().catch((e) => { console.error('Import failed:', e.name, e.code || 'Check connection or input configuration.'); process.exitCode = 1; });
