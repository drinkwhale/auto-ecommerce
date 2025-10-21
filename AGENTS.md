# Repository Guidelines
Auto E-Commerce pairs a Next.js front end with GraphQL-driven services; use this guide to keep contributions consistent and predictable.

## Project Structure & Module Organization
- `src/app`: Next.js routes and API handlers; keep server logic colocated with route folders.
- `src/components`: Reusable UI primitives; colocate module-specific styles.
- `src/services`, `src/lib`, `src/types`: Domain orchestration, shared utilities, and TypeScript contracts.
- `prisma/`: Schema and migrations; update `schema.prisma` before generating a new client.
- `tests/`: Jest specs mirroring module names; snapshot assets live beside specs.
- `docs/`, `examples/`, `specs/`: Reference material for workflows and external integrations.

## Build, Test, and Development Commands
- `npm run dev`: Start the Next.js dev server with hot reload.
- `npm run build`: Compile the production bundle; run before preparing releases.
- `npm run start`: Serve the compiled app; mirrors production behavior.
- `npm run lint`: Execute ESLint with Next.js defaults.
- `npm run test`, `npm run test:watch`, `npm run test:coverage`: Run Jest suites once, in watch mode, and with coverage reporting.
- `docker-compose up --build`: Provision the full stack (app + database) for integration testing.

## Coding Style & Naming Conventions
- TypeScript-first codebase; prefer the `@/` alias when importing from `src`.
- Prettier defaults (2-space indent, single quotes, trailing commas when valid); format via editor or `npx prettier`.
- Resolve ESLint warnings before pushing; avoid untyped `any` unless documented.
- Use `camelCase` for variables/functions, `PascalCase` for React components and classes, and `SCREAMING_SNAKE_CASE` for constants.

## Testing Guidelines
- Place suites in `tests/<feature>.test.ts[x]`; match module naming, e.g. `tests/services/order.service.test.ts`.
- Use Jest + Testing Library (configured in `jest.setup.js`) for UI behavior; rely on `supertest` or manual mocks for HTTP calls.
- Track coverage with `npm run test:coverage`; keep critical paths above 80% and document intentional gaps.
- Curate deterministic fixtures under `data/` or inline factories; avoid hitting live third-party endpoints.

## Commit & Pull Request Guidelines
- Follow the Conventional Commit pattern seen in history (`fix:`, `refactor:`, `feat:`); example: `fix: handle Taobao session fallback`.
- Keep commit subjects concise in English, adding Korean context in the body only when it clarifies local requirements.
- PRs should include a summary, linked ticket/issue, verification notes (`npm run test` output), and UI screenshots or GraphQL samples when relevant.
- Request review after CI passes; prefer rebasing over merge commits to maintain a linear history.

## Security & Configuration Tips
- Duplicate `.env.example` to `.env` (`cp .env.example .env`) and keep secrets local; never commit credentials.
- After editing Prisma models, run `npx prisma migrate dev` and `npx prisma generate` to update the client.
- Seed local data through `init.sql` or dedicated scripts in `data/`; scrub customer identifiers before sharing logs or fixtures.
