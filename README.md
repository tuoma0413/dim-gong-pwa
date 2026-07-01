# 點講？ — Cantonese Translator PWA

English / Mandarin → natural spoken Hong Kong Cantonese, powered by Claude.

---

## File structure

```
dim-gong-pwa/
├── api/
│   └── translate.js      ← Vercel serverless function (rate-limit + Anthropic API)
├── public/
│   ├── index.html        ← full app UI
│   ├── manifest.json     ← PWA manifest
│   ├── sw.js             ← service worker (offline app shell)
│   └── icons/
│       ├── icon.svg
│       └── icon-maskable.svg
├── vercel.json
├── package.json
└── README.md
```

---

## Deploy to Vercel (free tier)

### 1. Push this folder to a GitHub repo

```bash
cd dim-gong-pwa
git init
git add .
git commit -m "init"
# create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/dim-gong-pwa.git
git push -u origin main
```

### 2. Import the repo on Vercel

1. Go to <https://vercel.com> and sign in (free account is fine).
2. Click **Add New → Project** and import your GitHub repo.
3. Vercel auto-detects the config — no framework setting needed. Click **Deploy**.

### 3. Set the API key as an environment variable

After the first deploy (or before redeploying):

1. Open your project on Vercel → **Settings → Environment Variables**.
2. Add a variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your key from <https://console.anthropic.com/settings/keys>
   - **Environments:** Production (and Preview if you want)
3. Click **Save**, then go to **Deployments** and **Redeploy** the latest build so the variable takes effect.

### 4. Set a spend limit on the API key

To protect against runaway costs:

1. Go to <https://console.anthropic.com/settings/limits>.
2. Under **Usage limits**, set a monthly spend limit you're comfortable with (e.g. $5–$10 covers thousands of translations).
3. Optionally create a dedicated API key for this app under **API Keys** so you can revoke it independently.

### 5. Share the install link with friends

Send them your Vercel URL (e.g. `https://dim-gong-pwa.vercel.app`).

**To install on iPhone / iPad:**
1. Open the link in Safari.
2. Tap the Share icon → **Add to Home Screen** → **Add**.

**To install on Android:**
1. Open the link in Chrome.
2. Tap the browser menu (⋮) → **Add to Home screen**, or accept the install banner.

**To install on desktop (Chrome / Edge):**
1. Open the link.
2. Click the install icon in the address bar, or browser menu → **Install 點講？**.

Once installed, the UI loads offline. Translations still need a network connection.

---

## Rate limiting

The serverless function allows **40 translations per IP per hour**. When exceeded it returns a friendly message with the time until reset. This is in-memory per function instance, so it's best-effort — sufficient for a small friend group, not a replacement for proper auth if you go public.

---

## Mic & Auto-speak

Both features use browser APIs (`SpeechRecognition` / `SpeechSynthesis`) that work fine on a real HTTPS origin. If a friend's device has no Cantonese TTS voice, the app shows instructions for installing one (iOS: Settings → Accessibility → Spoken Content → Voices → Chinese → Cantonese HK).
