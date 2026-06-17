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

    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Delete associated data (order matters to avoid FK violations)
    // 1. Delete messages
    await supabase.from('messages').delete().eq('sender_id', userId);
    await supabase.from('messages').delete().eq('receiver_id', userId);
    
    // 2. Delete chat rooms where user is involved
    await supabase.from('chat_rooms').delete().eq('user_one_id', userId);
    await supabase.from('chat_rooms').delete().eq('user_two_id', userId);
    
    // 3. Delete comments
    await supabase.from('anime_comments').delete().eq('user_id', userId);
    
    // 4. Delete user presence
    await supabase.from('user_presence').delete().eq('user_id', userId);
    
    // 5. Delete profile
    const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
    if (profileError) throw profileError;

    // 6. Delete auth user (requires service role)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error('Failed to delete auth user:', authDeleteError);
      // Auth user deletion is not critical; profile is gone anyway.
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
    });
  }
}