-- Down migration to restore the original 'Escola Alpha' names.

UPDATE schools SET name = 'Escola Alpha - Centro' WHERE code = 'ESC001';
UPDATE schools SET name = 'Escola Alpha - Zona Sul' WHERE code = 'ESC002';
UPDATE schools SET name = 'Escola Alpha - Zona Norte' WHERE code = 'ESC003';
UPDATE schools SET name = 'Escola Alpha - Zona Oeste' WHERE code = 'ESC004';
UPDATE schools SET name = 'Escola Alpha - Campinas' WHERE code = 'ESC005';
UPDATE schools SET name = 'Escola Alpha - Ribeirão Preto' WHERE code = 'ESC006';
