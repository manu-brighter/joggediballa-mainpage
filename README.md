<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,40:1B2A2B,70:1B9BA8,100:FF5A6B&height=200&section=header&text=Jogge%20di%20Balla&fontSize=48&fontColor=ffffff&fontAlignY=38&desc=Event-%20und%20Kulturverein%20seit%202022%20%C2%B7%20Basel%2C%20Schweiz&descAlignY=58&descColor=b2f0f4&animation=fadeIn" width="100%" />

<div align="center">

[![Live](https://img.shields.io/badge/live-joggediballa.ch-FF5A6B?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0d1117)](https://joggediballa.ch)&nbsp;
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=0d1117)&nbsp;
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=0d1117&labelColor=0d1117)&nbsp;
![tRPC](https://img.shields.io/badge/tRPC-11-2596BE?style=for-the-badge&logo=trpc&logoColor=white&labelColor=0d1117)

</div>

<br>

> Full-stack club management platform for the swiss social club **Jogge di Balla** — events, members, shot counter, sponsors, and a Beam Mode for the Wamserfest. Self-hosted on a Linux root server.

**[→ joggediballa.ch](https://joggediballa.ch)**

<br>

---

## ✦ Features

<table>
<tr>
<td width="50%" valign="top">

**🎯 Shotcounter**
The core feature. Persistent yearly tracking, animated rankings, inline editing, and a **Beam Mode** — a fullscreen projector display for live shot counts at events.

**👥 Member Management**
Role-based access (Admin / Maintainer / Editor / User). Sponsor members with expiry tracking. Google OAuth login — no passwords, no friction.

**📅 Events & Gallery**
Event creation and management with photo galleries and lightbox. Collapsible photo sections per event.

</td>
<td width="50%" valign="top">

**🏢 Admin Dashboard**
Full CRUD for members, events, sponsors, and content. Role assignment UI. Protected behind authentication — public visitors see only the club-facing pages.

**🌗 Dark / Light Mode**
System-aware with manual toggle. Full theme coverage across all UI components.

**🔒 Security**
Google OAuth 2.0 + JWT (HTTP-only cookies). Honeypot on contact form. Rate limiting via `express-rate-limit`. Helmet headers. `trust proxy` for reverse-proxy deployment.

</td>
</tr>
</table>

<br>

---

## ✦ Stack

<div align="center">

| Layer | Technology |
|---|---|
| **Frontend** | React 19 · Vite · TailwindCSS 4 · Wouter · Framer Motion |
| **UI Components** | Radix UI primitives · shadcn/ui · Lucide icons |
| **Backend** | Node.js · Express · tRPC 11 · SuperJSON |
| **Database** | MySQL 8 · Drizzle ORM |
| **Auth** | Google OAuth 2.0 · JWT · cookie-session |
| **File Storage** | AWS S3 (sponsor logos, profile photos, event gallery) |
| **Testing** | Playwright E2E · Vitest (server) · Biome |
| **Deploy** | Self-hosted · Nginx · PM2 · GitHub Actions |

</div>

<br>

---

## ✦ Architecture

```
joggediballa-mainpage/
├── client/               React + Vite frontend
│   └── src/
│       ├── components/   Shared UI components (Radix + shadcn wrappers)
│       ├── pages/        Route-level page components
│       ├── contexts/     Auth, Theme
│       └── hooks/        Custom React hooks
├── server/               Node.js + Express backend
│   ├── routers.ts        All tRPC procedures
│   ├── db.ts             Drizzle queries
│   ├── _core/            Framework plumbing (Express, tRPC context, auth routes)
│   └── auth/             Google OAuth flow
├── drizzle/
│   └── schema.ts         Database schema — 16+ tables, single source of truth
└── shared/               Types and constants shared between client and server
```

<br>

---

## ✦ Roles & Permissions

| Role | Shotcounter | Events | Members | Sponsors | Admin Panel |
|---|:---:|:---:|:---:|:---:|:---:|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Maintainer** | ✅ | ✅ | ✅ | ✅ | — |
| **Editor** | ✅ | edit | — | — | — |
| **User** | ✅ | — | own profile | — | — |
| **Public** | view | view | — | — | — |

<br>

---

## ✦ Development

**Prerequisites:** Node.js 22+, pnpm 8+, MySQL 8+

```bash
git clone https://github.com/manu-brighter/joggediballa-mainpage.git
cd joggediballa-mainpage
pnpm install

cp .env.example .env    # fill in DATABASE_URL, Google OAuth, JWT_SECRET, ADMIN_EMAIL

pnpm db:push            # push schema to MySQL
pnpm dev                # → http://localhost:3000
```

```bash
pnpm build              # production build (Vite client + esbuild server)
pnpm test               # Vitest server tests
pnpm check              # TypeScript typecheck
pnpm format             # Prettier
```

> Google OAuth setup: `GOOGLE_OAUTH_SETUP.md` · Server deployment: `DEPLOYMENT.md`

<br>

---

## ✦ Deployment

Self-hosted on a Linux root server behind Nginx + PM2. Automated via GitHub Actions on push to `main`.

```bash
git pull origin main
pnpm install --prod
pnpm build
pm2 restart joggediballa
```

<br>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:FF5A6B,50:1B9BA8,100:0d1117&height=100&section=footer" width="100%" />
