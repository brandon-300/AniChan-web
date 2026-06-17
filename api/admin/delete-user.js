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
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Fetch user email before marking deletion
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('id', userId)
      .single();

    // Set pending deletion flag and timestamp
    const { error } = await supabase
      .from('profiles')
      .update({
        is_pending_delete: true,
        deleted_at: new Date().toISOString(),
        admin_note: adminNote || null,
      })
      .eq('id', userId);

    if (error) throw error;

    // Send deletion notification email to the user
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
          subject: 'Your AniChan account has been scheduled for deletion',
          html: `<p>Hi ${profile.username || 'user'},</p>
                 <p>Your account on AniChan has been scheduled for <strong>deletion</strong>.</p>
                 ${adminNote ? `<p><strong>Reason:</strong> ${adminNote}</p>` : ''}
                 <p>You have <strong>24 hours</strong> to appeal this decision before your account is permanently removed.</p>
                 <p>You can submit an appeal from the login page. If you do not appeal within 24 hours, your account and all associated data will be permanently deleted.</p>
                 <p>— AniChan Team</p>`,
        });
      } catch (emailErr) {
        console.error('Failed to send deletion email:', emailErr);
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