export interface HealthResponse {
  api: {
    status: string;
    service: string;
  };
  database: {
    connected: boolean;
    driver: string;
    path: string;
  };
  checked_at: string;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  event_type: "vacation" | "work" | "business_trip" | "training" | "remote" | "etc";
  starts_at: string;
  ends_at: string;
  owner_name: string;
  visibility: "public" | "team" | "private";
}

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  published_at: string;
  summary: string;
  url: string;
  keywords: string[];
}
