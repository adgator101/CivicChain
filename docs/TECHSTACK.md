# Tech Stack

## Frontend

| Layer      | Technology                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Framework  | [Next.js 16](https://nextjs.org/) (App Router)                                                               |
| UI library | [React 19](https://react.dev/)                                                                               |
| Language   | [TypeScript 5](https://www.typescriptlang.org/)                                                              |
| Styling    | [Tailwind CSS v4](https://tailwindcss.com/)                                                                  |
| Components | [shadcn/ui](https://ui.shadcn.com/) (Radix primitives, Base UI)                                              |
| Forms      | [react-hook-form](https://react-hook-form.com/) + [Zod 4](https://zod.dev/)                                  |
| Maps       | [Mapbox GL JS](https://www.mapbox.com/mapbox-gljs) via [react-map-gl](https://visgl.github.io/react-map-gl/) |
| Toasts     | [Sonner](https://sonner.emilkowal.ski/)                                                                      |
| Icons      | [Lucide React](https://lucide.dev/)                                                                          |

## Backend (same Next.js process)

| Layer          | Technology                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Mutations      | [next-safe-action](https://next-safe-action.dev/) server actions (`src/lib/actions`)                  |
| Read APIs      | Next.js Route Handlers (`src/app/api`)                                                                |
| Auth           | [better-auth](https://www.better-auth.com/) — email/password, DB-backed sessions                      |
| RBAC           | Middleware proxy + `requireRole` / `roleActionClient`                                                 |
| ORM            | [Prisma 7](https://www.prisma.io/) with `@prisma/adapter-pg`                                          |
| Database       | [PostgreSQL](https://www.postgresql.org/)                                                             |
| Image handling | [sharp](https://sharp.pixelplumbing.com/), [exifr](https://mutiny.org/open-source/exifr/) (GPS proof) |
| File storage   | Local disk (`public/uploads`), served via `/api/uploads`                                              |

## AI

| Layer    | Technology                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| Provider | [Google Gemini API](https://ai.google.dev/) (`@google/generative-ai`)                                         |
| Model    | `gemini-3.1-flash-lite` (`src/lib/gemini.ts`)                                                                 |
| Usage    | Server-side only; structured JSON output for categorization, dedup, root-cause suggestions, cascade detection |

AI calls run **synchronously** during report submission — no queues or separate AI service.

## Deployment

| Layer    | Technology                                     |
| -------- | ---------------------------------------------- |
| Hosting  | [Vercel](https://vercel.com/) (frontend + API) |
| Database | Managed PostgreSQL (Prisma Postgres on Vercel) |
