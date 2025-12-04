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
  period: 'month';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalMs: number;
  targetMs: number; // 9h per working day in month
  aheadBehindMs: number; // totalMs - targetMs
}

export interface MonthlyAbsentSummary {
  month: number; // 0-11 (0 = January)
  monthName: string; // e.g., "January"
  year: number;
  absentDays: number;
  workingDays: number;
}


