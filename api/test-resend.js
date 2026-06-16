export default async function handler(req, res) {
  const key = process.env.RESEND_API_KEY;
  return res.status(200).json({ 
    exists: !!key,
    firstChars: key ? key.substring(0, 5) + '...' : 'missing',
    length: key ? key.length : 0
  });
}