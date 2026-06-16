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

    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized: no token' });
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden: invalid admin' });
    }

    // Build sitemap XML
    const { data: anime } = await supabase.from('anime').select('id,title');
    const baseUrl = 'https://ani-chan-web.vercel.app';
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += `  <url><loc>${baseUrl}/</loc></url>\n`;
    xml += `  <url><loc>${baseUrl}/anime.html</loc></url>\n`;
    for (const a of anime) {
      xml += `  <url><loc>${baseUrl}/anime_info.html?id=${a.id}</loc></url>\n`;
    }
    xml += '</urlset>';

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('public-files')   // <-- make sure this bucket exists and is public
      .upload('sitemap.xml', xml, { contentType: 'application/xml', upsert: true });

    if (error) {
      // Return detailed Supabase error
      return res.status(500).json({
        error: error.message,
        details: error
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
}