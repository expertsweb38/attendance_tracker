import { Injectable, signal } from '@angular/core';
import { AttendanceRecord, PeriodSummary } from '../models/attendance.model';
import { combineDateKeyAndTime, diffMs, endOfMonth, formatDuration, msToHours, parseDateKey, startOfMonth, toDateKey, within } from '../utils/date-utils';

const STORAGE_KEY = 'attendance_records_v1';
const DAILY_HOURS_KEY = 'daily_hours_limit';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly recordsSignal = signal<AttendanceRecord[]>(this.load());

  get records() { return this.recordsSignal.asReadonly(); }

  /**
   * Get the daily hours limit (default: 9 hours)
   */
  getDailyHoursLimit(): number {
    const saved = localStorage.getItem(DAILY_HOURS_KEY);
    if (saved) {
      const hours = parseFloat(saved);
      if (!isNaN(hours) && hours > 0 && hours <= 24) {
        return hours;
      }
    }
    return 9; // Default to 9 hours
  }

  /**
   * Set the daily hours limit
   */
  setDailyHoursLimit(hours: number): void {
    if (hours > 0 && hours <= 24) {
      localStorage.setItem(DAILY_HOURS_KEY, hours.toString());
    }
  }

  /**
   * Get daily target in milliseconds
   */
  private getDailyTargetMs(): number {
    return this.getDailyHoursLimit() * 60 * 60 * 1000;
  }

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
    // Find the most recent open record (no checkout)
    const open = [...this.recordsSignal()].reverse().find(r => !r.checkOut);
    if (!open) return; // checkout without checkin -> ignore
    // Attendance date remains the check-in date
    // The diffMs function automatically handles next-day checkout correctly
    const endIso = now.toISOString();
    const total = diffMs(open.checkIn, endIso);
    const updated: AttendanceRecord = { ...open, checkOut: endIso, totalMs: total };
    this.update(updated);
  }

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.recordsSignal.set([]);
  }

  getTodayStatus(now = new Date()): { 
    checkedIn: boolean; 
    checkInTime?: string; 
    workedMs: number; 
    formatted: string;
    aheadBehindMs: number;
    aheadBehindFormatted: string;
  } {
    const todayKey = toDateKey(now);
    const rec = this.findByDate(todayKey);
    const DAILY_TARGET_MS = this.getDailyTargetMs();
    
    if (!rec) {
      return { 
        checkedIn: false, 
        workedMs: 0, 
        formatted: '00:00',
        aheadBehindMs: -DAILY_TARGET_MS,
        aheadBehindFormatted: formatDuration(DAILY_TARGET_MS)
      };
    }
    
    let worked: number;
    if (!rec.checkOut) {
      worked = diffMs(rec.checkIn, now.toISOString());
      const aheadBehind = worked - DAILY_TARGET_MS;
      return { 
        checkedIn: true, 
        checkInTime: rec.checkIn, 
        workedMs: worked, 
        formatted: formatDuration(worked),
        aheadBehindMs: aheadBehind,
        aheadBehindFormatted: formatDuration(Math.abs(aheadBehind))
      };
    }
    
    worked = rec.totalMs ?? 0;
    const aheadBehind = worked - DAILY_TARGET_MS;
    return { 
      checkedIn: false, 
      checkInTime: rec.checkIn, 
      workedMs: worked, 
      formatted: formatDuration(worked),
      aheadBehindMs: aheadBehind,
      aheadBehindFormatted: formatDuration(Math.abs(aheadBehind))
    };
  }

  /**
   * Calculate ahead/behind hours for a specific date
   * @param dateKey YYYY-MM-DD format
   * @returns ahead/behind in milliseconds (positive = ahead, negative = behind)
   */
  getDailyAheadBehind(dateKey: string): number {
    const DAILY_TARGET_MS = this.getDailyTargetMs();
    const rec = this.findByDate(dateKey);
    const workedMs = rec?.totalMs ?? 0;
    return workedMs - DAILY_TARGET_MS;
  }

  getDailyList(): AttendanceRecord[] {
    return [...this.recordsSignal()].sort((a, b) => a.date.localeCompare(b.date));
  }

  getSummary(now = new Date()): {
    totalPresentDays: number;
    totalAbsentDaysMonth: number;
    averageDailyHours: number;
    month: PeriodSummary;
    cumulativeAheadBehindMs: number; // Cumulative ahead/behind based on working days elapsed
    workingDaysElapsed: number; // Working days elapsed so far this month
  } {
    const list = this.getDailyList();
    const uniqueDates = new Set(list.map(r => r.date));
    const totalPresentDays = uniqueDates.size;

    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthStartKey = toDateKey(monthStart);
    const monthEndKey = toDateKey(monthEnd);
    
    // Calculate working days elapsed so far (up to today, excluding weekends)
    let workingDaysElapsed = 0;
    const currentDate = new Date(monthStart);
    const todayKey = toDateKey(now);
    
    while (currentDate <= now && toDateKey(currentDate) <= todayKey) {
      const dayOfWeek = currentDate.getDay();
      // Count Monday (1) through Friday (5) as working days
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDaysElapsed++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate total working days in the entire month
    let workingDaysInMonth = 0;
    const monthDate = new Date(monthStart);
    while (monthDate <= monthEnd) {
      const dayOfWeek = monthDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDaysInMonth++;
      }
      monthDate.setDate(monthDate.getDate() + 1);
    }

    // Calculate total hours worked in the month (up to today)
    // Include completed days (with totalMs) and today's current progress if checked in
    let monthMs = 0;
    const monthRecords = list.filter(r => within(r.date, monthStartKey, todayKey));
    
    for (const r of monthRecords) {
      if (r.totalMs !== undefined && r.totalMs > 0) {
        // Completed day
        monthMs += r.totalMs;
      } else if (r.date === todayKey && r.checkIn && !r.checkOut) {
        // Today is in progress - calculate current worked time
        monthMs += diffMs(r.checkIn, now.toISOString());
      }
    }
    
    // Cumulative target based on working days elapsed (not full month)
    const dailyTargetMs = this.getDailyTargetMs();
    const cumulativeTargetMs = workingDaysElapsed * dailyTargetMs;
    
    // Cumulative ahead/behind based on working days elapsed
    const cumulativeAheadBehindMs = monthMs - cumulativeTargetMs;
    
    // Full month target (for display purposes)
    const monthTargetMs = workingDaysInMonth * dailyTargetMs;

    const daysElapsedInMonth = Math.min(
      Math.floor((now.getTime() - monthStart.getTime()) / (1000*60*60*24)) + 1,
      monthEnd.getDate()
    );
    const presentThisMonth = new Set(list.filter(r => within(r.date, monthStartKey, todayKey)).map(r => r.date)).size;
    const totalAbsentDaysMonth = Math.max(0, daysElapsedInMonth - presentThisMonth);

    const sumMs = list.reduce((acc, r) => acc + (r.totalMs ?? 0), 0);
    const averageDailyHours = uniqueDates.size ? msToHours(sumMs / uniqueDates.size) : 0;

    const monthSummary: PeriodSummary = {
      period: 'month',
      startDate: monthStartKey,
      endDate: monthEndKey,
      totalMs: monthMs,
      targetMs: monthTargetMs,
      aheadBehindMs: monthMs - monthTargetMs, // Keep for backward compatibility
    };

    return { 
      totalPresentDays, 
      totalAbsentDaysMonth, 
      averageDailyHours, 
      month: monthSummary,
      cumulativeAheadBehindMs,
      workingDaysElapsed
    };
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



