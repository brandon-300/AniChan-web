import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.verify();   // 👈 this checks the connection

    return res.status(200).json({ success: true, message: 'SMTP connection successful' });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      code: err.code,
      details: err.toString()
    });
  }
}