const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[aviso] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados. ' +
    'Copie backend/.env.example para backend/.env e preencha os valores.'
  );
}

// Único cliente Supabase do backend: usa a service_role key (acesso total,
// ignora RLS). O Supabase aqui é só o Postgres - login e permissões são
// controlados pelo próprio backend (ver middleware/authMiddleware.js).
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

module.exports = { supabaseAdmin };
