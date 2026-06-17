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

    const { userId, adminNote } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    // Fetch user details before clearing
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('id', userId)
      .single();

    // Clear deletion flags
    const { error } = await supabase
      .from('profiles')
      .update({
        is_pending_delete: false,
        deleted_at: null,
        admin_note: null,
      })
      .eq('id', userId);

    if (error) throw error;

    // Send email to user
    if (profile?.email) {
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
          subject: 'Account deletion cancelled',
          html: `<p>Hi ${profile.username || 'user'},</p>
                 <p>The deletion of your AniChan account has been <strong>cancelled</strong>.</p>
                 ${adminNote ? `<p><strong>Admin note:</strong> ${adminNote}</p>` : ''}
                 <p>You can continue using your account as normal.</p>
                 <p>— AniChan Team</p>`,
        });
      } catch (emailErr) {
        console.error('Failed to send cancellation email:', emailErr);
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