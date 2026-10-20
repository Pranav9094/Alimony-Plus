"use client";
import { useMemo, useState } from "react";
import {
  BellRing,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Scale,
  Wallet,
} from "lucide-react";
import { dateLabel } from "@/lib/ledger";
import type { CaseAlert } from "@/lib/case-workflow";
import type { Hearing } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";
import { Badge, Empty, Modal, PageHeading } from "./ui";

type CalendarMode = "Month" | "Week" | "Agenda";
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const startOfWeek = (date: Date) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 6) % 7));
  return result;
};
const shiftedDate = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};
const monthTitle = (date: Date) =>
  date.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export function CalendarView({ onAdd }: { onAdd: () => void }) {
  const { data, asOf, demo, selectedCase, setSelectedCase } = useWorkspace();
  const [mode, setMode] = useState<CalendarMode>("Month");
  const [cursor, setCursor] = useState(() => new Date(`${asOf}T12:00:00Z`));
  const [selectedDate, setSelectedDate] = useState(asOf);
  const [selectedEvent, setSelectedEvent] = useState<Hearing>();
  const events = data.hearings
    .filter((event) => !selectedCase || event.caseId === selectedCase)
    .sort((a, b) => a.date.localeCompare(b.date));
  const monthDays = useMemo(() => {
    const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1, 12));
    const gridStart = shiftedDate(first, -((first.getUTCDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => shiftedDate(gridStart, index));
  }, [cursor]);
  const weekDays = useMemo(() => {
    const first = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, index) => shiftedDate(first, index));
  }, [cursor]);
  const rangeStart = mode === "Week" ? isoDate(weekDays[0]) : isoDate(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1, 12)));
  const rangeEnd = mode === "Week" ? isoDate(weekDays[6]) : isoDate(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 12)));
  const agendaEvents = events.filter((event) => event.date >= rangeStart && event.date <= rangeEnd);
  const move = (direction: number) => {
    setCursor((current) => {
      const next = new Date(current);
      if (mode === "Month") next.setUTCMonth(next.getUTCMonth() + direction);
      else next.setUTCDate(next.getUTCDate() + direction * (mode === "Week" ? 7 : 30));
      return next;
    });
  };
  const eventType = (event: Hearing) =>
    event.eventType === "summons" ? "Summons return" : event.eventType === "milestone" ? event.milestone || "Case milestone" : "Hearing";
  const eventButton = (event: Hearing) => (
    <button className={`calendar-event ${event.eventType || "hearing"}`} key={event.id} onClick={() => setSelectedEvent(event)}>
      <span aria-hidden="true" />{event.title}
    </button>
  );
  const currentTitle = mode === "Week"
    ? `${dateLabel(isoDate(weekDays[0]))} – ${dateLabel(isoDate(weekDays[6]))}`
    : monthTitle(cursor);
  return (
    <>
      <PageHeading
        eyebrow="COURT DIARY"
        title="Dates, in one clear view."
        description="Keep hearings, summons returns and recorded case milestones together."
      >
        {demo && <button className="button primary" onClick={onAdd}><Plus size={16} />Add event</button>}
      </PageHeading>
      {!demo && <div className="callout mb-6"><CalendarDays size={18} /><span>Hearing and summons events are not available from the connected case service. This calendar shows only events recorded in this session.</span></div>}
      <section className="panel calendar-panel" aria-label="Cause list calendar">
        <div className="calendar-toolbar">
          <div className="calendar-navigation">
            <button className="icon-button" aria-label="Previous date range" title="Previous date range" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
            <button className="calendar-today" onClick={() => { const today = new Date(`${asOf}T12:00:00Z`); setCursor(today); setSelectedDate(asOf); }}>Today</button>
            <button className="icon-button" aria-label="Next date range" title="Next date range" onClick={() => move(1)}><ChevronRight size={18} /></button>
            <h2>{currentTitle}</h2>
          </div>
          <div className="calendar-controls">
            <label className="case-selector">
              <Scale size={15} />
              <select aria-label="Filter calendar by case" value={selectedCase} onChange={(event) => setSelectedCase(Number(event.target.value))}>
                <option value={0}>All cases</option>
                {data.cases.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
              </select>
            </label>
            <div className="calendar-mode" role="group" aria-label="Calendar view">
              {(["Month", "Week", "Agenda"] as const).map((view) => <button key={view} aria-pressed={mode === view} className={mode === view ? "selected" : ""} onClick={() => setMode(view)}>{view}</button>)}
            </div>
          </div>
        </div>
        <div className="calendar-legend"><span><i className="hearing-key" /> Hearing</span><span><i className="summons-key" /> Summons return</span><span><i className="milestone-key" /> Milestone</span></div>
        {mode === "Month" && (
          <div className="month-grid" role="group" aria-label={monthTitle(cursor)}>
            {weekdays.map((day) => <div className="weekday" key={day}>{day}</div>)}
            {monthDays.map((day) => {
              const date = isoDate(day);
              const daily = events.filter((event) => event.date === date);
              const inMonth = day.getUTCMonth() === cursor.getUTCMonth();
              return <div className={`month-day ${inMonth ? "" : "outside-month"} ${selectedDate === date ? "date-selected" : ""}`} key={date}>
                <button className="calendar-date" aria-label={dateLabel(date)} aria-pressed={selectedDate === date} onClick={() => setSelectedDate(date)}>{day.getUTCDate()}</button>
                {daily.map(eventButton)}
              </div>;
            })}
          </div>
        )}
        {mode === "Week" && (
          <div className="week-grid">
            {weekDays.map((day) => {
              const date = isoDate(day);
              return <section className={`week-day ${selectedDate === date ? "date-selected" : ""}`} key={date}>
                <button className="week-date" aria-pressed={selectedDate === date} onClick={() => setSelectedDate(date)}><span>{weekdays[(day.getUTCDay() + 6) % 7]}</span><strong>{day.getUTCDate()}</strong></button>
                {events.filter((event) => event.date === date).map(eventButton)}
              </section>;
            })}
          </div>
        )}
        {mode === "Agenda" && (
          <div className="agenda-list">
            {agendaEvents.length ? agendaEvents.map((event) => <button className="agenda-event" key={event.id} onClick={() => setSelectedEvent(event)}>
              <span className="agenda-date"><strong>{new Date(`${event.date}T12:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", timeZone: "UTC" })}</strong><small>{new Date(`${event.date}T12:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })}</small></span>
              <span className={`agenda-marker ${event.eventType || "hearing"}`} />
              <span className="agenda-copy"><strong>{event.title}</strong><small>{data.cases.find((item) => item.id === event.caseId)?.title || "Case not recorded"} · {event.location}</small></span>
              <Badge tone={event.eventType === "summons" ? "amber" : "neutral"}>{eventType(event)}</Badge>
              <ChevronRight size={17} />
            </button>) : <Empty title={demo ? "No events recorded" : "No connected events"}>{demo ? "Add a hearing, summons return or milestone to start the diary." : "The connected service does not currently provide hearing events."}</Empty>}
          </div>
        )}
        {mode !== "Agenda" && !events.some((event) => event.date === selectedDate) && <p className="calendar-selection">{dateLabel(selectedDate)} · No event recorded on this date</p>}
      </section>
      {selectedEvent && <Modal title={selectedEvent.title} description="Selected cause-list event" onClose={() => setSelectedEvent(undefined)}>
        <dl className="detail-list event-details">
          <div><dt>Event type</dt><dd>{eventType(selectedEvent)}</dd></div>
          <div><dt>Date</dt><dd>{dateLabel(selectedEvent.date)}</dd></div>
          <div><dt>Case</dt><dd>{data.cases.find((item) => item.id === selectedEvent.caseId)?.title || "Case not recorded"}</dd></div>
          <div><dt>Location</dt><dd>{selectedEvent.location || "Not recorded"}</dd></div>
        </dl>
      </Modal>}
    </>
  );
}

