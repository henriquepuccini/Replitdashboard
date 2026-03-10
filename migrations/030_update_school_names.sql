-- Up migration to update existing school names.
-- It matches against the original 'ESC001'-'ESC006' codes so the change works predictably.

UPDATE schools SET name = 'Vila Operária' WHERE code = 'ESC001';
UPDATE schools SET name = 'São João' WHERE code = 'ESC002';
UPDATE schools SET name = 'Cordeiros' WHERE code = 'ESC003';
UPDATE schools SET name = 'Penha' WHERE code = 'ESC004';
UPDATE schools SET name = 'Balneário Piçarras' WHERE code = 'ESC005';
UPDATE schools SET name = 'Centro Itajaí' WHERE code = 'ESC006';
