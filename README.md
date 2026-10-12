# JUZBOOK

JUZBOOK landing page scaffolded with Next.js App Router, TypeScript, Tailwind CSS, and local `JUZ40` fonts.

## Included

- Full responsive landing page based on `JUZBOOK.md`
- Local font setup via `next/font/local`
- Dark/light theme toggle using `next-themes`
- Subject grid for all 12 required subjects
- Product sections for reader workspace, student dashboard, AI quiz, Pomodoro, and admin panel
- SEO basics via Metadata API, `robots.ts`, and `sitemap.ts`

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open `http://localhost:3000`

## Fonts

The following local font files are bundled in `public/fonts`:

- `JUZ40-Regular.otf`
- `JUZ40-Medium.otf`
- `JUZ40-Bold.otf`

## Notes

- The current environment did not provide a ready-to-use `npm` CLI, so dependencies were not installed here.
- The landing is ready to continue into full product pages like login, reader, dashboard, and admin.
