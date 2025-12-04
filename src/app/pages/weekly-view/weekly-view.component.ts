import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { AttendanceService } from '../../services/attendance.service';
import { formatDuration, startOfWeek, endOfWeek, toDateKey } from '../../utils/date-utils';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-weekly-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatDialogModule
  ],
  templateUrl: './weekly-view.component.html',
  styleUrl: './weekly-view.component.scss'
})
export class WeeklyViewComponent {
  private readonly service = inject(AttendanceService);
  protected readonly selectedWeek = signal<Date>(new Date());
  
  protected readonly weekData = computed(() => {
    const weekStart = startOfWeek(this.selectedWeek());
    const weekEnd = endOfWeek(this.selectedWeek());
    const records = this.service.getDailyList();
    
    const days: {
      date: Date;
      dateKey: string;
      dayName: string;
      totalMs: number;
      present: boolean;
      aheadBehindMs: number;
    }[] = [];
    
    const currentDate = new Date(weekStart);
    while (currentDate <= weekEnd) {
      const dateKey = toDateKey(currentDate);
      const record = records.find(r => r.date === dateKey);
      const aheadBehindMs = this.service.getDailyAheadBehind(dateKey);
      
      days.push({
        date: new Date(currentDate),
        dateKey,
        dayName: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
        totalMs: record?.totalMs ?? 0,
        present: !!record,
        aheadBehindMs
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  });

  protected readonly weekSummary = computed(() => {
    const days = this.weekData();
    const totalMs = days.reduce((sum, day) => sum + day.totalMs, 0);
    const dailyTargetMs = this.service.getDailyHoursLimit() * 60 * 60 * 1000;
    const targetMs = days.length * dailyTargetMs;
    const aheadBehindMs = totalMs - targetMs;
    const presentDays = days.filter(d => d.present).length;
    
    return {
      totalMs,
      targetMs,
      aheadBehindMs,
      presentDays,
      totalDays: days.length
    };
  });

  constructor() {}

  protected format(ms: number): string {
    return formatDuration(ms);
  }

  protected previousWeek(): void {
    const current = this.selectedWeek();
    const newDate = new Date(current);
    newDate.setDate(current.getDate() - 7);
    this.selectedWeek.set(newDate);
  }

  protected nextWeek(): void {
    const current = this.selectedWeek();
    const newDate = new Date(current);
    newDate.setDate(current.getDate() + 7);
    this.selectedWeek.set(newDate);
  }

  protected goToCurrentWeek(): void {
    this.selectedWeek.set(new Date());
  }

  protected getWeekLabel(): string {
    const weekStart = startOfWeek(this.selectedWeek());
    const weekEnd = endOfWeek(this.selectedWeek());
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  protected editDay(day: any): void {
    // Use the edit dialog from dashboard component
    // For now, just show a simple implementation
  }

  protected abs(ms: number): number {
    return Math.abs(ms);
  }
}

