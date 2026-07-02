from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Iterable
from urllib.parse import urljoin
from uuid import uuid4

import httpx
from bs4 import BeautifulSoup, Tag

from app.db.sqlite import get_connection

POLICY_NEWS_URL = "https://www.korea.kr/news/policyNewsList.do"
SOURCE_NAME = "대한민국 정책브리핑"
KST = timezone(timedelta(hours=9))
MAX_PAGES = 20
REQUEST_TIMEOUT = 10.0

CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "경제": ("경제", "수출", "금융", "산업", "기업", "소상공", "예산", "세제", "무역", "투자"),
    "사회": ("사회", "복지", "고용", "노동", "교육", "보건", "의료", "안전", "청년", "가족", "육아"),
    "문화": ("문화", "관광", "체육", "예술", "콘텐츠", "공연"),
    "외교·안보": ("외교", "안보", "국방", "통일", "남북", "국제"),
}


@dataclass(frozen=True)
class ScrapedNewsArticle:
    id: str
    title: str
    source: str
    published_at: str
    summary: str
    url: str
    image_url: str
    category: str
    has_image: bool
    keywords: list[str]


@dataclass(frozen=True)
class CollectionResult:
    inserted: int
    updated: int
    total: int
    failed: int


@dataclass(frozen=True)
class NewsCollectionSummary:
    target_date: str
    inserted: int
    updated: int
    total: int
    failed: int
    status: str


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def stable_article_id(url: str) -> str:
    return f"news-{hashlib.sha1(url.encode('utf-8')).hexdigest()[:16]}"


def classify_title(title: str) -> str:
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in title for keyword in keywords):
            return category
    return "기타"


def extract_keywords(title: str, category: str) -> list[str]:
    keywords = [category]
    for word in re.findall(r"[가-힣A-Za-z0-9]{2,}", title):
        if word not in keywords:
            keywords.append(word)
        if len(keywords) >= 6:
            break
    return keywords


def parse_korean_date(text: str) -> datetime | None:
    match = re.search(r"(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})", text)
    if not match:
        return None
    year, month, day = (int(part) for part in match.groups())
    return datetime(year, month, day, tzinfo=KST)


def article_published_date(article: ScrapedNewsArticle) -> date:
    return datetime.fromisoformat(article.published_at).astimezone(KST).date()


def meta_content(soup: BeautifulSoup, *names: str) -> str:
    for name in names:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if isinstance(tag, Tag):
            content = tag.get("content")
            if isinstance(content, str) and content.strip():
                return clean_text(content)
    return ""


def first_image_url(soup: BeautifulSoup, page_url: str) -> str:
    image = meta_content(soup, "og:image", "twitter:image")
    if image:
        return urljoin(page_url, image)

    for img in soup.find_all("img"):
        if not isinstance(img, Tag):
            continue
        src = img.get("src") or img.get("data-src")
        if isinstance(src, str) and src.strip() and not src.startswith("data:"):
            return urljoin(page_url, src)
    return ""


