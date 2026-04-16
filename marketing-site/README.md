# Tawasel Marketing Site

Landing site for **tawasel.io** — built with Vite + React + Tailwind. Deploys independently from the main app (`app.tawasel.io`).

## Development

```bash
cd marketing-site
npm install
npm run dev       # http://localhost:5174
```

## Build

```bash
npm run build     # outputs to dist/
npm run preview   # preview the built site
```

## Deploy

### Vercel (recommended)
1. Import the repo in Vercel
2. Set **Root Directory** to `marketing-site`
3. Framework preset auto-detects Vite
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add custom domain `tawasel.io`

### Netlify
- Root: `marketing-site`
- Build: `npm run build`
- Publish: `dist`
- Add `_redirects` file in `public/` with: `/*  /index.html  200` (for SPA routing)

### Static host (nginx)
Point nginx at `marketing-site/dist/`. Make sure SPA fallback is configured:
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## SEO Checklist

- [x] `robots.txt`
- [x] `sitemap.xml`
- [x] Canonical URL in `<head>`
- [x] Open Graph + Twitter Card meta
- [x] JSON-LD structured data (Organization + SoftwareApplication)
- [ ] Create `og-image.png` (1200×630) and place in `public/`
- [ ] Create `apple-touch-icon.png` (180×180) and place in `public/`
- [ ] Submit sitemap to Google Search Console after deploy

## Structure

```
marketing-site/
  public/
    robots.txt
    sitemap.xml
    favicon.svg
  src/
    components/   (Header, Footer, Layout)
    pages/        (Home, Features, Pricing, About, Contact, NotFound)
    data/plans.ts (pricing snapshot)
    main.tsx
    index.css
  index.html      (all SEO meta tags)
```

## Pricing data

`src/data/plans.ts` is a **snapshot** of the app's `src/constants/plans.ts`. If you change pricing in the main app, update the snapshot here too.
