import {
    config,
  } from 'dotenv';
  
  import {
    defineConfig,
  } from 'drizzle-kit';
  
  config({
    path: '.env',
    override: true,
  });
  
  const databaseUrl =
    process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is missing from root .env',
    );
  }
  
  export default defineConfig({
    schema:
      './apps/explorer/src/database/schema.ts',
  
    out:
      './drizzle',
  
    dialect:
      'postgresql',
  
    dbCredentials: {
      url: databaseUrl,
    },
  
    verbose: true,
    strict: true,
  });