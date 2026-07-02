# 공공직군 행정업무 슈퍼앱 Architecture

## 1. 문서 목적

본 문서는 공공직군 행정업무 슈퍼앱의 기술 요구사항, 권장 아키텍처, 프로젝트 구조, 모듈별 역할을 정의한다. 현재 저장소는 `frontend`와 `backend` 디렉터리를 보유하고 있으며, 프론트엔드는 React/Vite 기반 패키지가 설치되어 있고 백엔드는 Python 가상환경과 FastAPI 계열 실행 환경이 확인된다.

## 2. 권장 기술 스택

| 영역 | 권장 기술 | 설명 |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite | 업무용 단일 페이지 앱 |
| Backend API | Python, FastAPI, Uvicorn | REST API, 파일 처리, 챗봇 요청 처리 |
| Database | SQLite(현재 구현), PostgreSQL(권장 확장) | 사용자, 일정, 뉴스 메타데이터 저장 |
| Cache/Queue | Redis, Celery 또는 RQ | 엑셀 처리, 뉴스 수집, 문서 임베딩 비동기 작업 |
| File Storage | 로컬 스토리지 또는 S3 호환 스토리지 | 업로드 파일, 처리 결과, 매뉴얼 원본 저장 |
| Search/RAG | pgvector, OpenSearch, 또는 별도 Vector DB | 민원 매뉴얼 검색 기반 답변 |
| Scheduler | APScheduler, Celery Beat, 또는 OS 스케줄러 | 매일 아침 뉴스 수집 |
| Auth | 세션/JWT + RBAC | 사용자 인증, 팀/역할별 권한 제어 |
| Observability | 구조화 로그, 헬스체크, 작업 로그 | 운영 추적 및 장애 대응 |

## 3. 전체 아키텍처

```text
사용자 브라우저
  |
  | HTTPS
  v
Frontend: React/Vite
  |
  | REST API
  v
Backend: FastAPI
  |
  +-- Auth/RBAC
  +-- Schedule Module
  +-- Excel Automation Module
  +-- Complaint Chatbot Module
  +-- News Collector Module
  +-- Audit Log Module
  |
  +--> PostgreSQL
  +--> File Storage
  +--> Queue/Worker
  +--> Vector Search
  +--> External News Sources
  +--> LLM Provider
```

## 4. 프로젝트 구조

권장 구조는 다음과 같다.

```text
Day3_rpa/
  docs/
    PRD.md
    Architecture.md
    Operation.md
    index.html
  frontend/
    package.json
    src/
      app/
      components/
      features/
        schedule/
        excel/
        chatbot/
        news/
      routes/
      services/
      styles/
      types/
  backend/
    pyproject.toml
    app/
      main.py
      core/
        config.py
        security.py
        logging.py
      api/
        routes/
          auth.py
          schedules.py
          excel.py
          chatbot.py
          news.py
      models/
      schemas/
      services/
        schedule_service.py
        excel_service.py
        chatbot_service.py
        news_service.py
      workers/
      repositories/
      migrations/
      tests/
```

## 5. 모듈별 역할

### 5.1 Frontend

- 업무용 대시보드와 기능별 화면 제공
- 캘린더, 파일 업로드, 챗봇, 뉴스 목록 UI 제공
- API 요청/응답 처리
- 사용자 권한에 따른 메뉴 및 버튼 노출 제어
- 클라이언트 입력 검증과 사용자 친화적 오류 메시지 제공

권장 화면:

- `/schedule`: 팀 일정 캘린더
- `/excel`: 엑셀 분리/병합 도구
- `/chatbot`: 민원 대응 챗봇
- `/news`: 행정 뉴스 모니터링
- `/admin`: 사용자, 권한, 키워드, 매뉴얼 관리

### 5.2 Backend API

- 인증과 권한 검증
- 도메인별 REST API 제공
- 파일 업로드/다운로드 제어
- 비동기 작업 생성 및 상태 조회
- 감사 로그 기록
- 외부 API 및 LLM 연동의 서버 측 보호 계층

### 5.3 Schedule Module

역할:

- 일정 CRUD
- 팀/부서별 조회
- 일정 유형과 공개 범위 처리
- 반복 일정 생성
- 변경 이력 저장

주요 테이블:

- `users`
- `teams`
- `schedule_events`
- `schedule_event_histories`

주요 API:

- `GET /api/schedules`
- `POST /api/schedules`
- `PATCH /api/schedules/{event_id}`
- `DELETE /api/schedules/{event_id}`
- `GET /api/schedules/export`

### 5.4 Excel Automation Module

역할:

- 엑셀/CSV 파일 업로드
- 컬럼 미리보기
- 기준 컬럼별 파일 분리
- 다중 파일 병합
- 결과 파일 생성 및 다운로드
- 오류 리포트 생성

처리 방식:

- 작은 파일은 API 요청 내 동기 처리 가능
- 대용량 파일은 작업 큐에 등록 후 백그라운드 워커에서 처리
- 원본 파일과 결과 파일은 보관 기간 이후 삭제

주요 API:

- `POST /api/excel/preview`
- `POST /api/excel/split`
- `POST /api/excel/merge`
- `GET /api/excel/jobs/{job_id}`
- `GET /api/excel/jobs/{job_id}/download`

### 5.5 Complaint Chatbot Module

역할:

- 민원 매뉴얼 업로드
- 문서 파싱 및 검색 인덱싱
- 민원 내용 기반 관련 매뉴얼 검색
- 답변 초안 및 응대 스크립트 생성
- 근거 문서와 검토 필요 문구 표시

권장 RAG 흐름:

