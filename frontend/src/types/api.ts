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

export type ScheduleEventType = "vacation" | "work" | "business_trip" | "training" | "remote" | "etc";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberPayload {
  name: string;
  role: string;
  department: string;
}

export interface ScheduleEvent {
  id: string;
  member_id: string;
  member_name: string;
  member_role: string;
  member_department: string;
  title: string;
  event_type: ScheduleEventType;
  starts_at: string;
  ends_at: string;
  memo: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleEventPayload {
  title: string;
  member_id: string;
  event_type: ScheduleEventType;
  starts_at: string;
  ends_at: string;
  memo: string;
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
