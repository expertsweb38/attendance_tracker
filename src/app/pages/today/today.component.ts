import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AttendanceService } from '../../services/attendance.service';
import { formatDurationHMS, formatDuration } from '../../utils/date-utils';
import { AdjustTimeDialogComponent, AdjustTimeDialogData } from '../../components/dialogs/adjust-time-dialog.component';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './today.component.html',
  styleUrl: './today.component.scss'
})
export class TodayComponent {
  private readonly service = inject(AttendanceService);
  private readonly dialog = inject(MatDialog);
  private readonly now = signal<Date>(new Date());
  
  protected readonly status = computed(() => this.service.getTodayStatus(this.now()));
  
  protected getDailyTargetMs(): number {
    return this.service.getDailyHoursLimit() * 60 * 60 * 1000;
  }
  
  protected getDailyHoursLimit(): number {
    return this.service.getDailyHoursLimit();
  }
  
  constructor() {
    setInterval(() => {
      this.now.set(new Date());
    }, 1000);
  }

  protected formatHMS(ms: number): string {
    return formatDurationHMS(ms);
  }

  protected format(ms: number): string {
    return formatDuration(ms);
  }

  protected checkIn(): void {
    this.service.checkIn();
  }

  protected checkOut(): void {
    this.service.checkOut();
  }

  protected adjustCheckIn(): void {
    const todayKey = this.toDateKey(new Date());
    const current = this.service.getTodayStatus();
    const defaultTime = current.checkInTime ? new Date(current.checkInTime) : new Date();
    const defaultHHMM = `${defaultTime.getHours().toString().padStart(2,'0')}:${defaultTime.getMinutes().toString().padStart(2,'0')}`;
    
    const dialogRef = this.dialog.open(AdjustTimeDialogComponent, {
      width: '400px',
      data: {
        title: 'Adjust Check-in Time',
        defaultTime: defaultHHMM,
        label: 'Check-in Time'
      } as AdjustTimeDialogData
    });

    dialogRef.afterClosed().subscribe((result?: { time: string }) => {
      if (result?.time) {
        this.service.setCheckInByClock(todayKey, result.time);
        this.now.set(new Date());
      }
    });
  }

  private toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  protected getProgress(): number {
    const worked = this.status().workedMs;
    const target = this.getDailyTargetMs();
    return Math.min(100, (worked / target) * 100);
  }

  protected getRemainingMs(): number {
    const worked = this.status().workedMs;
    const target = this.getDailyTargetMs();
    const remaining = target - worked;
    return Math.max(0, remaining);
  }

  protected abs(ms: number): number {
    return Math.abs(ms);
  }

  protected getCumulativeStatus(): {
    aheadBehindMs: number;
    workingDaysElapsed: number;
  } {
    const summary = this.service.getSummary();
    return {
      aheadBehindMs: summary.cumulativeAheadBehindMs,
      workingDaysElapsed: summary.workingDaysElapsed
    };
  }
}

