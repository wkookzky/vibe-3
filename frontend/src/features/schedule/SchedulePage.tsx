import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createSchedule,
  createTeamMember,
  deleteSchedule,
  deleteTeamMember,
  getSchedules,
  getTeamMembers,
  updateSchedule,
  updateTeamMember,
} from "../../services/api";
import type { ScheduleEvent, ScheduleEventPayload, ScheduleEventType, TeamMember, TeamMemberPayload } from "../../types/api";

type ViewMode = "week" | "month" | "members";

interface MemberFormState {
  id: string | null;
  name: string;
  role: string;
  department: string;
}

interface ScheduleFormState {
  id: string | null;
  title: string;
  member_id: string;
  event_type: ScheduleEventType;
  starts_at: string;
  ends_at: string;
  memo: string;
}

const eventTypeOptions: Array<{ value: ScheduleEventType; label: string }> = [
  { value: "vacation", label: "휴가" },
  { value: "work", label: "근무" },
  { value: "business_trip", label: "출장" },
  { value: "training", label: "교육" },
  { value: "remote", label: "재택" },
  { value: "etc", label: "기타" },
];

const eventTypeLabel = Object.fromEntries(eventTypeOptions.map((option) => [option.value, option.label])) as Record<
  ScheduleEventType,
  string
>;

const emptyMemberForm: MemberFormState = {
  id: null,
  name: "",
  role: "",
  department: "",
};

const emptyScheduleForm: ScheduleFormState = {
  id: null,
  title: "",
  member_id: "",
  event_type: "work",
  starts_at: "",
  ends_at: "",
  memo: "",
};

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfWeek(date: Date): Date {
  const base = startOfDay(date);
  const day = base.getDay();
  return addDays(base, -day);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatKoreanDate(date: Date): string {
  return date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatMonthTitle(date: Date): string {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });
}

function formatDateTime(dateText: string): string {
  return new Date(dateText).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateTimeInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function fromDateTimeInputValue(value: string): string {
  return new Date(value).toISOString();
}

function eventOverlapsDay(event: ScheduleEvent, day: Date): boolean {
  const startsAt = new Date(event.starts_at).getTime();
  const endsAt = new Date(event.ends_at).getTime();
  return startsAt <= endOfDay(day).getTime() && endsAt >= startOfDay(day).getTime();
}

function eventToForm(event: ScheduleEvent): ScheduleFormState {
  return {
    id: event.id,
    title: event.title,
    member_id: event.member_id,
    event_type: event.event_type,
    starts_at: toDateTimeInputValue(new Date(event.starts_at)),
    ends_at: toDateTimeInputValue(new Date(event.ends_at)),
    memo: event.memo,
  };
}

function memberToForm(member: TeamMember): MemberFormState {
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    department: member.department,
  };
}

function buildDefaultScheduleForm(members: TeamMember[], anchorDate: Date): ScheduleFormState {
  const startsAt = new Date(anchorDate);
  startsAt.setHours(9, 0, 0, 0);
  const endsAt = new Date(anchorDate);
  endsAt.setHours(18, 0, 0, 0);

  return {
    ...emptyScheduleForm,
    member_id: members[0]?.id ?? "",
    starts_at: toDateTimeInputValue(startsAt),
    ends_at: toDateTimeInputValue(endsAt),
  };
}

