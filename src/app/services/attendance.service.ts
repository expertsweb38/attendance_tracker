import { Injectable, signal } from '@angular/core';
import { AttendanceRecord, PeriodSummary } from '../models/attendance.model';
import { combineDateKeyAndTime, diffMs, endOfMonth, endOfWeek, formatDuration, msToHours, parseDateKey, startOfMonth, startOfWeek, toDateKey, within } from '../utils/date-utils';

const STORAGE_KEY = 'attendance_records_v1';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly recordsSignal = signal<AttendanceRecord[]>(this.load());

  get records() { return this.recordsSignal.asReadonly(); }

  checkIn(now = new Date()): void {
    const dateKey = toDateKey(now);
    const existing = this.findByDate(dateKey);
    if (existing) {
      existing.checkIn = now.toISOString();
      existing.checkOut = undefined;
      existing.totalMs = undefined;
      this.update(existing);
    } else {
      this.add({ date: dateKey, checkIn: now.toISOString() });
    }
  }

  checkOut(now = new Date()): void {
    const todayKey = toDateKey(now);
    // Find the most recent open record (no checkout), prefer today, else last open
    const open = [...this.recordsSignal()].reverse().find(r => !r.checkOut);
    if (!open) return; // checkout without checkin -> ignore
    // Attendance date remains the check-in date
    const endIso = now.toISOString();
    const total = diffMs(open.checkIn, endIso);
    const updated: AttendanceRecord = { ...open, checkOut: endIso, totalMs: total };
    this.update(updated);
  }

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.recordsSignal.set([]);
  }

  getTodayStatus(now = new Date()): { checkedIn: boolean; checkInTime?: string; workedMs: number; formatted: string } {
    const todayKey = toDateKey(now);
    const rec = this.findByDate(todayKey);
    if (!rec) return { checkedIn: false, workedMs: 0, formatted: '00:00' };
    if (!rec.checkOut) {
      const worked = diffMs(rec.checkIn, now.toISOString());
      return { checkedIn: true, checkInTime: rec.checkIn, workedMs: worked, formatted: formatDuration(worked) };
    }
    const worked = rec.totalMs ?? 0;
    return { checkedIn: false, checkInTime: rec.checkIn, workedMs: worked, formatted: formatDuration(worked) };
  }

  getDailyList(): AttendanceRecord[] {
    return [...this.recordsSignal()].sort((a, b) => a.date.localeCompare(b.date));
  }

  getSummary(now = new Date()): {
    totalPresentDays: number;
    totalAbsentDaysMonth: number;
    averageDailyHours: number;
    week: PeriodSummary;
    month: PeriodSummary;
  } {
    const list = this.getDailyList();
    const uniqueDates = new Set(list.map(r => r.date));
    const totalPresentDays = uniqueDates.size;

    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const daysElapsedInMonth = Math.min(
      Math.floor((now.getTime() - monthStart.getTime()) / (1000*60*60*24)) + 1,
      monthEnd.getDate()
    );
    const presentThisMonth = new Set(list.filter(r => within(r.date, toDateKey(monthStart), toDateKey(now))).map(r => r.date)).size;
    const totalAbsentDaysMonth = Math.max(0, daysElapsedInMonth - presentThisMonth);

    const sumMs = list.reduce((acc, r) => acc + (r.totalMs ?? 0), 0);
    const averageDailyHours = uniqueDates.size ? msToHours(sumMs / uniqueDates.size) : 0;

    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const weekStartKey = toDateKey(weekStart);
    const weekTodayKey = toDateKey(now);
    const weekElapsedDays = Math.min(
      Math.floor((now.getTime() - weekStart.getTime()) / (1000*60*60*24)) + 1,
      7
    );
    const weekCompleted = list.filter(r => (r.totalMs ?? 0) > 0 && within(r.date, weekStartKey, toDateKey(weekEnd)));
    const weekMs = weekCompleted.reduce((a, r) => a + (r.totalMs ?? 0), 0);
    const weekTargetMs = weekCompleted.length * 9 * 60 * 60 * 1000;

    const monthStartKey = toDateKey(monthStart);
    const monthCompleted = list.filter(r => (r.totalMs ?? 0) > 0 && within(r.date, monthStartKey, toDateKey(monthEnd)));
    const monthMs = monthCompleted.reduce((a, r) => a + (r.totalMs ?? 0), 0);
    const monthTargetMs = monthCompleted.length * 9 * 60 * 60 * 1000;

    const weekSummary: PeriodSummary = {
      period: 'week',
      startDate: weekStartKey,
      endDate: toDateKey(weekEnd),
      totalMs: weekMs,
      targetMs: weekTargetMs,
      aheadBehindMs: weekMs - weekTargetMs,
    };

    const monthSummary: PeriodSummary = {
      period: 'month',
      startDate: monthStartKey,
      endDate: toDateKey(monthEnd),
      totalMs: monthMs,
      targetMs: monthTargetMs,
      aheadBehindMs: monthMs - monthTargetMs,
    };

    return { totalPresentDays, totalAbsentDaysMonth, averageDailyHours, week: weekSummary, month: monthSummary };
  }

  // Internal helpers
  setTotalMs(dateKey: string, totalMs: number): void {
    const normalizedTotal = Math.max(0, Math.floor(totalMs));
    let rec = this.findByDate(dateKey);
    if (!rec) {
      // Create a new record for an absent day; set check-in at 00:00 local time
      const base = parseDateKey(dateKey);
      base.setHours(0, 0, 0, 0);
      rec = { date: dateKey, checkIn: base.toISOString() };
      this.add(rec);
    }
    const checkInTime = new Date(rec.checkIn).getTime();
    const computedCheckout = new Date(checkInTime + normalizedTotal);
    const updated: AttendanceRecord = { ...rec, totalMs: normalizedTotal, checkOut: computedCheckout.toISOString() };
    this.update(updated);
  }

  private add(record: AttendanceRecord): void {
    const next = [...this.recordsSignal(), record];
    this.save(next);
  }

  private update(record: AttendanceRecord): void {
    const next = this.recordsSignal().map(r => r.date === record.date ? record : r);
    this.save(next);
  }

  private findByDate(dateKey: string): AttendanceRecord | undefined {
    return this.recordsSignal().find(r => r.date === dateKey);
  }

  private load(): AttendanceRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as AttendanceRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private save(list: AttendanceRecord[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    this.recordsSignal.set(list);
  }

  setTimesByClock(dateKey: string, checkInHHMM: string, checkOutHHMM: string): void {
    const ci = combineDateKeyAndTime(dateKey, checkInHHMM);
    let co = combineDateKeyAndTime(dateKey, checkOutHHMM);
    // If checkout time is earlier than checkin time, assume next day checkout
    if (co.getTime() < ci.getTime()) {
      co = combineDateKeyAndTime(dateKey, checkOutHHMM, true);
    }
    let rec = this.findByDate(dateKey);
    if (!rec) {
      rec = { date: dateKey, checkIn: ci.toISOString() };
      this.add(rec);
    }
    const total = Math.max(0, co.getTime() - ci.getTime());
    this.update({ ...rec, checkIn: ci.toISOString(), checkOut: co.toISOString(), totalMs: total });
  }

  setCheckInByClock(dateKey: string, checkInHHMM: string): void {
    const ci = combineDateKeyAndTime(dateKey, checkInHHMM);
    const rec = this.findByDate(dateKey);
    if (!rec) {
      // Create an open session starting from the provided time
      this.add({ date: dateKey, checkIn: ci.toISOString() });
      return;
    }
    if (!rec.checkOut) {
      // Open session: move check-in, total is dynamic; leave totalMs undefined
      this.update({ ...rec, checkIn: ci.toISOString(), totalMs: undefined });
      return;
    }
    // Closed session: move check-in and recompute totalMs using existing checkout
    const total = Math.max(0, new Date(rec.checkOut).getTime() - ci.getTime());
    this.update({ ...rec, checkIn: ci.toISOString(), totalMs: total });
  }
}


