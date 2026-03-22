# Kevv Marketing

Kevv Marketing is the official open-source codebase for the marketing.kevv.ai product. It includes:

- Next.js 16 app-router frontend
- Auth.js sign-in with Google, Microsoft Entra ID, and magic links
- Listing search, share pages, subscriptions, CMA scaffolding, and AI-assisted content flows
- Drizzle ORM schema and deployment scripts for PostgreSQL
- Railway-oriented deployment defaults, with environment-based branding

Live service:

- [marketing.kevv.ai](https://marketing.kevv.ai)

Company site:

- [kevv.ai](https://kevv.ai)

## Positioning

This repository is the official branded product codebase. It is open source, but it is also the same codebase used to run the hosted Kevv Marketing service. If you fork it, you can still override public branding through environment variables without changing the core app structure.

## Quick Start

1. Copy `.env.example` to `.env`.
2. Fill in the required auth, database, email, and map variables.
3. Install dependencies:

```bash
npm install
npm --prefix next-app install
```

4. Run local development:

```bash
npm run dev
```

5. Validate before deploy:

```bash
npm run build
```

## Project Structure

- `next-app/`: main Next.js application
- `drizzle/`: schema snapshots and SQL artifacts
- `scripts/`: deployment and database helpers
- `shared/`: shared server-side types/utilities

## Open-Source Notes

This repository is intended to be readable, deployable, and forkable:

- secrets stay in environment variables
- `.env.example` documents the required runtime configuration
- route checks run during lint/build to prevent broken public paths
- official branding remains the default, while forks can override it via env vars

Repository guidelines:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)

## License

MIT. See [LICENSE](./LICENSE).
