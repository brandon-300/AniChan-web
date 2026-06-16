import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  return res.status(200).json({ test: 'purge-cache works' });
}