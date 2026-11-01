# Bhasha — Bangla to English Practice

A personal practice site built with Next.js, React, Tailwind CSS, and MongoDB.

## Run locally

1. Install Node.js 20.9 or newer.
2. Copy .env.example to .env.local.
3. Replace the placeholder in MONGODB_URI with your MongoDB connection string and set MONGODB_DB if you want a different database name.
4. In MongoDB Atlas, create a database user and allow your development machine's IP address in Network Access.
5. From this folder, run: npm run dev
6. Open http://localhost:3000.

Keep .env.local private. It contains database credentials and should never be committed or pasted into chat.

## How entries are stored

Sentence and vocabulary entries are saved as documents in the entries collection. Each document has a type (sentence or vocabulary), bangla, english, category, and createdAt; vocabulary entries may also include example.

The site currently supports adding entries one at a time and practicing them with the English answer hidden until revealed.

