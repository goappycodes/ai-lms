-- P2-25 · Archiving a school.
--
-- Not a delete. Classes reference the school with ON DELETE RESTRICT, and
-- behind those sit students, progress rows and issued certificates — a school
-- that ran a term cannot be removed without taking that history with it. So a
-- school leaves the platform the same way a person does: it is marked, its
-- login stops working, and everything it did stays where it is.
--
-- Archiving is reversible; that is the point of a status column over a delete.

ALTER TABLE schools
  ADD COLUMN status text NOT NULL DEFAULT 'active';

ALTER TABLE schools
  ADD CONSTRAINT schools_status_valid CHECK (status IN ('active', 'archived'));

-- The schools list is ordered by status first, so the index that serves it
-- covers both columns.
CREATE INDEX schools_status_idx ON schools (status, name);