export function AlertsView({ alerts }: { alerts: CaseAlert[] }) {
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All statuses");
  const visible = alerts.filter((item) => (category === "All" || item.category === category) && (status === "All statuses" || item.status === status));
  const statuses = [...new Set(alerts.map((item) => item.status))].sort();
  return (
    <>
      <PageHeading eyebrow="ORDERS & MAINTENANCE" title="Important records, surfaced." description="Review recorded orders, payment activity and schedule statuses for the selected case view." />
      <div className="callout mb-6"><BellRing size={18} /><span>These are in-app records derived from available case data. No email, SMS or push reminders are sent.</span></div>
      <div className="alerts-toolbar">
        <div className="filter-tabs" role="group" aria-label="Filter alert category">
          {["All", "Court order", "Maintenance"].map((item) => <button key={item} aria-pressed={category === item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item === "Court order" ? <><Scale size={14} />Orders</> : item === "Maintenance" ? <><Wallet size={14} />Maintenance</> : item}</button>)}
        </div>
        <label className="alert-status-filter">Status
          <select aria-label="Filter alerts by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>All statuses</option>
            {statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <section className="panel alert-list" aria-label="Court order and maintenance alerts">
        {visible.length ? visible.map((item) => <article className="alert-row" key={item.id}>
          <span className={`alert-icon ${item.category === "Court order" ? "order" : "maintenance"}`}>{item.category === "Court order" ? <Scale size={18} /> : <Wallet size={18} />}</span>
          <div className="alert-copy"><p className="eyebrow">{item.category}</p><h2>{item.title}</h2><p>{item.description}</p></div>
          <div className="alert-date"><strong>{dateLabel(item.date)}</strong><Badge tone={item.status === "Received" || item.status === "Recorded" || item.status === "Paid" ? "" : item.status === "Upcoming" ? "neutral" : "amber"}>{item.status}</Badge></div>
        </article>) : <Empty title="No matching alerts">Try another category or status filter.</Empty>}
      </section>
    </>
  );
}
