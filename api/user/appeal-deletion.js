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

    const { userId, message } = req.body || {};
    if (!userId || !message) {
      return res.status(400).json({ error: 'Missing userId or message' });
    }

    // Fetch user details
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('id', userId)
      .single();

    if (!profile) return res.status(404).json({ error: 'User not found' });

    // Get admin emails from settings
    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'admin_emails')
      .maybeSingle();

    let adminEmails = ['g09649009@gmail.com']; // fallback
    if (setting?.value) {
      try {
        adminEmails = JSON.parse(setting.value);
      } catch (e) {}
    }

    // Send email to all admins
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"AniChan" <${process.env.ADMIN_EMAIL}>`,
      to: adminEmails.join(', '),
      subject: `Deletion Appeal from ${profile.username}`,
      html: `<p><strong>User:</strong> ${profile.username} (${profile.email})</p>
             <p><strong>Message:</strong> ${message}</p>
             <p>You can cancel the deletion from the <a href="https://ani-chan-web.vercel.app/admin.html">admin panel</a>.</p>`,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}