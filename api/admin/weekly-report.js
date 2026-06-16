import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [usersRes, commentsRes, animeRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('anime_comments').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('anime').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo)
    ]);

    const newUsers = usersRes.count || 0;
    const newComments = commentsRes.count || 0;
    const newAnime = animeRes.count || 0;
    const totalAnime = (await supabase.from('anime').select('id', { count: 'exact', head: true })).count || 0;

    const emailBody = `
      <h2>AniChan Weekly Report</h2>
      <p><strong>New users:</strong> ${newUsers}</p>
      <p><strong>New comments:</strong> ${newComments}</p>
      <p><strong>New anime added:</strong> ${newAnime}</p>
      <p><strong>Total anime in library:</strong> ${totalAnime}</p>
      <p><em>Sent automatically by AniChan</em></p>
    `;

    await resend.emails.send({
      from: 'AniChan <report@yourdomain.com>',   // verified domain in Resend
      to: [process.env.ADMIN_EMAIL],
      subject: 'AniChan Weekly Report',
      html: emailBody,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}