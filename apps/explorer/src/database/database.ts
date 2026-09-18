import {
    drizzle,
  } from 'drizzle-orm/node-postgres';
  
  import {
    Pool,
  } from 'pg';
  
  import * as schema from './schema.js';
  
  export function createDatabase(
    databaseUrl: string,
  ) {
    const pool =
      new Pool({
        connectionString:
          databaseUrl,
      });
  
    const db =
      drizzle(
        pool,
        {
          schema,
        },
      );
  
    return {
      db,
  
      async close():
        Promise<void> {
        await pool.end();
      },
    };
  }
  
  export type Database =
    ReturnType<
      typeof createDatabase
    >['db'];