# Demo Recorder

Local Playwright recorder for the MERN ecommerce storefront.

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

The default target is:

```text
SITE_URL=http://localhost:8080
```

Run the ecommerce backend on `http://localhost:3000` and the frontend on
`http://localhost:8080`.

## Record The First Demo

```bash
npm run record:add-to-cart
```

The first version is intentionally simple: it performs a deterministic
"open shop, open first product, add to cart" flow and records a `.webm` video to
`output/videos`.

## Next Phases

- Add a DOM snapshot extractor.
- Add Gemini structured-action interpretation.
- Add the ask-me loop for ambiguous actions.
- Add saved login session support for authenticated flows like reviews.
