# Skill: doc-analyze

**Invocation:** `/doc-analyze [optional topic or scope hint]`
**User-invocable:** yes
**Orchestration model:** Claude is the active orchestrator — not a passive relay. Claude reads all output files directly, quality-assures the results, resolves contradictions, and writes the final synthesis document. Agents are specialist workers; Claude is the editor-in-chief.

---

## Purpose

Produce thorough, human-readable documentation for a codebase area by running specialist agents in a structured two-phase pipeline, then synthesising their output into a polished final document promoted to a permanent folder.

---

## Directory Convention

| Folder | Role |
|--------|------|
| `.ai/` | Ephemeral scratch space. All in-progress agent output lands here. Treat as gitignore-friendly working directory. Never reference `.ai/` files in commit messages or permanent docs. |
| `docs/` | Permanent, published folder. Only promoted outputs live here. |

`.ai/` is expected to be listed in `.gitignore`. If it is not, remind the user to add it.

---

## File Naming Convention

All slugs are **kebab-case** derived from the subject name.

| File type | Pattern | Example |
|-----------|---------|---------|
| Analyzer output | `.ai/analysis-<slug>.md` | `.ai/analysis-google-auth.md` |
| Verifier output | `.ai/verify-<slug>.md` | `.ai/verify-google-auth.md` |
| Final synthesis | `.ai/final-<topic>.md` | `.ai/final-authentication.md` |
| Promoted analyzer | `docs/analysis-<slug>.md` | `docs/analysis-google-auth.md` |
| Promoted verifier | `docs/verify-<slug>.md` | `docs/verify-google-auth.md` |
| Promoted final | `docs/final-<topic>.md` | `docs/final-authentication.md` |

---

## Lean Agent Return Protocol

Every specialist agent called during this skill MUST return ONLY the following one-liner — no inline content, no summaries, no prose:

**Analyzer agents:**
```
Analysis complete. Subject: <subject>. Report: .ai/analysis-<slug>.md
```

**Verifier agents:**
```
Verification complete. Subject: <subject>. Report: .ai/verify-<slug>.md
```

Rationale: inline content from agents bloats the orchestrator's context window. Claude reads the files directly. Agents that return prose instead of this protocol waste tokens and degrade orchestration quality.

---

## Workflow

### Pre-flight

1. Read the optional topic/scope hint from the invocation (e.g., `/doc-analyze auth system` → topic hint is "auth system"). If no hint is given, ask the user for the scope before proceeding.
2. Determine the concrete list of subjects to analyze (e.g., for "auth system": Google OAuth flow, JWT handling, role system, session management). Give each subject a kebab-case slug.
3. Ensure `.ai/` directory exists. Create it if needed.

---

### Phase 1 — Analysis

**Goal:** Collect deep technical analysis for each subject.

**Steps:**

1. Launch one **deep code analyzer** agent per subject. Where subjects are independent, launch them in parallel to reduce wall-clock time.
2. Each agent receives: the subject name, the slug, and the instruction to write its report to `.ai/analysis-<slug>.md` and return ONLY the lean protocol line.
3. Wait for all analyzer agents to return their protocol lines.
4. **Claude reads each `.ai/analysis-<slug>.md` file directly.** Do not rely on anything the agents said inline.
5. Scan each report for completeness. If a report is missing sections or clearly incomplete, re-launch the analyzer agent for that subject with a focused follow-up prompt.

**Directory state at end of Phase 1:**
```
.ai/
  analysis-google-auth.md
  analysis-jwt-handling.md
  analysis-role-system.md
```

---

### Phase 2 — Verification

**Goal:** Independent review of each analysis report for accuracy, gaps, and contradictions.

**Steps:**

1. Launch one **verifier** agent per analysis report. Pass the path `.ai/analysis-<slug>.md` as the primary input context.
2. Each agent receives: the subject name, the path to the analysis report, and the instruction to write its verification report to `.ai/verify-<slug>.md` and return ONLY the lean protocol line.
3. Parallel launch is appropriate where subjects are independent.
4. Wait for all verifier agents to return their protocol lines.
5. **Claude reads each `.ai/verify-<slug>.md` file directly.**
6. For each verifier report, check:
   - Did the verifier flag issues the analyzer missed?
   - Are there factual contradictions between the analysis and the verification?
   - Does the verifier mark anything as "unverifiable" or "uncertain"?
   Document these findings in your own working notes (do not write them to a file yet).

**Directory state at end of Phase 2:**
```
.ai/
  analysis-google-auth.md
  analysis-jwt-handling.md
  analysis-role-system.md
  verify-google-auth.md
  verify-jwt-handling.md
  verify-role-system.md
```

---

