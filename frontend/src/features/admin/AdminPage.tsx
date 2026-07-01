export function AdminPage() {
  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operation</p>
          <h2>운영 관리</h2>
        </div>
      </div>

      <div className="two-column">
        <div className="work-panel">
          <h3>권한 관리</h3>
          <p>일반 사용자, 팀장, 관리자 역할 기반 접근 제어를 구성합니다.</p>
        </div>
        <div className="work-panel">
          <h3>감사 로그</h3>
          <p>일정 변경, 파일 처리, 챗봇 답변, 뉴스 설정 변경 이력을 확인합니다.</p>
        </div>
      </div>
    </section>
  );
}
