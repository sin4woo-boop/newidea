# HERITAI

Heritage Risk Intelligence Platform for galleries.

## 주요 기능

- Google OAuth 로그인/로그아웃
- 사용자별 케이스 분리 저장 및 조회
- 이미지 업로드 + OCR + 리스크 점수 계산
- 대시보드 KPI / 리스크 분포 / 최근 케이스
- PWA manifest + service worker

## 기술 스택

- Next.js App Router + TypeScript + Tailwind CSS
- Auth.js (NextAuth v5 beta)
- Prisma + PostgreSQL (Supabase 권장)
- Google Vision OCR

## 라우트 구조

- `/` : 공개 랜딩 (비로그인 소개 + 로그인 CTA)
- `/dashboard` : 로그인 필수 대시보드
- `/new` : 로그인 필수 신규 분석
- `/cases` : 로그인 필수 내 접수함

라우팅 규칙:
- 로그인 사용자가 `/`에 접근하면 `/dashboard`로 리다이렉트
- 비로그인 사용자가 `/dashboard`, `/new`, `/cases`에 접근하면 `/`로 리다이렉트

## 로그인/로그아웃 콜백 흐름

- 로그인 버튼(헤더/랜딩 CTA): `signIn('google', { redirectTo: '/dashboard' })`
- 로그아웃 버튼(헤더 계정 메뉴): `signOut({ redirectTo: '/' })`

참고:
- Auth.js v5 서버 액션에서는 `callbackUrl` 대신 `redirectTo`를 사용합니다.

## 로컬 실행

```bash
npm install
npm run prisma:push
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 환경 변수 (`.env.local`)

```env
AUTH_SECRET=replace-with-32-plus-random-chars
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
DATABASE_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"

GOOGLE_APPLICATION_CREDENTIALS_JSON={...service_account_json...}
# 또는
# GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json

# 선택: Supabase Storage 업로드 사용 시
# SUPABASE_URL=https://xxxx.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=xxxx
# SUPABASE_STORAGE_BUCKET=uploads
```
