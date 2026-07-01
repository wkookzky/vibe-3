import type { HealthResponse, NewsArticle, ScheduleEvent } from "../types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function getHealth() {
  return request<HealthResponse>("/api/health");
}

export function getSchedules() {
  return request<ScheduleEvent[]>("/api/schedules");
}

export function getNews() {
  return request<NewsArticle[]>("/api/news");
}
