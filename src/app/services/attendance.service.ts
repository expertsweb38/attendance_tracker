import { Injectable, signal } from '@angular/core';
import { AttendanceRecord, MonthlyAbsentSummary, PeriodSummary } from '../models/attendance.model';
import { combineDateKeyAndTime, diffMs, endOfMonth, endOfYear, formatDuration, msToHours, parseDateKey, startOfMonth, startOfYear, toDateKey, within } from '../utils/date-utils';

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
      // Check if today is a working day
      const dayOfWeek = now.getDay();
      const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5;
      
      // If it's a working day and past 6 PM, consider it absent (not just not checked in)
      // Otherwise, if it's a working day, show as behind (not checked in yet)
      const hours = now.getHours();
      const isLikelyAbsent = isWorkingDay && hours >= 18; // After 6 PM, likely absent
      
      if (isLikelyAbsent || !isWorkingDay) {
        // Absent day or weekend - don't show as behind
        return { 
          checkedIn: false, 
          workedMs: 0, 
          formatted: '00:00',
          aheadBehindMs: 0,
          aheadBehindFormatted: '00:00'
        };
      }
      
      // Working day, not checked in yet - show as behind
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
   * @returns ahead/behind in milliseconds (positive = ahead, negative = behind). Returns 0 for absent days.
   */
  getDailyAheadBehind(dateKey: string): number {
    const rec = this.findByDate(dateKey);
    
    // If no record exists, it's an absent day - return 0 (not behind)
    if (!rec) {
      return 0;
    }
    
    const DAILY_TARGET_MS = this.getDailyTargetMs();
    const workedMs = rec?.totalMs ?? 0;
    return workedMs - DAILY_TARGET_MS;
  }

  getDailyList(): AttendanceRecord[] {
    return [...this.recordsSignal()].sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculate absent days for a specific year
   */
  getYearlyAbsents(year: number, now = new Date()): number {
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 11, 31));
    const yearStartKey = toDateKey(yearStart);
    const yearEndKey = toDateKey(yearEnd);
    const todayKey = toDateKey(now);
    
    // Only count up to today if we're in the current year
    const endKey = year === now.getFullYear() ? todayKey : yearEndKey;
    
    const list = this.getDailyList();
    const presentDates = new Set(list.filter(r => within(r.date, yearStartKey, endKey)).map(r => r.date));
    
    // Count working days in the year (up to today if current year)
    let workingDaysInYear = 0;
    const checkDate = new Date(yearStart);
    const endDate = year === now.getFullYear() ? now : yearEnd;
    
    while (checkDate <= endDate && toDateKey(checkDate) <= endKey) {
      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDaysInYear++;
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }
    
    // Count present working days
    let presentWorkingDays = 0;
    const presentCheckDate = new Date(yearStart);
    while (presentCheckDate <= endDate && toDateKey(presentCheckDate) <= endKey) {
      const dayOfWeek = presentCheckDate.getDay();
      const dateKey = toDateKey(presentCheckDate);
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && presentDates.has(dateKey)) {
        presentWorkingDays++;
      }
      presentCheckDate.setDate(presentCheckDate.getDate() + 1);
    }
    
    return Math.max(0, workingDaysInYear - presentWorkingDays);
  }

  /**
   * Get monthly absent breakdown for the current year
   */
  getMonthlyAbsentsBreakdown(now = new Date()): MonthlyAbsentSummary[] {
    const currentYear = now.getFullYear();
    const months: MonthlyAbsentSummary[] = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    const list = this.getDailyList();
    const todayKey = toDateKey(now);
    
    for (let month = 0; month < 12; month++) {
      const monthStart = startOfMonth(new Date(currentYear, month, 1));
      const monthEnd = endOfMonth(new Date(currentYear, month, 1));
      const monthStartKey = toDateKey(monthStart);
      const monthEndKey = toDateKey(monthEnd);
      
      // Only count up to today if we're in the current month
      const endKey = month === now.getMonth() && currentYear === now.getFullYear() ? todayKey : monthEndKey;
      const endDate = month === now.getMonth() && currentYear === now.getFullYear() ? now : monthEnd;
      
      const presentDates = new Set(list.filter(r => within(r.date, monthStartKey, endKey)).map(r => r.date));
      
      // Count working days in the month
      let workingDays = 0;
      const checkDate = new Date(monthStart);
      while (checkDate <= endDate && toDateKey(checkDate) <= endKey) {
        const dayOfWeek = checkDate.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          workingDays++;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }
      
      // Count present working days
      let presentWorkingDays = 0;
      const presentCheckDate = new Date(monthStart);
      while (presentCheckDate <= endDate && toDateKey(presentCheckDate) <= endKey) {
        const dayOfWeek = presentCheckDate.getDay();
        const dateKey = toDateKey(presentCheckDate);
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && presentDates.has(dateKey)) {
          presentWorkingDays++;
        }
        presentCheckDate.setDate(presentCheckDate.getDate() + 1);
      }
      
      const absentDays = Math.max(0, workingDays - presentWorkingDays);
      
      months.push({
        month,
        monthName: monthNames[month],
        year: currentYear,
        absentDays,
        workingDays
      });
    }
    
    return months;
  }

  getSummary(now = new Date()): {
    totalPresentDays: number;
    totalAbsentDaysMonth: number;
    totalAbsentDaysYear: number;
    monthlyAbsents: MonthlyAbsentSummary[];
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
    
    // Track which dates have records (present days)
    const presentDates = new Set(monthRecords.map(r => r.date));
    
    for (const r of monthRecords) {
      if (r.totalMs !== undefined && r.totalMs > 0) {
        // Completed day
        monthMs += r.totalMs;
      } else if (r.date === todayKey && r.checkIn && !r.checkOut) {
        // Today is in progress - calculate current worked time
        monthMs += diffMs(r.checkIn, now.toISOString());
      }
    }
    
    // Count only present working days (excluding absent days and weekends)
    let presentWorkingDays = 0;
    const checkDate = new Date(monthStart);
    while (checkDate <= now && toDateKey(checkDate) <= todayKey) {
      const dayOfWeek = checkDate.getDay();
      const dateKey = toDateKey(checkDate);
      // Count only working days (Mon-Fri) where person was present
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && presentDates.has(dateKey)) {
        presentWorkingDays++;
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }
    
    // Cumulative target based on present working days only (not all working days)
    const dailyTargetMs = this.getDailyTargetMs();
    const cumulativeTargetMs = presentWorkingDays * dailyTargetMs;
    
    // Cumulative ahead/behind based on present working days only
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

    // Calculate month target based on present working days only (up to today)
    // For full month display, we still use all working days, but for ahead/behind calculation, use present days
    const monthTargetBasedOnPresentDays = presentWorkingDays * dailyTargetMs;
    const monthAheadBehindMs = monthMs - monthTargetBasedOnPresentDays;

    const monthSummary: PeriodSummary = {
      period: 'month',
      startDate: monthStartKey,
      endDate: monthEndKey,
      totalMs: monthMs,
      targetMs: monthTargetMs, // Keep full month target for display
      aheadBehindMs: monthAheadBehindMs, // Calculate based on present working days only
    };

    // Calculate yearly absents
    const currentYear = now.getFullYear();
    const totalAbsentDaysYear = this.getYearlyAbsents(currentYear, now);
    
    // Get monthly absents breakdown
    const monthlyAbsents = this.getMonthlyAbsentsBreakdown(now);

    return { 
      totalPresentDays, 
      totalAbsentDaysMonth, 
      totalAbsentDaysYear,
      monthlyAbsents,
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



