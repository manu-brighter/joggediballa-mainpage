import { config } from 'dotenv';

// Load .env so server tests can reach the local dev DB via the createCaller
// pattern (server/CLAUDE.md: "Do not mock the DB in integration tests").
// No-op in CI where no .env exists → DB-dependent tests fall back as before.
config({ quiet: true });
