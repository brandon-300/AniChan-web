import { Resend } from 'resend';

export default async function handler(req, res) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: 'AniChan <onboarding@resend.dev>',
      to: ['g09649009@gmail.com'],
      subject: 'Test from AniChan',
      html: '<p>If you see this, Resend works!</p>',
    });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, id: data?.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}