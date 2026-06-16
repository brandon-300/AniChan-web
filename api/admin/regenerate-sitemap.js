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

    // ✔️ Fixed: use lowercase property name, no .get()
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized: no token' });
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden: invalid admin' });
    }

    const { data: anime } = await supabase.from('anime').select('id,title');
    const baseUrl = 'https://ani-chan-web.vercel.app';
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += `  <url><loc>${baseUrl}/</loc></url>\n`;
    xml += `  <url><loc>${baseUrl}/anime.html</loc></url>\n`;
    for (const a of anime) {
      xml += `  <url><loc>${baseUrl}/anime_info.html?id=${a.id}</loc></url>\n`;
    }
    xml += '</urlset>';

    // Use your bucket name (create it first in Supabase if it doesn't exist)
    const { error } = await supabase.storage
      .from('public-files')
      .upload('sitemap.xml', xml, { contentType: 'application/xml', upsert: true });
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      type: err.constructor.name
    });
  }
}