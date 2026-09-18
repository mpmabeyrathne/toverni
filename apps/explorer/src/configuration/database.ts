import {
    fileURLToPath,
  } from 'node:url';
  
  import {
    config,
  } from 'dotenv';
  
  import {
    z,
  } from 'zod';
  
  const rootEnvPath =
    fileURLToPath(
      new URL(
        '../../../../.env',
        import.meta.url,
      ),
    );
  
    config({
        path: rootEnvPath,
        override: true,
      });
  
  const databaseUrlSchema =
    z
      .string({
        error:
          'DATABASE_URL is required',
      })
      .min(
        1,
        'DATABASE_URL is required',
      )
      .refine(
        (value) =>
          value.startsWith(
            'postgresql://',
          ) ||
          value.startsWith(
            'postgres://',
          ),
        {
          message:
            'DATABASE_URL must be a PostgreSQL connection string',
        },
      );
  
  export function getDatabaseUrl():
    string {
    return databaseUrlSchema.parse(
      process.env.DATABASE_URL,
    );
  }