```text
매뉴얼 업로드
  -> 문서 텍스트 추출
  -> 섹션 단위 청킹
  -> 임베딩 생성
  -> 검색 인덱스 저장

민원 질의
  -> 민감정보 마스킹
  -> 관련 청크 검색
  -> 프롬프트 구성
  -> LLM 답변 생성
  -> 금지 표현/근거 누락 검사
  -> 응답 반환
```

주요 API:

- `POST /api/chatbot/manuals`
- `GET /api/chatbot/manuals`
- `POST /api/chatbot/query`
- `GET /api/chatbot/conversations/{conversation_id}`

### 5.6 News Collector Module

역할:

- 키워드 기반 뉴스 수집
- 중복 제거
- 요약 생성
- 예약 실행
- 관심 기사 저장

주의사항:

- 기사 전문 저장은 피하고 제목, 링크, 발행일, 언론사, 요약 위주로 저장한다.
- 수집 대상 사이트의 이용약관과 로봇 배제 정책을 확인한다.
- 가능하면 공식 API 또는 RSS를 우선 사용한다.

주요 API:

- `GET /api/news?page=1&page_size=10`: 페이지네이션된 뉴스 목록 조회
- `POST /api/news/collect`: 대한민국 정책브리핑 최근 기사 수집 및 upsert

### 5.7 Audit Log Module

역할:

- 주요 작업의 감사 로그 저장
- 관리자 조회 API 제공
- 장애 분석과 보안 점검 근거 제공

로그 대상:

- 로그인 성공/실패
- 일정 생성/수정/삭제
- 파일 업로드/다운로드/처리
- 챗봇 답변 생성
- 매뉴얼 등록/삭제
- 뉴스 수집 설정 변경
- 관리자 권한 변경

## 6. 데이터 모델 초안

### 6.1 schedule_events

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | 일정 ID |
| team_id | UUID | 팀 ID |
| user_id | UUID | 작성자 또는 대상자 |
| title | varchar | 일정 제목 |
| event_type | varchar | 휴가, 근무, 출장 등 |
| starts_at | timestamp | 시작 시각 |
| ends_at | timestamp | 종료 시각 |
| is_all_day | boolean | 종일 여부 |
| visibility | varchar | 공개, 팀공개, 비공개 |
| description | text | 상세 설명 |
| created_at | timestamp | 생성 시각 |
| updated_at | timestamp | 수정 시각 |

### 6.2 excel_jobs

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | 작업 ID |
| user_id | UUID | 요청자 |
| job_type | varchar | split 또는 merge |
| status | varchar | pending, running, success, failed |
| options | jsonb | 처리 옵션 |
| result_path | text | 결과 파일 경로 |
| error_message | text | 실패 메시지 |
| created_at | timestamp | 생성 시각 |
| finished_at | timestamp | 완료 시각 |

### 6.3 chatbot_manual_chunks

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | 청크 ID |
| manual_id | UUID | 매뉴얼 ID |
| section_title | varchar | 섹션명 |
| page_number | integer | 페이지 번호 |
| content | text | 청크 원문 |
| embedding | vector | 검색용 임베딩 |
| created_at | timestamp | 생성 시각 |

### 6.4 news_articles

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | text | 기사 ID |
| title | text | 제목 |
| source | text | 언론사 |
| published_at | text | 발행 시각 |
| url | text | 원문 링크, 유니크 인덱스 대상 |
| summary | text | 요약 |
| keywords | text | 쉼표로 저장된 매칭 키워드 |
| image_url | text | 대표 이미지 URL |
| category | text | 분류명 |
| has_image | integer | 대표 이미지 존재 여부 |
| collected_at | text | 수집 시각 |

## 7. 보안 요구사항

- 모든 API는 인증을 기본으로 한다.
- 파일 다운로드 URL은 만료 시간이 있는 토큰을 사용한다.
- 업로드 파일 확장자, MIME 타입, 크기를 검증한다.
- 민원 텍스트는 로그에 원문 전체를 남기지 않는다.
- LLM 외부 전송 전 개인정보 마스킹을 적용한다.
- 관리자 API는 별도 권한과 감사 로그를 요구한다.
- 운영 환경의 비밀키와 API 키는 `.env` 파일이나 Secret Manager로 관리한다.

## 8. 비기능 요구사항

| 항목 | 기준 |
| --- | --- |
| 응답 시간 | 일반 조회 API 1초 이내 목표 |
| 파일 처리 | 대용량 작업은 비동기 처리 |
| 가용성 | 업무시간 내 안정 운영 |
| 확장성 | 기능별 모듈 분리, 워커 수평 확장 가능 |
| 백업 | DB 일 단위 백업, 파일 스토리지 보관 정책 적용 |
| 접근성 | 공공 웹 접근성 기준 고려 |
| 로그 | 장애 원인 추적 가능한 구조화 로그 |

## 9. 배포 구조

개발 환경:

```text
React Dev Server : http://localhost:5173
FastAPI Server   : http://localhost:8000
PostgreSQL       : localhost 또는 Docker
Redis            : localhost 또는 Docker
```

운영 환경:

```text
Reverse Proxy
  +-- Frontend Static Build
  +-- Backend API
  +-- Worker Process
  +-- Scheduler Process
  +-- PostgreSQL
  +-- Redis
  +-- File Storage
```

## 10. 개발 우선순위

1. 인증, 사용자, 팀 모델
2. 일정 캘린더 CRUD
3. 엑셀 파일 업로드 및 분리/병합
4. 민원 매뉴얼 업로드 및 검색 기반 챗봇
5. 뉴스 수집 예약 작업
6. 감사 로그와 관리자 화면
7. 배포, 백업, 모니터링 체계

