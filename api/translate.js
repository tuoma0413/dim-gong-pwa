const SYSTEM_PROMPT =
`You are an expert translator specialising in natural, spoken Hong Kong Cantonese (廣東話) as it is actually used by locals in Hong Kong today.

The user gives you text in English or Mandarin (Standard Chinese). Translate its MEANING into how a Hongkonger would really say it out loud — not formal written Chinese (書面語), and never a stiff word-for-word rendering.

Rules:
- Use Traditional Chinese characters.
- Use authentic Hong Kong spoken vocabulary and sentence-final particles where natural (啦, 喇, 喎, 呀, 咩, 嘅, 咗, 冇, 嘢, 睇, 俾, 嗰, 唔該, 唔使 etc.). Prefer colloquial words a patient or a friend would use (e.g. 瞓 over 睡, 食嘢 over 用餐, 而家 over 現在).
- For long or complex sentences, convey the intent and tone naturally — break or restructure as a fluent speaker would. This is the most important thing: longer and more idiomatic input is exactly where literal tools fail.
- Match the register of the input (casual vs polite) unless it would sound unnatural.
- Give jyutping romanisation with tone numbers for the full phrase.
- Give a short usage note: the register/politeness level, or when you'd use this phrasing.
- Give a plain literal back-translation into English so the user can sanity-check the meaning.
- If a different register or a notably more colloquial/slangy option would genuinely help, include 1-2 alternatives. Otherwise return an empty alternatives array. Do not pad.

Return ONLY a single valid JSON object, with no markdown, no code fences, and no text before or after it. Schema:
{
  "yue": "the Cantonese, Traditional characters",
  "jyutping": "jyutping with tone numbers",
  "register": "one short usage/register note in English",
  "literal": "literal English back-translation",
  "alternatives": [
    { "label": "e.g. More polite / More casual / Slangier", "yue": "...", "jyutping": "...", "note": "when to use this instead" }
  ]
}`;

// In-memory per-IP rate limiter. Best-effort — resets per warm instance.
const rateLimitMap = new Map();
const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
  const now = Date.now();
  const rec = rateLimitMap.get(ip);
  if (!rec || now > rec.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  if (rec.count >= RATE_LIMIT) {
    const minutes = Math.ceil((rec.resetTime - now) / 60000);
    return { ok: false, minutes };
  }
  rec.count++;
  return { ok: true };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'] || '';
  return forwarded.split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return res.status(429).json({
      error: `You've hit the translation limit for this hour — you can make 40 translations per hour. Try again in about ${limit.minutes} minute${limit.minutes === 1 ? '' : 's'}.`,
    });
  }

  const { text, sourceLang } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'No text provided.' });
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: 'Text is too long — please keep it under 2,000 characters.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'Translation service is not configured. Please contact the app owner.' });
  }

  const hint = (!sourceLang || sourceLang === 'auto') ? '' : `Source language: ${sourceLang}\n`;
  const userContent = `${hint}Translate this into natural spoken Hong Kong Cantonese:\n\n"""${text.trim()}"""`;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!upstream.ok) {
      const body = await upstream.text();
      console.error('Anthropic error:', upstream.status, body);
      return res.status(502).json({ error: 'The translation service returned an error. Try again in a moment.' });
    }

    const payload = await upstream.json();
    let raw = (payload.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    // Strip accidental markdown fences
    raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    if (raw[0] !== '{') {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) raw = m[0];
    }

    const data = JSON.parse(raw);
    if (!data.yue) throw new Error('Empty yue field');

    return res.status(200).json(data);
  } catch (err) {
    console.error('Translation handler error:', err);
    return res.status(500).json({ error: 'Something went wrong. If the text was very long, try a shorter chunk — otherwise give it another go in a moment.' });
  }
};
