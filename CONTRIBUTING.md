# Contributing to Kevv Marketing

Thanks for contributing to Kevv Marketing.

This repository is both:

- the open-source codebase for the product
- the basis of the hosted service at `marketing.kevv.ai`

That means changes need to be reviewable, safe to deploy, and usable by self-hosters.

## Ground Rules

- Do not commit secrets, private keys, production tokens, or customer data.
- Do not change deploy-time behavior without documenting required environment variables.
- Prefer incremental, reviewable changes over broad refactors.
- Keep compatibility in mind for the hosted product unless the change is explicitly breaking.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies:

```bash
npm install
npm --prefix next-app install
```

3. Start development:

```bash
npm run dev
```

## Before Opening a PR

Run:

```bash
npm --prefix next-app run lint
npm --prefix next-app run build
```

If your change touches database or deploy behavior, explain that clearly in the PR description.

## Pull Request Expectations

Include:

- what changed
- why it changed
- any environment variable changes
- any migration or deployment impact
- screenshots for UI changes when relevant

Keep PRs scoped. If you want to rename internal compatibility fields, remove legacy env aliases, or make other breaking changes, split that into a separate PR.

## Areas That Need Extra Care

- authentication and session handling
- email delivery
- tRPC and API boundaries
- route structure and public URLs
- anything that could expose customer or listing data

## Breaking Changes

If a change is intentionally breaking, call it out explicitly in the PR title and description.

Examples:

- removing legacy environment variables
- changing database schema without backward compatibility
- changing route semantics or callback URLs
- changing auth provider behavior

## Questions

For general product questions, open an issue.

For security problems, do not open a public issue. Follow [SECURITY.md](./SECURITY.md).
