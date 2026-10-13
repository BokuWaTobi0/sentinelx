-- Record the provider selected for the most recent claimed attempt.
ALTER TABLE automation_jobs ADD COLUMN provider text CHECK (provider IN ('LOCAL','WINDMILL'));