### Phase 3 — Synthesis and Promotion

**Goal:** Produce the final document and publish all outputs to `docs/`.

#### 3a. Synthesise

Claude writes `.ai/final-<topic>.md`. This is NOT a concatenation of the analysis and verification files. It is a quality-assured, human-readable document that:

- Is structured for a developer reader (clear headings, logical flow)
- Integrates findings from both the analyzer and verifier reports
- Resolves contradictions explicitly (e.g., "The analyzer described X; the verifier noted Y — the correct behaviour is Z, confirmed by `server/_core/googleAuthRoutes.ts` line 42")
- Calls out unresolved uncertainties clearly under an "Open Questions" section if any exist
- Does not repeat boilerplate from the raw analysis reports — it synthesises, not transcribes
- Follows the project's conventional commit style for any code block filenames cited (`feat:`, `fix:`, etc. prefixes are commit-style; actual file paths are unformatted)

Suggested final document structure:
```
# <Topic> — Technical Documentation

## Overview
## Architecture / How It Works
## Key Files and Entry Points
## Data Flow / Sequence
## Edge Cases and Known Limitations
## Open Questions  ← omit section if empty
## References      ← list .ai/ source files used
```

#### 3b. Promote

Move all six (or more) files from `.ai/` to `docs/`:

```
docs/
  analysis-google-auth.md
  analysis-jwt-handling.md
  analysis-role-system.md
  verify-google-auth.md
  verify-jwt-handling.md
  verify-role-system.md
  final-authentication.md    ← primary deliverable
```

The move must be a filesystem rename/move — do not copy-and-delete unless rename is unavailable. After promotion, `.ai/` may be empty or contain unrelated in-progress work; do not delete `.ai/` itself.

#### 3c. One-time Git Confirmation

After promotion is complete, ask the user **once** and **only once**:

```
Commit all documentation files to git? (y/n)
```

If the user answers **y**: stage all files under `docs/` that were just promoted and commit with message:
```
docs: add <topic> documentation (analysis, verification, final)
```

If the user answers **n** or anything other than `y`: do not commit. Do not ask again.

**Directory state at end of Phase 3:**
```
.ai/          ← empty or contains unrelated scratch files
docs/
  analysis-google-auth.md
  analysis-jwt-handling.md
  analysis-role-system.md
  verify-google-auth.md
  verify-jwt-handling.md
  verify-role-system.md
  final-authentication.md
```

---

## Orchestrator Responsibilities Summary

Claude owns the following — these are never delegated to agents:

| Responsibility | Detail |
|----------------|--------|
| Scope definition | Deciding what subjects to analyze and their slugs |
| File reading | Reading all `.ai/*.md` files after each phase |
| Gap detection | Re-launching agents if reports are incomplete |
| Contradiction resolution | Reconciling differences between analysis and verification |
| Final synthesis | Writing `.ai/final-<topic>.md` |
| Promotion | Moving files from `.ai/` to `docs/` |
| Git commit | Staging and committing (only on user confirmation) |

---

## Example Invocations

```
/doc-analyze auth system
/doc-analyze tRPC router layer
/doc-analyze S3 upload flow
/doc-analyze
```

For bare `/doc-analyze` with no argument, ask: "What area of the codebase should I document?"

---

## Quality Gates

Before writing the final document, Claude must satisfy these checks:

- [ ] Every subject has both an `analysis-<slug>.md` and a `verify-<slug>.md` in `.ai/`
- [ ] Each analysis report has been read directly by Claude (not trusted from agent inline output)
- [ ] Each verifier report has been read directly by Claude
- [ ] All verifier-flagged issues have been addressed or noted as open questions in the final doc
- [ ] The final document has a clear overview section that a developer unfamiliar with the subsystem could read first
- [ ] No file in `docs/` is overwritten without warning the user

---

## Notes for Agents Launched by This Skill

If you are a **deep code analyzer** agent invoked as part of this skill:

- Write your full report to the path you are given (`.ai/analysis-<slug>.md`)
- Return ONLY the one-liner: `Analysis complete. Subject: <subject>. Report: .ai/analysis-<slug>.md`
- Do not include report content inline in your response
- Do not ask clarifying questions mid-run; use best judgment and note assumptions in the report

If you are a **verifier** agent invoked as part of this skill:

- Read the analysis report at the path provided to you
- Write your verification report to `.ai/verify-<slug>.md`
- Return ONLY the one-liner: `Verification complete. Subject: <subject>. Report: .ai/verify-<slug>.md`
- Flag issues, gaps, and contradictions clearly in the report using a structured format (e.g., `## Issues Found`, `## Confirmed Correct`, `## Unverifiable`)
- Do not include report content inline in your response
