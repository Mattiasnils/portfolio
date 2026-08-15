# Portfolio Contact API

Express API that sends portfolio contact form submissions to `mattiasnils@outlook.com` via [Resend](https://resend.com).

## One-time setup checklist

Complete these steps in order. Emails will **not** work until all of them are done.

### 1. Create a Resend account

1. Sign up at [resend.com](https://resend.com) using **`mattiasnils@outlook.com`** (important for the test sender below).
2. Go to **API Keys** → **Create API Key**.
3. Copy the key (starts with `re_`). You will only see it once.

> **Sandbox sender rule:** With `CONTACT_FROM=onboarding@resend.dev`, Resend only delivers to the email address you signed up with. Sign up with `mattiasnils@outlook.com`, or verify your own domain in Resend and use a `@yourdomain.com` sender instead.

### 2. Deploy the API on Render

**Option A — Blueprint (recommended)**

1. Push this repo to GitHub.
2. Open [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**.
3. Connect the `portfolio` repository.
4. Render reads [`render.yaml`](../render.yaml) and creates `portfolio-contact-api`.
5. When prompted, set **`RESEND_API_KEY`** to your Resend key.
6. Click **Apply**. Wait for the deploy to finish.
7. Copy your service URL (should be `https://portfolio-contact-api-hfwe.onrender.com`).

**Option B — Manual web service**

1. **New** → **Web Service** → connect repo.
2. **Root Directory:** `server`
3. **Build command:** `npm install`
4. **Start command:** `npm start`
5. **Environment variables:**

   | Key | Value |
   |-----|-------|
   | `RESEND_API_KEY` | your `re_...` key |
   | `CONTACT_TO` | `mattiasnils@outlook.com` |
   | `CONTACT_FROM` | `onboarding@resend.dev` |
   | `ALLOWED_ORIGINS` | `https://mattiasnils.github.io` |

6. Deploy and copy the service URL.

### 3. Verify the API is live

Replace the URL if yours differs:

```bash
curl https://portfolio-contact-api-hfwe.onrender.com/health
```

Expected: `{"ok":true}`

Send a test email:

```bash
curl -X POST https://portfolio-contact-api-hfwe.onrender.com/api/contact \
  -H "Content-Type: application/json" \
  -H "Origin: https://mattiasnils.github.io" \
  -d '{"name":"Test","email":"you@example.com","message":"Hello from curl"}'
```

Expected: `{"ok":true}` — then check `mattiasnils@outlook.com` (and spam folder).

> **Free tier cold start:** Render free services sleep after inactivity. The first request may take 30–60 seconds.

### 4. Point the frontend at your API

In [`index.html`](../index.html), set the meta tag to your Render URL:

```html
<meta
  name="contact-api-url"
  content="https://portfolio-contact-api-hfwe.onrender.com"
/>
```

Push to GitHub so GitHub Pages picks up the change.

### 5. Test on the live site

1. Open `https://mattiasnils.github.io/portfolio/#about`
2. Click **Contact**, submit the form.
3. Open DevTools → **Network** → confirm `POST .../api/contact` returns **200**.
4. Check inbox and spam.

---

## Local development

```bash
cd server
npm install
cp .env.example .env
# Add RESEND_API_KEY=re_... to .env
npm run dev
```

The frontend uses `http://localhost:3001` automatically on localhost.

Mock mode (no real email):

```bash
MOCK_SEND=1 npm start
```

## Production sender (optional)

For a professional `from` address, verify your domain in Resend and set on Render:

```
CONTACT_FROM=contact@yourdomain.com
```

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Form shows error / network fail | API not deployed, wrong URL in meta tag, or Render service sleeping |
| API returns 500 “missing RESEND_API_KEY” | Key not set in Render env vars — redeploy after adding it |
| API returns 200 but no email | Resend sandbox: sign-up email must match `CONTACT_TO`; check Resend dashboard → **Emails** |
| CORS error in browser | `ALLOWED_ORIGINS` must include `https://mattiasnils.github.io` |
| Success modal locally, no email | Running with `MOCK_SEND=1` |

Check Render **Logs** and Resend **Emails** for delivery status.

## API

### `GET /health`

Returns `{ "ok": true }`.

### `POST /api/contact`

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "message": "Hello!",
  "pageUrl": "https://mattiasnils.github.io/portfolio/#about"
}
```

Returns `{ "ok": true }` on success.

Metadata (browser, language, page) is appended to the email body only.

## Tests

```bash
npm test
```
