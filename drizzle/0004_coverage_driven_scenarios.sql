ALTER TABLE "generated_scenarios" ADD COLUMN "ranking_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;
