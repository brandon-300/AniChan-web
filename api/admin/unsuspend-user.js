import nodemailer from 'nodemailer';

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

    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        is_suspended: false,
        suspended_until: null,
        admin_note: null,
      })
      .eq('id', userId);

    if (error) throw error;

    if (profile.email) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.ADMIN_EMAIL,
            pass: process.env.GMAIL_APP_PASSWORD,
          },
        });

        await transporter.sendMail({
          from: `"AniChan" <${process.env.ADMIN_EMAIL}>`,
          to: profile.email,
          subject: 'Your account has been reinstated',
          html: `<div style="text-align:center;margin-bottom:16px">
                  <img src="https://yphxpgssdqboufbgazwi.supabase.co/storage/v1/object/public/avatars/site-logo/logo.png" alt="AniChan" style="width:60px;height:60px;border-radius:50%" />
                </div>
                <p>Hi ${profile.username || 'user'},</p>
                <p>Your account on AniChan has been unsuspended. You can now log in again.</p>
                <p>— AniChan Team</p>`,
        });
      } catch (emailErr) {
        console.error('Failed to send unsuspension email:', emailErr);
        return res.status(500).json({
          error: 'Email failed: ' + emailErr.message,
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}