import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminPage } from "../features/admin/AdminPage";
import { ChatbotPage } from "../features/chatbot/ChatbotPage";
import { ExcelPage } from "../features/excel/ExcelPage";
import { NewsPage } from "../features/news/NewsPage";
import { SchedulePage } from "../features/schedule/SchedulePage";
import { getApiBaseUrl, getHealth, normalizeApiBaseUrl, setApiBaseUrl } from "../services/api";
import type { HealthResponse } from "../types/api";

type PageKey = "schedule" | "excel" | "chatbot" | "news" | "admin";

const pages: Array<{ key: PageKey; label: string; description: string }> = [
  { key: "schedule", label: "팀 일정", description: "휴가, 근무, 출장 공유" },
  { key: "excel", label: "엑셀 자동화", description: "컬럼 기준 분리와 병합" },
  { key: "chatbot", label: "민원 챗봇", description: "매뉴얼 기반 응대 초안" },
  { key: "news", label: "뉴스 수집", description: "공공행정 기사 모니터링" },
  { key: "admin", label: "운영 관리", description: "권한, 로그, 설정" },
];

function displayApiBaseUrl(value: string): string {
  return value || "현재 도메인";
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("schedule");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrlState] = useState(() => getApiBaseUrl());
  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState(() => getApiBaseUrl());
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiMessage, setApiMessage] = useState<string | null>(null);

  async function checkHealth(options: { showResult?: boolean } = {}) {
    if (options.showResult) {
      setIsTestingApi(true);
      setApiMessage(null);
    }

    try {
      const data = await getHealth();
      setHealth(data);
      setError(null);
      if (options.showResult) {
        setApiMessage(`연결 성공: ${data.api.status} / ${data.database.driver}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "백엔드 연결 상태를 확인하지 못했습니다.";
      setHealth(null);
      setError(message);
      if (options.showResult) {
        setApiMessage(`연결 실패: ${message}`);
      }
    } finally {
      if (options.showResult) {
        setIsTestingApi(false);
      }
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function pollHealth() {
      if (!isMounted) {
        return;
      }
      await checkHealth();
    }

    void pollHealth();
    const intervalId = window.setInterval(() => void pollHealth(), 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [apiBaseUrl]);

  const page = useMemo(() => {
    switch (activePage) {
      case "schedule":
        return <SchedulePage />;
      case "excel":
        return <ExcelPage />;
      case "chatbot":
        return <ChatbotPage />;
      case "news":
        return <NewsPage />;
      case "admin":
        return <AdminPage />;
      default:
        return <SchedulePage />;
    }
  }, [activePage]);

  function handleApiBaseUrlSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = setApiBaseUrl(apiBaseUrlDraft);
    setApiBaseUrlDraft(normalized);
    setApiBaseUrlState(normalized);
    setApiMessage(`백엔드 URL 저장: ${displayApiBaseUrl(normalized)}`);
    void checkHealth({ showResult: true });
  }

  function handleApiBaseUrlReset() {
    const normalized = setApiBaseUrl("");
    setApiBaseUrlDraft(normalized);
    setApiBaseUrlState(normalized);
    setApiMessage("백엔드 URL 설정을 초기화했습니다.");
    void checkHealth({ showResult: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>행정업무 슈퍼앱</strong>
          <span>Public Admin Workspace</span>
        </div>

        <nav className="nav-list" aria-label="주요 기능">
          {pages.map((item) => (
            <button
              className={item.key === activePage ? "nav-item active" : "nav-item"}
              key={item.key}
              onClick={() => setActivePage(item.key)}
              type="button"
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">MVP Scaffold</p>
            <h1>공공직군 행정업무 통합 작업대</h1>
          </div>
          <div className={health ? "status ok" : "status fail"}>
            <span>FE-BE</span>
            <strong>{health ? "연동 확인" : "대기"}</strong>
          </div>
          <div className={health?.database.connected ? "status ok" : "status fail"}>
            <span>BE-DB</span>
            <strong>{health?.database.connected ? "연동 확인" : "대기"}</strong>
          </div>
        </header>

        <section className="api-config-panel" aria-label="백엔드 연결 설정">
          <form onSubmit={handleApiBaseUrlSubmit}>
            <label>
              백엔드 URL
              <input
                placeholder="예: https://api.example.com"
                value={apiBaseUrlDraft}
                onChange={(event) => setApiBaseUrlDraft(normalizeApiBaseUrl(event.target.value))}
              />
            </label>
            <button type="submit">저장 후 테스트</button>
            <button type="button" onClick={() => void checkHealth({ showResult: true })} disabled={isTestingApi}>
              {isTestingApi ? "테스트 중" : "연결 테스트"}
            </button>
            <button type="button" onClick={handleApiBaseUrlReset}>
              초기화
            </button>
          </form>
          <div>
            <span>현재 연결 대상</span>
            <strong>{displayApiBaseUrl(apiBaseUrl)}</strong>
          </div>
          {apiMessage ? <p>{apiMessage}</p> : null}
        </section>

        {error && (
          <section className="notice" role="status">
            백엔드 연결 확인 실패: {error}
          </section>
        )}

        {health && (
          <section className="integration-panel" aria-label="연동 상태">
            <div>
              <span>API</span>
              <strong>{health.api.status}</strong>
            </div>
            <div>
              <span>Database</span>
              <strong>{health.database.driver}</strong>
            </div>
            <div>
              <span>Checked At</span>
              <strong>{new Date(health.checked_at).toLocaleString("ko-KR")}</strong>
            </div>
          </section>
        )}

        {page}
      </main>
    </div>
  );
}