def article_links_from_list(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    for anchor in soup.find_all("a", href=True):
        if not isinstance(anchor, Tag):
            continue
        href = str(anchor.get("href", ""))
        if "policyNewsView.do" not in href:
            continue
        url = urljoin(POLICY_NEWS_URL, href)
        if url not in links:
            links.append(url)
    return links


def parse_article_detail(html: str, url: str, fallback_title: str = "") -> ScrapedNewsArticle | None:
    soup = BeautifulSoup(html, "html.parser")
    page_text = clean_text(soup.get_text(" ", strip=True))

    title = meta_content(soup, "og:title", "twitter:title")
    if not title:
        heading = soup.find(["h1", "h2"])
        title = clean_text(heading.get_text(" ", strip=True)) if isinstance(heading, Tag) else fallback_title
    title = clean_text(title)
    if not title:
        return None

    published_at = parse_korean_date(page_text)
    if published_at is None:
        return None

    summary = meta_content(soup, "description", "og:description")
    if not summary:
        paragraphs = [clean_text(p.get_text(" ", strip=True)) for p in soup.find_all("p") if isinstance(p, Tag)]
        summary = next((paragraph for paragraph in paragraphs if len(paragraph) >= 40), "")
    if len(summary) > 280:
        summary = f"{summary[:277].rstrip()}..."

    image_url = first_image_url(soup, url)
    category = classify_title(title)
    return ScrapedNewsArticle(
        id=stable_article_id(url),
        title=title,
        source=SOURCE_NAME,
        published_at=published_at.isoformat(),
        summary=summary,
        url=url,
        image_url=image_url,
        category=category,
        has_image=bool(image_url),
        keywords=extract_keywords(title, category),
    )


def fetch_policy_news_by_date(
    target_date: date,
    client: httpx.Client | None = None,
    max_pages: int = MAX_PAGES,
) -> tuple[list[ScrapedNewsArticle], int]:
    close_client = client is None
    http_client = client or httpx.Client(timeout=REQUEST_TIMEOUT, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"})
    articles: list[ScrapedNewsArticle] = []
    failed = 0

    try:
        for page_index in range(1, max_pages + 1):
            response = http_client.get(POLICY_NEWS_URL, params={"pageIndex": page_index})
            response.raise_for_status()
            links = article_links_from_list(response.text)
            if not links:
                break

            page_had_newer = False
            page_had_target = False
            page_had_older = False

            for link in links:
                try:
                    detail = http_client.get(link)
                    detail.raise_for_status()
                    article = parse_article_detail(detail.text, link)
                except httpx.HTTPError:
                    failed += 1
                    continue

                if article is None:
                    failed += 1
                    continue

                published_date = article_published_date(article)
                if published_date > target_date:
                    page_had_newer = True
                    continue
                if published_date < target_date:
                    page_had_older = True
                    continue

                page_had_target = True
                if all(existing.url != article.url for existing in articles):
                    articles.append(article)

            if page_had_older and not page_had_newer:
                break
            if page_had_older and page_had_target:
                break
    finally:
        if close_client:
            http_client.close()

    return articles, failed


def fetch_recent_policy_news(client: httpx.Client | None = None, days: int = 31, max_pages: int = MAX_PAGES) -> tuple[list[ScrapedNewsArticle], int]:
    target_date = datetime.now(KST).date() - timedelta(days=1)
    return fetch_policy_news_by_date(target_date=target_date, client=client, max_pages=max_pages)


def upsert_news_articles(connection, articles: Iterable[ScrapedNewsArticle]) -> CollectionResult:
    inserted = 0
    updated = 0
    failed = 0
    collected_at = datetime.now(timezone.utc).isoformat()

    for article in articles:
        try:
            existing = connection.execute("SELECT id FROM news_articles WHERE url = ?", (article.url,)).fetchone()
            connection.execute(
                """
                INSERT INTO news_articles
                (id, title, source, published_at, summary, url, keywords, image_url, category, has_image, collected_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(url) DO UPDATE SET
                    id = excluded.id,
                    title = excluded.title,
                    source = excluded.source,
                    published_at = excluded.published_at,
                    summary = excluded.summary,
                    keywords = excluded.keywords,
                    image_url = excluded.image_url,
                    category = excluded.category,
                    has_image = excluded.has_image,
                    collected_at = excluded.collected_at
                """,
                (
                    article.id,
                    article.title,
                    article.source,
                    article.published_at,
                    article.summary,
                    article.url,
                    ",".join(article.keywords),
                    article.image_url,
                    article.category,
                    int(article.has_image),
                    collected_at,
                ),
            )
            if existing is None:
                inserted += 1
            else:
                updated += 1
        except Exception:
            failed += 1

    return CollectionResult(inserted=inserted, updated=updated, total=inserted + updated, failed=failed)


def record_collection_run(
    connection,
    target_date: date,
    trigger_type: str,
    started_at: str,
    finished_at: str,
    inserted: int,
    updated: int,
    failed: int,
    status: str,
    error_message: str = "",
) -> None:
    connection.execute(
        """
        INSERT INTO news_collection_runs
        (id, target_date, trigger_type, started_at, finished_at, inserted, updated, failed, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            f"run-{uuid4().hex}",
            target_date.isoformat(),
            trigger_type,
            started_at,
            finished_at,
            inserted,
            updated,
            failed,
            status,
            error_message,
        ),
    )


def collect_policy_news_for_date(target_date: date, trigger_type: str) -> NewsCollectionSummary:
    started_at = datetime.now(timezone.utc).isoformat()
    try:
        articles, fetch_failed = fetch_policy_news_by_date(target_date)
    except Exception as exc:
        finished_at = datetime.now(timezone.utc).isoformat()
        with get_connection() as connection:
            record_collection_run(connection, target_date, trigger_type, started_at, finished_at, 0, 0, 0, "failed", str(exc))
        raise

    with get_connection() as connection:
        result = upsert_news_articles(connection, articles)
        failed = result.failed + fetch_failed
        status = "success" if failed == 0 else "partial"
        finished_at = datetime.now(timezone.utc).isoformat()
        record_collection_run(
            connection,
            target_date,
            trigger_type,
            started_at,
            finished_at,
            result.inserted,
            result.updated,
            failed,
            status,
        )

    return NewsCollectionSummary(
        target_date=target_date.isoformat(),
        inserted=result.inserted,
        updated=result.updated,
        total=result.total,
        failed=failed,
        status=status,
    )
