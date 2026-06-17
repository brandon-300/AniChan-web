export default async function handler(req, res) {
  try {
    const { createClient } = await import('@supabase/supabase-js');

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify admin token
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized: no token' });
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden: invalid admin' });
    }

    const { userId, durationHours, adminNote } = req.body || {};
    if (!userId || !durationHours) {
      return res.status(400).json({ error: 'Missing userId or durationHours' });
    }

    // Calculate suspended_until
    const suspendedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('profiles')
      .update({
        is_suspended: true,
        suspended_until: suspendedUntil,
        admin_note: adminNote || null,
      })
      .eq('id', userId);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
    });
  }
}