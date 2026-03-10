-- Up migration to update the full names of existing placeholder users in production.

UPDATE users SET full_name = 'Administrador' WHERE email = 'admin@placeholder.local';
UPDATE users SET full_name = 'Diretoria' WHERE email = 'director@placeholder.local';
UPDATE users SET full_name = 'Operação' WHERE email = 'seller@placeholder.local';
UPDATE users SET full_name = 'Coordenação' WHERE email = 'exec@placeholder.local';
UPDATE users SET full_name = 'Financeiro' WHERE email = 'finance@placeholder.local';
