# 공공직군 행정업무 슈퍼앱 Backend Scaffold

## 실행

```powershell
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 연동 확인

```text
GET http://localhost:8000/api/health
```

응답의 `database.connected`가 `true`이면 BE-DB 연결이 정상입니다.

## 현재 스캐폴드

- `app/main.py`: FastAPI 앱 엔트리
- `app/api/routes`: 기능별 API 라우터
- `app/db/sqlite.py`: 개발용 SQLite 연결 및 샘플 데이터
- `data/app.db`: 실행 시 자동 생성되는 개발용 DB
