import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Auth check
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized: no token' });
    }
    const token = authHeader.split(' ')[1];

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden: invalid admin' });
    }

    // Fetch current cache version
    const { data: current, error: fetchError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'cache_version')
      .maybeSingle();

    if (fetchError) throw fetchError;

    // Increment it
    const newVersion = String((parseInt(current?.value || '0', 10) || 0) + 1);

    const { error: upsertError } = await supabase
      .from('settings')
      .upsert({ key: 'cache_version', value: newVersion });

    if (upsertError) throw upsertError;

    return res.status(200).json({ success: true, version: newVersion });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};