export default async function handler(req, res) {
  try {
    // Dynamic imports – safe even if modules are temporarily missing
    const [{ createClient }, { Resend }] = await Promise.all([
      import('@supabase/supabase-js'),
      import('resend')
    ]);

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ✔️ Fixed: use lowercase property name, no .get()
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized: no token' });
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden: invalid admin' });
    }

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

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'AniChan <onboarding@resend.dev>',
      to: [process.env.ADMIN_EMAIL],
      subject: 'AniChan Weekly Report',
      html: emailBody,
    });

    if (emailError) {
      return res.status(500).json({
        error: emailError.message,
        code: emailError.name || 'RESEND_ERROR',
      });
    }

    return res.status(200).json({ success: true, messageId: emailData?.id });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      type: err.constructor.name
    });
  }
}