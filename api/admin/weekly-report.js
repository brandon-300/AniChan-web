export default async function handler(req, res) {
  try {
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

    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized: no token' });
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden: invalid admin' });
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // ── Basic counts ──
    const [usersRes, commentsRes, animeRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('anime_comments').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('anime').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo)
    ]);
    const totalAnime = (await supabase.from('anime').select('id', { count: 'exact', head: true })).count || 0;

    const newUsers = usersRes.count || 0;
    const newComments = commentsRes.count || 0;
    const newAnime = animeRes.count || 0;

    // ── Top 5 most liked comments this week ──
    const { data: recentComments } = await supabase
      .from('anime_comments')
      .select('id, message, liked_by, user_id')
      .gte('created_at', weekAgo);

    const sortedComments = (recentComments || [])
      .map(c => ({
        message: c.message?.substring(0, 80) + (c.message?.length > 80 ? '…' : ''),
        likes: (c.liked_by || []).length,
        userId: c.user_id
      }))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5);

    // ── New users (up to 5) ──
    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('username')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(5);

    // ── Most active user (by number of comments) ──
    const { data: activeUsers } = await supabase
      .from('anime_comments')
      .select('user_id')
      .gte('created_at', weekAgo);

    const activityMap = {};
    (activeUsers || []).forEach(c => {
      activityMap[c.user_id] = (activityMap[c.user_id] || 0) + 1;
    });
    let topUserId = null, topCount = 0;
    for (const [uid, count] of Object.entries(activityMap)) {
      if (count > topCount) { topCount = count; topUserId = uid; }
    }
    let topUserName = '—';
    if (topUserId) {
      const { data: topUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', topUserId)
        .single();
      if (topUser) topUserName = topUser.username;
    }

    // Resolve usernames for top‑liked comments
    const commentUserIds = [...new Set(sortedComments.map(c => c.userId))];
    const userMap = {};
    if (commentUserIds.length) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', commentUserIds);
      (users || []).forEach(u => { userMap[u.id] = u.username; });
    }

    // ── Build the email ──
    const commentLines = sortedComments.length
      ? sortedComments.map((c, i) =>
          `<p style="margin:2px 0"><strong>${i+1}.</strong> @${userMap[c.userId] || 'user'}: «${c.message}» – 👍 ${c.likes}</p>`).join('')
      : '<p><em>No comments this week.</em></p>';

    const newUserLines = recentUsers?.length
      ? recentUsers.map(u => `<li>@${u.username}</li>`).join('')
      : '<li>None</li>';

    const emailBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#51dad3">AniChan Weekly Report</h2>
        <p style="color:#666">Week of ${new Date(weekAgo).toLocaleDateString()} – ${new Date().toLocaleDateString()}</p>

        <h3 style="margin-bottom:4px">📊 Quick Stats</h3>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:4px">New users</td><td><strong>${newUsers}</strong></td></tr>
          <tr><td style="padding:4px">New comments</td><td><strong>${newComments}</strong></td></tr>
          <tr><td style="padding:4px">New anime added</td><td><strong>${newAnime}</strong></td></tr>
          <tr><td style="padding:4px">Total anime library</td><td><strong>${totalAnime}</strong></td></tr>
        </table>

        <h3 style="margin-bottom:4px">🏆 Top 5 Most Liked Comments</h3>
        ${commentLines}

        <h3 style="margin-bottom:4px">👋 New Users</h3>
        <ul>${newUserLines}</ul>

        <h3 style="margin-bottom:4px">💬 Most Active User</h3>
        <p>@${topUserName} (${topCount} comments)</p>

        <p style="margin-top:24px;color:#999">🔧 <a href="https://ani-chan-web.vercel.app/admin.html">Admin Panel</a></p>
        <p style="color:#aaa;font-size:12px">Sent automatically by AniChan</p>
      </div>
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