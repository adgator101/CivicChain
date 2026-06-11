# CivicChain Nepal

A civic accountability and governance intelligence platform that turns citizen reports into actionable, trackable, verifiable public issues — not another complaint inbox.

**Theme:** _Rebuilding Systems Designed for Yesterday — Building Solutions that Scale_

Citizens report problems in their ward. Reports cluster into shared issues, the community verifies them, local-body staff resolve them with a visible timeline, and AI surfaces duplicate patterns, root causes, and cascading civic chains — always with a human in the loop.

## Tech stack

| Area   | Stack                                                            |
| ------ | ---------------------------------------------------------------- |
| App    | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui |
| Data   | PostgreSQL · Prisma 7                                            |
| Auth   | better-auth (RBAC: Citizen, Employee, Head, Executive)           |
| Maps   | Mapbox GL JS                                                     |
| AI     | Google Gemini (`gemini-3.1-flash-lite`)                          |
| Deploy | Vercel                                                           |

Full details, versions, and architectural constraints → **[docs/TECHSTACK.md](./docs/TECHSTACK.md)**

## Documentation

| Doc                                            | Description                                           |
| ---------------------------------------------- | ----------------------------------------------------- |
| [docs/BUSINESS.md](./docs/BUSINESS.md)         | Problem validation, business model, revenue streams   |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture, layers, and end-to-end data flow |
| [docs/DATABASE.md](./docs/DATABASE.md)         | Entity-relationship diagram and schema reference      |
| [docs/TECHSTACK.md](./docs/TECHSTACK.md)       | Technology choices, dependencies, and MVP boundaries  |

Product rules and feature specs for development live in [`.cursor/rules/civicchain.mdc`](./.cursor/rules/civicchain.mdc).

## Getting started

**Prerequisites:** Node.js 20+, PostgreSQL, and environment variables (see `.env.example` if present).

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You will need API keys for Mapbox (`NEXT_PUBLIC_MAPBOX_TOKEN`) and Google Gemini (`GEMINI_API_KEY`) for maps and AI features.

## Scripts

| Command         | Purpose                  |
| --------------- | ------------------------ |
| `npm run dev`   | Start development server |
| `npm run build` | Production build         |
| `npm run start` | Start production server  |
| `npm run lint`  | Run ESLint               |

## Deploy

The app targets [Vercel](https://vercel.com/) with Prisma Postgres. See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for the standard flow.
