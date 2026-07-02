import { useEffect, useState } from "react";
import { collectNews, getNews } from "../../services/api";
import type { NewsArticle, NewsCollectionResponse } from "../../types/api";

const PAGE_SIZE = 10;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDateInputValue(value: Date): string {
  return new Date(value.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function yesterdayKstDateInputValue(): string {
  return kstDateInputValue(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function collectionMessage(result: NewsCollectionResponse): string {
  return `수집 완료(${result.target_date}): 신규 ${result.inserted}건, 갱신 ${result.updated}건, 실패 ${result.failed}건`;
}

export function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => yesterdayKstDateInputValue());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadNews(nextPage = page, nextDate = selectedDate, clearMessage = true) {
    setIsLoading(true);
    if (clearMessage) {
      setMessage(null);
    }
    try {
      const data = await getNews(nextPage, PAGE_SIZE, nextDate);
      setArticles(data.items);
      setPage(data.page);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error) {
      setArticles([]);
      setMessage(error instanceof Error ? error.message : "뉴스 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCollectNews() {
    setIsCollecting(true);
    setMessage(null);
    try {
      const result = await collectNews(selectedDate);
      setMessage(collectionMessage(result));
      await loadNews(1, selectedDate, false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "뉴스 수집에 실패했습니다.");
    } finally {
      setIsCollecting(false);
    }
  }

  function handleDateChange(value: string) {
    setSelectedDate(value);
    void loadNews(1, value);
  }

  useEffect(() => {
    void loadNews(1, selectedDate);
  }, []);

  return (
    <section className="page-section news-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">News Collector</p>
          <h2>뉴스 기사 수집</h2>
        </div>
        <button className="primary-button" type="button" onClick={() => void handleCollectNews()} disabled={isCollecting || isLoading}>
          {isCollecting ? "수집 중" : "선택일 수집"}
        </button>
      </div>

      <div className="news-controls">
        <label>
          수집/조회 날짜
          <input type="date" value={selectedDate} onChange={(event) => handleDateChange(event.target.value)} />
        </label>
      </div>

      <div className="news-summary-bar">
        <span>총 {total.toLocaleString("ko-KR")}건</span>
        <span>
          {page} / {totalPages} 페이지
        </span>
      </div>

      {message ? <div className="inline-message">{message}</div> : null}

      <div className="article-list">
        {articles.map((article) => (
          <article className="article-item news-card" key={article.id}>
            <a className="news-image" href={article.url} target="_blank" rel="noreferrer" aria-label={article.title}>
              {article.has_image && article.image_url ? <img src={article.image_url} alt="" /> : <span>이미지 없음</span>}
            </a>
            <div className="news-content">
              <div className="news-meta">
                <span>{article.category}</span>
                <span>{article.source}</span>
                <span>{formatDate(article.published_at)}</span>
              </div>
              <a className="news-title" href={article.url} target="_blank" rel="noreferrer">
                {article.title}
              </a>
              <p>{article.summary || "요약 정보가 없습니다."}</p>
              {article.keywords.length > 0 ? (
                <div className="keyword-list">
                  {article.keywords.slice(0, 5).map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {articles.length === 0 && !isLoading ? <p className="empty-state">선택한 날짜에 저장된 뉴스가 없습니다. 수집을 실행해 주세요.</p> : null}
      {isLoading ? <p className="empty-state">뉴스 목록을 불러오는 중입니다.</p> : null}

      <div className="pagination-controls">
        <button type="button" onClick={() => void loadNews(page - 1)} disabled={page <= 1 || isLoading || isCollecting}>
          이전
        </button>
        <button type="button" onClick={() => void loadNews(page + 1)} disabled={page >= totalPages || isLoading || isCollecting}>
          다음
        </button>
      </div>
    </section>
  );
}
