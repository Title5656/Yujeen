# ADR 0001 — Modular monolith และ pnpm monorepo

วันที่: 2026-11-07 · สถานะ: ยอมรับตาม PROJECT_SPEC.md

## บริบทและการตัดสินใจ

ระบบเป็นเว็บส่วนตัวผู้ใช้เดียว จึงแยกขอบเขตโค้ดแต่ให้ Backend เป็น Worker เดียว ไม่เพิ่ม microservices, Nx, Turborepo หรือ Docker ใช้ pnpm workspaces และ `workspace:*` เพื่อป้องกันการใช้ package ภายในจาก registry โดยไม่ตั้งใจ

`domain` มีเพียง TypeScript กับ decimal.js; `contracts` เป็น Zod DTO; provider/importer packages เป็น ports และ mock adapters; `database` เป็น persistence; API จัดการ HTTP/use cases; web จัดการ interaction เท่านั้น บังคับ domain/UI boundaries เพิ่มด้วย ESLint และแต่ละ package ประกาศ dependencies ของตัวเอง

## วิธีเชื่อมแอป

เลือก Vite dev server + `/api` proxy ไป Wrangler local แทนผูก Vite plugin ไว้ข้าม app roots ใน M0 การ build ทำ packages ก่อน ตามด้วยเว็บ แล้ว Worker แบบ `wrangler deploy --dry-run` สำหรับ preview Wrangler ใช้ Worker bundle ที่ build แล้วและ static assets จากเว็บร่วม origin เดียว

ตั้ง `assets.not_found_handling = single-page-application` และ `run_worker_first = ["/api", "/api/*"]` เพื่อให้ deep link ของ SPA ทำงาน และ API ที่ไม่มี route ยังคืน JSON 404 แม้เปิดตรงจาก browser ไม่มี CORS แบบเปิดกว้าง

## ผลและ trade-offs

Libraries export JS และ declaration ใน `dist` จึงต้อง build packages ก่อน tests/typecheck/dev; root scripts จัดลำดับให้อัตโนมัติ เมื่อแก้ shared package ระหว่าง dev ต้อง build ใหม่ เริ่มด้วย flow ที่ตรวจพิสูจน์ได้ง่ายก่อนเพิ่ม watch orchestration

Node 24 และ TypeScript 6 ถูก pin ให้ตรงเครื่องและ peer range ของ typescript-eslint ที่ยังจำกัด `<6.1.0` ณ การตรวจ registry ครั้งนี้ ไม่เลือก TypeScript 7 ที่ใหม่กว่าแต่ยังนอกช่วงรองรับ

pnpm 11 อ่าน settings ส่วนใหญ่จาก `pnpm-workspace.yaml` จึงรวม strict peers, engine, build-script allowlist และ local store ไว้ที่นั่น ไม่ใช้ `.npmrc` สำหรับ settings ที่รุ่นนี้ไม่อ่าน ใช้ double quotes ใน package scripts ให้ filter ทำงานบน Windows และตั้ง `--fail-if-no-match` เพื่อไม่ให้ build ผ่านทั้งที่ไม่ได้เลือก package

Tailwind อยู่ใน web foundation; shadcn/ui, TanStack Query, Recharts และ PDF/OCR จะเพิ่มเมื่อฟีเจอร์ที่ใช้จริงเริ่มตาม milestone ไม่ติดตั้งไลบรารีที่ยังไม่มีผู้ใช้ใน M0

## อ้างอิงทางการที่ตรวจ

- https://pnpm.io/workspaces
- https://pnpm.io/settings
- https://hono.dev/docs/getting-started/cloudflare-workers
- https://developers.cloudflare.com/workers/vite-plugin/tutorial/
- https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/

แผนร่วม deploy ในอนาคต: ใช้ Worker + Static Assets ชุดเดียวนี้หลังผ่าน authentication/authorization และตรวจโควตาใน M5; M0 ตรวจเฉพาะ local build/preview
