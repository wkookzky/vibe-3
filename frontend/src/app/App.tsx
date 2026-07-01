import { useEffect, useMemo, useState } from "react";
import { AdminPage } from "../features/admin/AdminPage";
import { ChatbotPage } from "../features/chatbot/ChatbotPage";
import { ExcelPage } from "../features/excel/ExcelPage";
import { NewsPage } from "../features/news/NewsPage";
import { SchedulePage } from "../features/schedule/SchedulePage";
import { getHealth } from "../services/api";
import type { HealthResponse } from "../types/api";

type PageKey = "schedule" | "excel" | "chatbot" | "news" | "admin";

const pages: Array<{ key: PageKey; label: string; description: string }> = [
  { key: "schedule", label: "팀 일정", description: "휴가, 근무, 출장 공유" },
  { key: "excel", label: "엑셀 자동화", description: "컬럼 기준 분리와 병합" },
  { key: "chatbot", label: "민원 챗봇", description: "매뉴얼 기반 응대 초안" },
  { key: "news", label: "뉴스 수집", description: "공공행정 기사 모니터링" },
  { key: "admin", label: "운영 관리", description: "권한, 로그, 설정" },
];

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("schedule");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      try {
        const data = await getHealth();
        if (!isMounted) {
          return;
        }
        setHealth(data);
        setError(null);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setHealth(null);
        setError(err instanceof Error ? err.message : "백엔드 연결 상태를 확인하지 못했습니다.");
      }
    }

    void checkHealth();
    const intervalId = window.setInterval(() => void checkHealth(), 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

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
