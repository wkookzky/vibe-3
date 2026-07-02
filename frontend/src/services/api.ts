import type {
  HealthResponse,
  NewsCollectionResponse,
  NewsListResponse,
  ScheduleEvent,
  ScheduleEventPayload,
  TeamMember,
  TeamMemberPayload,
} from "../types/api";

const API_BASE_STORAGE_KEY = "admin-superapp-api-base-url";
const DEFAULT_API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL ?? "");

export function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) {
    return "";
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) {
    return trimmed;
  }

  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/.test(trimmed)) {
    return `http://${trimmed}`;
  }

  return `https://${trimmed}`;
}

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return DEFAULT_API_BASE_URL;
  }
  return normalizeApiBaseUrl(window.localStorage.getItem(API_BASE_STORAGE_KEY) ?? DEFAULT_API_BASE_URL);
}

export function setApiBaseUrl(value: string): string {
  const normalized = normalizeApiBaseUrl(value);
  if (normalized) {
    window.localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
  } else {
    window.localStorage.removeItem(API_BASE_STORAGE_KEY);
  }
  return normalized;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) {
        message = body.detail;
      }
    } catch {
      // Keep the HTTP status text when the response has no JSON body.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function jsonRequest<T>(path: string, method: "POST" | "PATCH", body: unknown) {
  return request<T>(path, {
    method,
    body: JSON.stringify(body),
  });
}

export function getHealth() {
  return request<HealthResponse>("/api/health");
}

export function getTeamMembers() {
  return request<TeamMember[]>("/api/team-members");
}

export function createTeamMember(payload: TeamMemberPayload) {
  return jsonRequest<TeamMember>("/api/team-members", "POST", payload);
}

export function updateTeamMember(memberId: string, payload: TeamMemberPayload) {
  return jsonRequest<TeamMember>(`/api/team-members/${memberId}`, "PATCH", payload);
}

export function deleteTeamMember(memberId: string) {
  return request<void>(`/api/team-members/${memberId}`, { method: "DELETE" });
}

export function getSchedules(from?: string, to?: string) {
  const search = new URLSearchParams();
  if (from) {
    search.set("from", from);
  }
  if (to) {
    search.set("to", to);
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return request<ScheduleEvent[]>(`/api/schedules${suffix}`);
}

export function createSchedule(payload: ScheduleEventPayload) {
  return jsonRequest<ScheduleEvent>("/api/schedules", "POST", payload);
}

export function updateSchedule(eventId: string, payload: ScheduleEventPayload) {
  return jsonRequest<ScheduleEvent>(`/api/schedules/${eventId}`, "PATCH", payload);
}

export function deleteSchedule(eventId: string) {
  return request<void>(`/api/schedules/${eventId}`, { method: "DELETE" });
}

export function getNews(page = 1, pageSize = 10, publishedDate?: string) {
  const search = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (publishedDate) {
    search.set("published_date", publishedDate);
  }
  return request<NewsListResponse>(`/api/news?${search.toString()}`);
}

export function collectNews(targetDate: string) {
  return request<NewsCollectionResponse>("/api/news/collect", {
    method: "POST",
    body: JSON.stringify({ target_date: targetDate }),
  });
}
