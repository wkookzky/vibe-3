export function ChatbotPage() {
  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Complaint Chatbot</p>
          <h2>민원 대응 챗봇</h2>
        </div>
        <button className="primary-button" type="button">매뉴얼 업로드</button>
      </div>

      <div className="chat-layout">
        <div className="chat-box">
          <div className="message assistant">
            매뉴얼 근거를 찾은 뒤 응대 방향, 주의사항, 스크립트 초안을 제공합니다.
          </div>
          <textarea placeholder="민원 내용을 입력하세요. 개인정보는 입력 전 마스킹하세요." />
          <button type="button">답변 초안 생성</button>
        </div>
        <aside className="evidence-panel">
          <h3>근거 문서</h3>
          <p>매뉴얼 인덱싱 후 관련 섹션과 페이지가 표시됩니다.</p>
        </aside>
      </div>
    </section>
  );
}
