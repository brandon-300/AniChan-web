import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin auth check
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized: no token' });
  const token = authHeader.split(' ')[1];

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden: invalid admin' });
  }

  // Fetch ALL anime in batches
  const allAnime = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data: batch, error } = await supabase
      .from('anime')
      .select('*')
      .order('title')
      .range(from, from + batchSize - 1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!batch || batch.length === 0) break;

    allAnime.push(...batch);
    from += batchSize;

    // Safety: stop if we get fewer rows than the batch size (last page)
    if (batch.length < batchSize) break;
  }

  // Define CSV columns (same as before)
  const columns = [
    'id', 'title', 'title_en', 'title_jp', 'type', 'status',
    'ep_total', 'score', 'year', 'genres', 'studio', 'duration',
    'release_type', 'aired_from', 'aired_to', 'image_url', 'updated_at'
  ];

  const escapeCSV = (val) => {
    if (val == null) return '';
    const str = Array.isArray(val) ? val.join(', ') : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const header = columns.map(escapeCSV).join(',');
  const rows = allAnime.map(a => columns.map(col => escapeCSV(a[col])).join(','));
  const csv = [header, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="anichan_export.csv"');
  return res.status(200).send(csv);
}