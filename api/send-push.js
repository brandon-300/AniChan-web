import webPush from 'web-push';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Auth check: must come from a logged‑in user
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  const token = authHeader.split(' ')[1];
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  const { receiverId, title, body, url } = req.body || {};
  if (!receiverId) return res.status(400).json({ error: 'Missing receiverId' });

  // Get the receiver's push subscription
  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', receiverId)
    .maybeSingle();

  if (!sub) return res.status(404).json({ error: 'No subscription found' });

  // Set VAPID details from environment variables
  webPush.setVapidDetails(
    'mailto:' + process.env.ADMIN_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const pushPayload = {
    title: title || 'AniChan',
    body: body || 'You have a new message',
    icon: 'https://yphxpgssdqboufbgazwi.supabase.co/storage/v1/object/public/avatars/site-logo/icon-512.png',
    url: url || '/'
  };

  try {
    await webPush.sendNotification(sub, JSON.stringify(pushPayload));
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Push send error:', err);
    return res.status(500).json({ error: 'Push failed' });
  }
}