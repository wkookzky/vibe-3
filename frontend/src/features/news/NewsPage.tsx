import { useEffect, useState } from "react";
import { getNews } from "../../services/api";
import type { NewsArticle } from "../../types/api";

export function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);

  useEffect(() => {
    getNews().then(setArticles).catch(() => setArticles([]));
  }, []);

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">News Collector</p>
          <h2>뉴스 기사 수집</h2>
        </div>
        <button className="primary-button" type="button">즉시 수집</button>
      </div>

      <div className="article-list">
        {articles.map((article) => (
          <article className="article-item" key={article.id}>
            <div>
              <b>{article.title}</b>
              <p>{article.summary}</p>
            </div>
            <span>{article.source}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
