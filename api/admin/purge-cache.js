import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized: no token' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden: invalid admin' });
  }

  // Increment cache version
  const { data: existing } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'cache_version')
    .maybeSingle();

  const current = parseInt(existing?.value || '0', 10) || 0;
  const newVersion = current + 1;

  await supabase
    .from('settings')
    .upsert({ key: 'cache_version', value: String(newVersion) });

  return res.status(200).json({ version: newVersion });
}