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

    const { userId, durationHours, adminNote } = req.body || {};
    if (!userId || !durationHours) {
      return res.status(400).json({ error: 'Missing userId or durationHours' });
    }

    const suspendedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('profiles')
      .update({
        is_suspended: true,
        suspended_until: suspendedUntil,
        admin_note: adminNote || null,
      })
      .eq('id', userId);

    if (error) throw error;

    // Send suspension email to the user
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('id', userId)
      .single();

    if (profile?.email) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.ADMIN_EMAIL,
            pass: process.env.GMAIL_APP_PASSWORD,
          },
        });

        const hours = durationHours;
        const durationText = hours >= 24 ? `${hours / 24} day(s)` : `${hours} hour(s)`;

        await transporter.sendMail({
          from: `"AniChan" <${process.env.ADMIN_EMAIL}>`,
          to: profile.email,
          subject: 'Your account has been suspended',
          html: `<p>Hi ${profile.username || 'user'},</p>
                 <p>Your account on AniChan has been suspended for <strong>${durationText}</strong>.</p>
                 ${adminNote ? `<p><strong>Reason:</strong> ${adminNote}</p>` : ''}
                 <p>You will be able to log in again after the suspension period ends.</p>
                 <p>— AniChan Team</p>`,
        });
      } catch (emailErr) {
        console.error('Failed to send suspension email:', emailErr);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}