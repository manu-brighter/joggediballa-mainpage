# Security Policy

This repository holds the source of the club website running at
[joggediballa.ch](https://joggediballa.ch). It is published so the work is
inspectable and reusable under the terms of the AGPL-3.0 — not as a supported
product. There is a single deployed instance, and only the current `main` is
maintained.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

1. **Preferred:** use GitHub's private vulnerability reporting — the "Report a
   vulnerability" button under the repository's _Security_ tab. This keeps the
   report private until a fix is out.
2. **Alternative:** email `joggediballa+security@gmail.com`. The `+security`
   tag reaches the same inbox and keeps the report sorted.

Useful things to include: the affected endpoint or file, what an attacker can
achieve, and a minimal reproduction. A rough description is welcome too — an
imperfect report beats a missing one.

This is a volunteer-run club site, so please expect a response in days rather
than hours. There is no bug bounty.

## Scope

In scope: the application source in this repository and the live site at
`joggediballa.ch`.

Out of scope: findings against third-party services the site depends on (Google
OAuth, the SMTP provider, the hosting provider) — report those to the vendor.
Automated scanner output without a demonstrated impact is generally not
actionable.

Please do not run automated scans, load tests, or brute-force attempts against
the live site. It shares a server with other things, and the disruption is real
even when the intent is friendly.
