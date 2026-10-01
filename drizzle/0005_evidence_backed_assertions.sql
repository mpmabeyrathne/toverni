ALTER TABLE "generated_tests" ADD COLUMN "assertions" jsonb DEFAULT '[]'::jsonb NOT NULL;
