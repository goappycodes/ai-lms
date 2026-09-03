-- P1-09 · Remove the catalogue-only schema.
--
-- courses, lessons and videos are all rebuilt with different shapes (no
-- chapter, no course ownership on a lesson, locale everywhere), so they are
-- dropped rather than altered. chapters and quizzes go entirely (D-01, D-02).
-- Safe because the database holds no rows: this is a rebuild, not a migration
-- of data. See docs/SCHEMA.md, "What changes from today".

DROP TABLE IF EXISTS quiz_questions CASCADE;
DROP TABLE IF EXISTS quizzes        CASCADE;
DROP TABLE IF EXISTS certificates   CASCADE;
DROP TABLE IF EXISTS pdfs           CASCADE;
DROP TABLE IF EXISTS videos         CASCADE;
DROP TABLE IF EXISTS lessons        CASCADE;
DROP TABLE IF EXISTS chapters       CASCADE;
DROP TABLE IF EXISTS courses        CASCADE;
