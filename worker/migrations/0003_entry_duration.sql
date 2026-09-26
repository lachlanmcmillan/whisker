-- Video length in seconds; NULL until looked up, 0 when it can't be known.
ALTER TABLE entries ADD COLUMN durationSeconds INTEGER;