export function SchedulePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [memberForm, setMemberForm] = useState<MemberFormState>(emptyMemberForm);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(() => buildDefaultScheduleForm([], new Date()));
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const monthStart = useMemo(() => startOfMonth(anchorDate), [anchorDate]);
  const monthEnd = useMemo(() => endOfMonth(anchorDate), [anchorDate]);
  const monthGridDays = useMemo(() => {
    const gridStart = startOfWeek(monthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [monthStart]);

  const visibleRange = useMemo(() => {
    if (viewMode === "month") {
      return {
        from: startOfDay(monthGridDays[0]),
        to: endOfDay(monthGridDays[monthGridDays.length - 1]),
      };
    }

    return {
      from: startOfDay(weekDays[0]),
      to: endOfDay(weekDays[weekDays.length - 1]),
    };
  }, [monthGridDays, viewMode, weekDays]);

  async function loadMembers() {
    const nextMembers = await getTeamMembers();
    setMembers(nextMembers);
    setScheduleForm((current) => {
      if (current.member_id || nextMembers.length === 0) {
        return current;
      }
      return { ...current, member_id: nextMembers[0].id };
    });
  }

  async function loadEvents() {
    const nextEvents = await getSchedules(visibleRange.from.toISOString(), visibleRange.to.toISOString());
    setEvents(nextEvents);
  }

  async function refreshData() {
    setIsLoading(true);
    setMessage(null);
    try {
      await Promise.all([loadMembers(), loadEvents()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshData();
  }, [visibleRange.from, visibleRange.to]);

  function resetScheduleForm() {
    setScheduleForm(buildDefaultScheduleForm(members, anchorDate));
  }

  async function handleMemberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: TeamMemberPayload = {
      name: memberForm.name,
      role: memberForm.role,
      department: memberForm.department,
    };

    setIsLoading(true);
    setMessage(null);
    try {
      if (memberForm.id) {
        await updateTeamMember(memberForm.id, payload);
        setMessage("팀원 정보를 수정했습니다.");
      } else {
        await createTeamMember(payload);
        setMessage("팀원을 등록했습니다.");
      }
      setMemberForm(emptyMemberForm);
      await loadMembers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "팀원 정보를 저장하지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteMember(memberId: string) {
    setIsLoading(true);
    setMessage(null);
    try {
      await deleteTeamMember(memberId);
      setMessage("팀원을 삭제했습니다.");
      if (memberForm.id === memberId) {
        setMemberForm(emptyMemberForm);
      }
      await loadMembers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "팀원을 삭제하지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleScheduleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: ScheduleEventPayload = {
      title: scheduleForm.title,
      member_id: scheduleForm.member_id,
      event_type: scheduleForm.event_type,
      starts_at: fromDateTimeInputValue(scheduleForm.starts_at),
      ends_at: fromDateTimeInputValue(scheduleForm.ends_at),
      memo: scheduleForm.memo,
    };

    setIsLoading(true);
    setMessage(null);
    try {
      if (scheduleForm.id) {
        await updateSchedule(scheduleForm.id, payload);
        setMessage("일정을 수정했습니다.");
      } else {
        await createSchedule(payload);
        setMessage("일정을 등록했습니다.");
      }
      resetScheduleForm();
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "일정을 저장하지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteSchedule(eventId: string) {
    setIsLoading(true);
    setMessage(null);
    try {
      await deleteSchedule(eventId);
      setMessage("일정을 삭제했습니다.");
      if (scheduleForm.id === eventId) {
        resetScheduleForm();
      }
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "일정을 삭제하지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  const weekEvents = useMemo(
    () => events.filter((event) => weekDays.some((day) => eventOverlapsDay(event, day))),
    [events, weekDays],
  );

  return (
    <section className="page-section schedule-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Schedule</p>
          <h2>팀원 일정 관리</h2>
        </div>
        <button className="primary-button" type="button" onClick={resetScheduleForm} disabled={members.length === 0}>
          일정 등록
        </button>
      </div>

      <div className="toolbar segmented-toolbar">
        <button className={viewMode === "week" ? "active" : ""} type="button" onClick={() => setViewMode("week")}>
          주간
        </button>
        <button className={viewMode === "month" ? "active" : ""} type="button" onClick={() => setViewMode("month")}>
          월간
        </button>
        <button className={viewMode === "members" ? "active" : ""} type="button" onClick={() => setViewMode("members")}>
          팀원 관리
        </button>
      </div>

      {message ? <div className="inline-message">{message}</div> : null}

      <div className="schedule-layout">
        <div className="schedule-main">
          {viewMode === "members" ? (
            <div className="member-list">
              {members.map((member) => (
                <article className="member-row" key={member.id}>
                  <div>
                    <strong>{member.name}</strong>
                    <span>
                      {member.department} · {member.role}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button type="button" onClick={() => setMemberForm(memberToForm(member))}>
                      수정
                    </button>
                    <button type="button" onClick={() => void handleDeleteMember(member.id)}>
                      삭제
                    </button>
                  </div>
                </article>
              ))}
              {members.length === 0 ? <p className="empty-state">등록된 팀원이 없습니다.</p> : null}
            </div>
          ) : (
            <>
              <div className="period-nav">
                <button
                  type="button"
                  onClick={() => setAnchorDate((current) => (viewMode === "month" ? addMonths(current, -1) : addDays(current, -7)))}
                >
                  이전
                </button>
                <strong>
                  {viewMode === "month"
                    ? formatMonthTitle(anchorDate)
                    : `${formatKoreanDate(weekDays[0])} - ${formatKoreanDate(weekDays[6])}`}
                </strong>
                <button
                  type="button"
                  onClick={() => setAnchorDate((current) => (viewMode === "month" ? addMonths(current, 1) : addDays(current, 7)))}
                >
                  다음
                </button>
              </div>

              {viewMode === "week" ? (
                <div className="schedule-table-wrap">
                  <table className="schedule-table">
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>시간</th>
                        <th>팀원</th>
                        <th>유형</th>
                        <th>제목</th>
                        <th>메모</th>
                        <th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekEvents.map((event) => (
                        <tr key={event.id}>
                          <td>{formatKoreanDate(new Date(event.starts_at))}</td>
                          <td>
                            {formatDateTime(event.starts_at)} - {formatDateTime(event.ends_at)}
                          </td>
                          <td>{event.member_name}</td>
                          <td>{eventTypeLabel[event.event_type]}</td>
                          <td>{event.title}</td>
                          <td>{event.memo || "-"}</td>
                          <td>
                            <div className="row-actions">
                              <button type="button" onClick={() => setScheduleForm(eventToForm(event))}>
                                수정
                              </button>
                              <button type="button" onClick={() => void handleDeleteSchedule(event.id)}>
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {weekEvents.length === 0 ? <p className="empty-state">이번 주 일정이 없습니다.</p> : null}
                </div>
              ) : (
                <div className="month-calendar">
                  {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                    <strong className="weekday-head" key={day}>
                      {day}
                    </strong>
                  ))}
                  {monthGridDays.map((day) => {
                    const dayEvents = events.filter((event) => eventOverlapsDay(event, day));
                    const isOutsideMonth = day < monthStart || day > monthEnd;

                    return (
                      <div className={`month-cell ${isOutsideMonth ? "muted" : ""}`} key={formatDateKey(day)}>
                        <span className="date-number">{day.getDate()}</span>
                        <div className="month-events">
                          {dayEvents.map((event) => (
                            <button
                              className={`event-chip ${event.event_type}`}
                              key={event.id}
                              type="button"
                              onClick={() => setScheduleForm(eventToForm(event))}
                            >
                              {event.member_name} · {event.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="schedule-side">
          {viewMode === "members" ? (
            <form className="work-panel compact-form" onSubmit={(event) => void handleMemberSubmit(event)}>
              <h3>{memberForm.id ? "팀원 수정" : "팀원 등록"}</h3>
              <label>
                이름
                <input value={memberForm.name} onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })} />
              </label>
              <label>
                직책
                <input value={memberForm.role} onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value })} />
              </label>
              <label>
                부서
                <input
                  value={memberForm.department}
                  onChange={(event) => setMemberForm({ ...memberForm, department: event.target.value })}
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={isLoading}>
                  {memberForm.id ? "수정 저장" : "등록"}
                </button>
                <button type="button" onClick={() => setMemberForm(emptyMemberForm)}>
                  취소
                </button>
              </div>
            </form>
          ) : (
            <form className="work-panel compact-form" onSubmit={(event) => void handleScheduleSubmit(event)}>
              <h3>{scheduleForm.id ? "일정 수정" : "일정 등록"}</h3>
              {members.length === 0 ? <p className="empty-state">일정을 등록하려면 팀원을 먼저 등록하세요.</p> : null}
              <label>
                제목
                <input
                  value={scheduleForm.title}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, title: event.target.value })}
                />
              </label>
              <label>
                팀원
                <select
                  value={scheduleForm.member_id}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, member_id: event.target.value })}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {member.department}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                유형
                <select
                  value={scheduleForm.event_type}
                  onChange={(event) =>
                    setScheduleForm({ ...scheduleForm, event_type: event.target.value as ScheduleEventType })
                  }
                >
                  {eventTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                시작일시
                <input
                  type="datetime-local"
                  value={scheduleForm.starts_at}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, starts_at: event.target.value })}
                />
              </label>
              <label>
                종료일시
                <input
                  type="datetime-local"
                  value={scheduleForm.ends_at}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, ends_at: event.target.value })}
                />
              </label>
              <label>
                메모
                <textarea
                  value={scheduleForm.memo}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, memo: event.target.value })}
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={isLoading || members.length === 0}>
                  {scheduleForm.id ? "수정 저장" : "등록"}
                </button>
                <button type="button" onClick={resetScheduleForm}>
                  취소
                </button>
              </div>
            </form>
          )}
        </aside>
      </div>
    </section>
  );
}
