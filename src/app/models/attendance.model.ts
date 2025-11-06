export interface AttendanceRecord {
  /** YYYY-MM-DD for check-in date */
  date: string;
  /** ISO string for check-in datetime */
  checkIn: string;
  /** ISO string for checkout datetime, if checked out */
  checkOut?: string;
  /** Total milliseconds worked for this date once checked out */
  totalMs?: number;
}

export interface PeriodSummary {
  period: 'week' | 'month';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalMs: number;
  targetMs: number; // 8h per elapsed day in period
  aheadBehindMs: number; // totalMs - targetMs
}


