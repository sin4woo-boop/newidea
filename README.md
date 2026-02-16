# 고미술 진위/위작 리스크 스크리닝 PWA (MVP)

Next.js 14(App Router) + TypeScript + TailwindCSS 기반 모바일 우선 프로토타입입니다.

> **면책 고지**
> 본 결과는 참고용 리스크 추정이며, 진위 판정/감정 결과가 아닙니다. 최종 감정은 전문가 검토가 필요합니다.

## 기능 요약

- `/` 홈: 작품 사진 촬영/업로드 CTA
- `/new`: 이미지 업로드 + 촬영 품질 체크 + OCR 실행
- `/case/[id]`: OCR 텍스트, 리스크 스코어(0~100), 근거, 추가 촬영 체크리스트
- `/cases`: 내 접수함 목록
- `/admin`: 케이스 리뷰, 리스크 태그/코멘트 수정
- PWA: manifest + service worker + safe area 대응

## 설치 및 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 환경변수

`.env.local` 파일 생성 후 아래 중 하나 설정:

1. `GOOGLE_APPLICATION_CREDENTIALS_JSON`: 서비스 계정 JSON 전체를 문자열로 저장
2. `GOOGLE_APPLICATION_CREDENTIALS`: 서비스 계정 JSON 파일 절대 경로

예시는 `.env.example` 참고.

## Google OCR 키 설정 방법 (서비스 계정)

1. GCP 콘솔에서 Vision API 활성화
2. 서비스 계정 생성 후 JSON 키 발급
3. 로컬에서는 `.env.local`에 JSON 문자열 또는 파일 경로 지정
4. Vercel에서는 Project Settings → Environment Variables에 동일하게 등록

## 데이터 저장 전략

- MVP 기본: 로컬 파일 저장
  - 케이스: `.data/cases.json`
  - 업로드 이미지: `.data/uploads/*`
- Vercel 프로덕션 확장 권장:
  - DB: Supabase/Postgres
  - 이미지: Supabase Storage 또는 S3 호환 스토리지

## 테스트 방법

1. `/new`에서 샘플 이미지 업로드 (직접 촬영 또는 로컬 이미지)
2. 품질 체크 결과 확인 (OK/재촬영 권장)
3. `OCR 실행` 클릭 → 성공 시 `/case/[id]` 이동
4. `/cases`에서 케이스 목록 확인
5. `/admin`에서 tags/notes 수정 후 저장 확인

## 주요 API

- `POST /api/uploads`: multipart 이미지 저장
- `POST /api/ocr`: multipart 이미지 → Google Vision OCR
- `GET/POST /api/cases`: 케이스 목록/저장
- `GET/PATCH /api/cases/:id`: 상세 조회/관리자 수정

## 확장 계획 (다음 단계)

- 임베딩 기반 유사작품 검색 (CLIP / ViT)
- 벡터 DB(pgvector, Pinecone, Weaviate) 연동
- OCR 바운딩 박스 시각화 고도화
- 전문가 워크플로우(검수 단계, 히스토리, 감사 로그)
