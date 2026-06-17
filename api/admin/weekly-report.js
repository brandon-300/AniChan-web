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

    const newUsersCount = usersRes.count || 0;
    const newCommentsCount = commentsRes.count || 0;
    const newAnimeCount = animeRes.count || 0;

    // ── Overall totals ──
    const [totalUsersRes, totalCommentsRes, totalAnimeRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('anime_comments').select('id', { count: 'exact', head: true }),
      supabase.from('anime').select('id', { count: 'exact', head: true })
    ]);
    const totalUsers = totalUsersRes.count || 0;
    const totalComments = totalCommentsRes.count || 0;
    const totalAnime = totalAnimeRes.count || 0;

    // ── Library status breakdown ──
    const [airingRes, finishedRes, upcomingRes] = await Promise.all([
      supabase.from('anime').select('id', { count: 'exact', head: true }).eq('status', 'Currently Airing'),
      supabase.from('anime').select('id', { count: 'exact', head: true }).eq('status', 'Aired'),
      supabase.from('anime').select('id', { count: 'exact', head: true }).eq('status', 'Not yet aired')
    ]);
    const airingCount = airingRes.count || 0;
    const finishedCount = finishedRes.count || 0;
    const upcomingCount = upcomingRes.count || 0;

    // ── Top 5 most liked comments this week ──
    const { data: recentComments } = await supabase
      .from('anime_comments')
      .select('id, message, liked_by, user_id')
      .gte('created_at', weekAgo);

    const sortedComments = (recentComments || [])
      .map(c => ({
        message: c.message?.substring(0, 100) + (c.message?.length > 100 ? '…' : ''),
        likes: (c.liked_by || []).length,
        userId: c.user_id
      }))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5);

    // ── New users (up to 10) ──
    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('username')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    // ── Most active user ──
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

    // ── New anime titles (up to 20) ──
    const { data: newAnimeTitles } = await supabase
      .from('anime')
      .select('title')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    // ── Most discussed anime this week ──
    const { data: animeComments } = await supabase
      .from('anime_comments')
      .select('anime_id')
      .gte('created_at', weekAgo);

    const animeCommentCounts = {};
    (animeComments || []).forEach(c => {
      animeCommentCounts[c.anime_id] = (animeCommentCounts[c.anime_id] || 0) + 1;
    });
    let topAnimeId = null, topAnimeComments = 0;
    for (const [aid, cnt] of Object.entries(animeCommentCounts)) {
      if (cnt > topAnimeComments) { topAnimeComments = cnt; topAnimeId = aid; }
    }
    let topAnimeTitle = '—';
    if (topAnimeId) {
      const { data: topAnime } = await supabase
        .from('anime')
        .select('title')
        .eq('id', topAnimeId)
        .single();
      if (topAnime) topAnimeTitle = topAnime.title;
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

    const newAnimeLines = newAnimeTitles?.length
      ? newAnimeTitles.map(a => `<li>${a.title}</li>`).join('')
      : '<li>None</li>';

    const emailBody = `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto">
        <h2 style="color:#51dad3">AniChan Weekly Report</h2>
        <p style="color:#666">Period: ${new Date(weekAgo).toLocaleDateString()} – ${new Date().toLocaleDateString()}</p>

        <h3 style="margin-bottom:4px">📊 Quick Overview</h3>
        <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
          <tr><td style="padding:4px">Total registered users</td><td><strong>${totalUsers}</strong></td></tr>
          <tr><td style="padding:4px">Total comments</td><td><strong>${totalComments}</strong></td></tr>
          <tr><td style="padding:4px">Total anime in library</td><td><strong>${totalAnime}</strong></td></tr>
          <tr><td colspan="2" style="padding:8px 0 4px"><strong>This week's activity:</strong></td></tr>
          <tr><td style="padding:4px">New users</td><td><strong>${newUsersCount}</strong></td></tr>
          <tr><td style="padding:4px">New comments</td><td><strong>${newCommentsCount}</strong></td></tr>
          <tr><td style="padding:4px">New anime added</td><td><strong>${newAnimeCount}</strong></td></tr>
        </table>

        <h3 style="margin-bottom:4px">📚 Library Status</h3>
        <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
          <tr><td style="padding:4px">Currently Airing</td><td><strong>${airingCount}</strong></td></tr>
          <tr><td style="padding:4px">Finished Airing</td><td><strong>${finishedCount}</strong></td></tr>
          <tr><td style="padding:4px">Not yet aired</td><td><strong>${upcomingCount}</strong></td></tr>
        </table>

        <h3 style="margin-bottom:4px">🏆 Top 5 Most Liked Comments</h3>
        ${commentLines}

        <h3 style="margin-bottom:4px">👋 New Users (latest 10)</h3>
        <ul>${newUserLines}</ul>

        <h3 style="margin-bottom:4px">📺 New Anime This Week (latest 20)</h3>
        <ul>${newAnimeLines}</ul>

        <h3 style="margin-bottom:4px">💬 Most Active User</h3>
        <p>@${topUserName} (${topCount} comments this week)</p>

        <h3 style="margin-bottom:4px">🔥 Most Discussed Anime</h3>
        <p>«${topAnimeTitle}» – ${topAnimeComments} comments this week</p>

        <p style="margin-top:24px;color:#999">🔧 <a href="https://ani-chan-web.vercel.app/admin.html">Admin Panel</a></p>
        <p style="color:#aaa;font-size:12px">Report generated automatically by AniChan</p>
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