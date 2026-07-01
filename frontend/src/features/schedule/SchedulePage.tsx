import { useEffect, useState } from "react";
import { getSchedules } from "../../services/api";
import type { ScheduleEvent } from "../../types/api";

const typeLabel: Record<ScheduleEvent["event_type"], string> = {
  vacation: "휴가",
  work: "근무",
  business_trip: "출장",
  training: "교육",
  remote: "재택",
  etc: "기타",
};

export function SchedulePage() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    getSchedules().then(setEvents).catch(() => setEvents([]));
  }, []);

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Schedule</p>
          <h2>팀원 스케쥴 관리</h2>
        </div>
        <button className="primary-button" type="button">일정 등록</button>
      </div>

      <div className="toolbar">
        <button type="button">월간</button>
        <button type="button">주간</button>
        <button type="button">일간</button>
      </div>

      <div className="calendar-grid">
        {["월", "화", "수", "목", "금"].map((day) => (
          <div className="calendar-column" key={day}>
            <strong>{day}</strong>
            {events.slice(0, 2).map((event) => (
              <article className="mini-event" key={`${day}-${event.id}`}>
                <span>{typeLabel[event.event_type]}</span>
                <b>{event.title}</b>
                <small>{event.owner_name}</small>
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
