export function ExcelPage() {
  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Excel Automation</p>
          <h2>엑셀 업무 자동화</h2>
        </div>
        <button className="primary-button" type="button">파일 선택</button>
      </div>

      <div className="two-column">
        <div className="work-panel">
          <h3>컬럼 기준 파일 분리</h3>
          <label>
            기준 컬럼
            <select>
              <option>부서</option>
              <option>담당자</option>
              <option>처리상태</option>
            </select>
          </label>
          <button type="button">분리 작업 생성</button>
        </div>
        <div className="work-panel">
          <h3>여러 파일 병합</h3>
          <label>
            중복 제거 기준
            <select>
              <option>전체 행</option>
              <option>민원번호</option>
              <option>접수일 + 담당자</option>
            </select>
          </label>
          <button type="button">병합 작업 생성</button>
        </div>
      </div>
    </section>
  );
}
