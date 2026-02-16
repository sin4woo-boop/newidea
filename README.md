# HERITAI

Heritage Risk Intelligence Platform for galleries.

HERITAI는 갤러리/경매사 운영 관점에서 작품 리스크를 빠르게 스크리닝하는 데모용 B2B SaaS 프로토타입입니다.

## 핵심 기능

- Google OAuth 로그인/로그아웃
- 사용자별 데이터 분리 (각 사용자 본인 케이스만 조회)
- 작품 이미지 업로드 + OCR + 리스크 점수 계산
- 대시보드 KPI, 리스크 분포, 최근 케이스
- PWA manifest + service worker

## 기술 스택

- Next.js App Router + TypeScript + TailwindCSS
- Auth.js / NextAuth v5(beta)
- Prisma + SQLite (데모용)
- Google Vision OCR

## 로컬 실행

```bash
npm install
npm run prisma:migrate -- --name init_auth_case
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 환경변수 (.env.local)

아래 값을 설정하세요.

```env
AUTH_SECRET=replace-with-32-plus-random-chars
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
DATABASE_URL="file:./dev.db"

GOOGLE_APPLICATION_CREDENTIALS_JSON={...service_account_json...}
# 또는
# GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json

# 선택: Supabase Storage 사용 시
# SUPABASE_URL=https://xxxx.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=xxxx
# SUPABASE_STORAGE_BUCKET=uploads
```

### AUTH_SECRET 생성

- `npx auth secret`
- 또는 `openssl rand -base64 32`

## Google OAuth 설정

Google Cloud Console에서 OAuth Client를 만들고 아래 Redirect URI를 등록하세요.

- 로컬: `http://localhost:3000/api/auth/callback/google`
- Vercel: `https://<your-project>.vercel.app/api/auth/callback/google`

등록 후 발급된 값을 `.env.local`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 입력합니다.

## 데이터 모델 (데모 계정 구조)

- 현재는 `user` 단위 분리만 적용되어 있습니다.
- 조직/갤러리 멀티테넌시는 다음 단계입니다.

분리 원칙:

- 케이스 생성 시 현재 로그인 유저 `userId`를 저장
- 케이스 목록/상세는 현재 로그인 유저 데이터만 조회
- `/admin`, `/cases`, `/case/[id]`, `/new`는 로그인 필수

## Vercel 배포 시 참고

- 필수 환경변수:
  - `AUTH_SECRET`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `DATABASE_URL` (권장: hosted DB URL, SQLite는 데모 용도)
  - `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- 비밀값은 절대 Git에 커밋하지 마세요.
- `AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`는 Vercel Environment Variables로만 관리하세요.

## HERITAI 브랜딩 규칙

- 로고 표기: `HERIT` + `AI` (골드 강조)
- 기본 컬러:
  - Background: `#F7F4EE`
  - Accent Gold: `#B89A5D` (hover: `#A88442`)
  - Text: `neutral-900 / neutral-500`
  - Card: white + thin border

## 면책

본 결과는 참고용 리스크 추정이며, 진위 판정/감정 결과가 아닙니다.  
최종 감정은 전문가 검토가 필요합니다.
