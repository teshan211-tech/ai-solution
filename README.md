# PosterMint AI — AI Poster & Promo Maker MVP

A mobile-friendly poster-generation web app for small businesses. Users enter a product/offer brief, choose language/style/format, optionally upload a reference image, generate an AI poster, and download the result.

## Important: AI setup is required

The UI and Cloudflare Pages Function are included. Image generation requires a Gemini API key and access to the configured image-generation model. The app does **not** include an API key and does not promise unlimited or permanently free generation. Check the provider's current model availability, pricing, quota and commercial-use terms before launching.

## Project structure

```text
ai-poster-promo-maker/
├── index.html
├── styles.css
├── app.js
├── functions/
│   └── api/
│       └── generate.js
├── assets/
└── README.md
```

## Run locally

This uses Cloudflare Pages Functions, so use a local Pages-compatible dev server rather than opening `index.html` directly.

1. Install Node.js (LTS) if not already installed.
2. In this folder, run:

   ```bash
   npm init -y
   npm install --save-dev wrangler
   npx wrangler pages dev .
   ```

3. Add a local secret file named `.dev.vars`:

   ```text
   GEMINI_API_KEY=put_your_own_key_here
   ```

4. Start the dev server again and open the local URL shown in the terminal.

Do not commit `.dev.vars` to a public repository. The key must never be placed in `app.js` or `index.html`.

## Deploy to Cloudflare Pages

1. Put this folder in a Git repository.
2. Create a Cloudflare Pages project and connect the repository.
3. For a plain static site with Pages Functions, set the project root to this folder. No build command is needed; output directory is `.`.
4. In Cloudflare Pages project settings, add `GEMINI_API_KEY` as an encrypted secret/environment variable for Production (and Preview if required).
5. Deploy and test the `/api/generate` endpoint.

Cloudflare's Pages Functions convention uses `functions/api/generate.js` for `/api/generate`.

## How to get the API key

Create a key in Google AI Studio under your own account. Check whether the chosen image model is available to your account and what limits/pricing apply. Keep the key secret. Never paste it into a public chat, repository, or frontend code.

## Current MVP features

- Responsive layout for phone and desktop
- Business category, product, price, language, format, style and extra details
- Optional PNG/JPG/WebP reference photo, limited to 5 MB
- Server-side image-generation request
- AI result preview and PNG download
- Basic input validation and readable error messages

## Known limitations / before selling

- This is a single-user MVP: no accounts, saved poster library, billing, admin dashboard, or usage metering yet.
- AI may misspell Sinhala, alter product details, or render price/phone text incorrectly. Always inspect generated artwork before publishing. A future version should overlay verified text on top of the generated background using SVG/Canvas for reliable spelling.
- Add authentication, per-user quotas, abuse prevention, rate limiting, terms/privacy pages, and cost controls before public launch.
- Do not promise that the service is fully free: hosting may have limits and image-generation API access may be paid or quota-limited.
- User-uploaded reference photos are sent to the configured AI provider. Tell users clearly and add a privacy policy before launch.
