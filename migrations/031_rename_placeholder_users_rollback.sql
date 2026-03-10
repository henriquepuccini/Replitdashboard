-- Down migration to revert the full names of existing placeholder users in production.

UPDATE users SET full_name = 'Admin Placeholder' WHERE email = 'admin@placeholder.local';
UPDATE users SET full_name = 'Director Placeholder' WHERE email = 'director@placeholder.local';
UPDATE users SET full_name = 'Seller Placeholder' WHERE email = 'seller@placeholder.local';
UPDATE users SET full_name = 'Executive Placeholder' WHERE email = 'exec@placeholder.local';
UPDATE users SET full_name = 'Finance Placeholder' WHERE email = 'finance@placeholder.local';
