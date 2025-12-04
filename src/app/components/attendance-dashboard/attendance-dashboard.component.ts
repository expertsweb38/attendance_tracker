import { Component, computed, inject, Inject, signal } from '@angular/core';
import { AttendanceService } from '../../services/attendance.service';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { NgIf, DatePipe, CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MatOptionModule } from '@angular/material/core';
import { endOfMonth, formatDuration, startOfMonth, toDateKey } from '../../utils/date-utils';

@Component({
  selector: 'attendance-dashboard',
  standalone: true,
  imports: [MatCardModule, MatTableModule, MatIconModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule, NgIf, DatePipe, CommonModule],
  templateUrl: './attendance-dashboard.component.html',
  styleUrl: './attendance-dashboard.component.scss'
})
export class AttendanceDashboardComponent {
  private readonly service = inject(AttendanceService);
  private readonly dialog = inject(MatDialog);
  protected readonly selectedMonth = signal<Date>(new Date());
  protected readonly records = computed(() => this.service.getDailyList());
  protected readonly monthRows = computed(() => {
    const selected = this.selectedMonth();
    const s = startOfMonth(selected);
    const e = endOfMonth(selected);
    const list = this.service.getDailyList();
    const rows: { 
      dateKey: string; 
      dateLabel: string; 
      totalMs: number; 
      present: boolean; 
      weekend: boolean;
      aheadBehindMs: number;
    }[] = [];
    const d = new Date(s);
    while (d <= e) {
      const key = toDateKey(d);
      const rec = list.find(r => r.date === key);
      const aheadBehindMs = this.service.getDailyAheadBehind(key);
      rows.push({
        dateKey: key,
        dateLabel: d.toDateString(),
        totalMs: rec?.totalMs ?? 0,
        present: !!rec,
        weekend: d.getDay() === 0 || d.getDay() === 6,
        aheadBehindMs: aheadBehindMs
      });
      d.setDate(d.getDate() + 1);
    }
    return rows;
  });

  protected getMonthLabel(): string {
    const date = this.selectedMonth();
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  protected previousMonth(): void {
    const current = this.selectedMonth();
    const newDate = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    this.selectedMonth.set(newDate);
  }

  protected nextMonth(): void {
    const current = this.selectedMonth();
    const newDate = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    this.selectedMonth.set(newDate);
  }

  protected goToCurrentMonth(): void {
    this.selectedMonth.set(new Date());
  }

  protected format(ms?: number): string {
    return formatDuration(ms ?? 0);
  }

  protected getAheadBehindLabel(ms: number): string {
    return ms >= 0 ? 'Ahead' : 'Behind';
  }

  protected getAheadBehindClass(ms: number): string {
    if (ms >= 0) return 'ahead';
    return 'behind';
  }

  protected abs(ms: number): number {
    return Math.abs(ms);
  }

  protected edit(row: { date: string; totalMs?: number; checkIn?: string; checkOut?: string }): void {
    // Get the full record to access checkIn and checkOut
    const fullRecord = this.service.getDailyList().find(r => r.date === row.date);
    const ref = this.dialog.open(EditHoursDialog, {
      data: { 
        date: row.date, 
        totalMs: row.totalMs ?? 0, 
        checkIn: fullRecord?.checkIn, 
        checkOut: fullRecord?.checkOut 
      },
      minWidth: '360px',
      width: '400px'
    });
    ref.afterClosed().subscribe((result?: { checkIn: string; checkOut: string; }) => {
      if (!result) return;
      this.service.setTimesByClock(row.date, result.checkIn, result.checkOut);
    });
  }
}

@Component({
  selector: 'edit-hours-dialog',
  standalone: true,
  imports: [MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule, CommonModule, NgIf],
  template: `
  <div class="dialog-header">
    <mat-icon class="header-icon">edit_calendar</mat-icon>
    <h2 mat-dialog-title>Edit Attendance Times</h2>
  </div>
  <div mat-dialog-content class="dialog-content">
    <div class="time-input-group">
      <div class="time-input-wrapper">
        <mat-icon class="input-icon">login</mat-icon>
        <mat-form-field appearance="outline" class="time-field">
          <mat-label>Check-in Time</mat-label>
          <input 
            matInput 
            type="time"
            [(ngModel)]="checkInTime" 
            [value]="checkInTime"
            placeholder="HH:MM"
            required>
          <mat-hint>Select check-in time</mat-hint>
        </mat-form-field>
      </div>
      
      <div class="time-separator">
        <mat-icon>arrow_downward</mat-icon>
      </div>
      
      <div class="time-input-wrapper">
        <mat-icon class="input-icon">logout</mat-icon>
        <mat-form-field appearance="outline" class="time-field">
          <mat-label>Check-out Time</mat-label>
          <input 
            matInput 
            type="time"
            [(ngModel)]="checkOutTime" 
            [value]="checkOutTime"
            placeholder="HH:MM"
            required>
          <mat-hint *ngIf="isNextDay()" class="next-day-hint">
            <mat-icon>schedule</mat-icon>
            Check-out will be on the next day
          </mat-hint>
          <mat-hint *ngIf="!isNextDay()">Select check-out time</mat-hint>
        </mat-form-field>
      </div>
    </div>
    
    <div *ngIf="isNextDay()" class="next-day-note">
      <mat-icon>info</mat-icon>
      <div>
        <strong>Note:</strong> When checkout time is earlier than check-in time, the system automatically treats it as the next day (e.g., Check-in: 16:00, Check-out: 01:00 = next day checkout).
      </div>
    </div>
    
    <div class="time-summary" *ngIf="checkInTime && checkOutTime">
      <div class="summary-item">
        <mat-icon>schedule</mat-icon>
        <span>Duration: <strong>{{ getDuration() }}</strong></span>
      </div>
    </div>
  </div>
  <div mat-dialog-actions class="dialog-actions">
    <button mat-stroked-button mat-dialog-close>
      <mat-icon>close</mat-icon>
      Cancel
    </button>
    <button mat-raised-button color="primary" [disabled]="!isValid()" (click)="save()">
      <mat-icon>check</mat-icon>
      Save Changes
    </button>
  </div>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px 24px 16px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .header-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #1976d2;
    }

    h2[mat-dialog-title] {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      color: #1e3a5f;
      flex: 1;
    }

    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 24px;
      min-width: 400px;
    }

    .time-input-group {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .time-input-wrapper {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .input-icon {
      margin-top: 8px;
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: #1976d2;
      opacity: 0.7;
    }

    .time-field {
      flex: 1;
    }

    .time-field ::ng-deep .mat-mdc-text-field-wrapper {
      background-color: #f5f7fa;
    }

    .time-separator {
      display: flex;
      justify-content: center;
      padding: 8px 0;
      
      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #1976d2;
        opacity: 0.5;
      }
    }

    .next-day-hint {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #1976d2;
      font-weight: 500;
      
      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .next-day-note {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(25, 118, 210, 0.05) 100%);
      border-radius: 6px;
      border-left: 3px solid #1976d2;
      font-size: 0.875rem;
      color: #1565c0;
      line-height: 1.5;
      
      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #1976d2;
        margin-top: 2px;
        flex-shrink: 0;
      }
    }

    .time-summary {
      padding: 12px 16px;
      background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%);
      border-radius: 6px;
      border-left: 3px solid #4caf50;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #2e7d32;
      
      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #4caf50;
      }
      
      strong {
        font-size: 16px;
        font-weight: 600;
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px 24px 24px;
      margin: 0;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
    }

    .dialog-actions button {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 120px;
    }

    input[type="time"] {
      font-size: 18px;
      padding: 12px;
      font-weight: 500;
    }

    :host-context(.dark-theme) {
      .dialog-header {
        border-bottom-color: rgba(255, 255, 255, 0.1);
      }

      h2[mat-dialog-title] {
        color: #e0e0e0;
      }

      .time-field ::ng-deep .mat-mdc-text-field-wrapper {
        background-color: rgba(255, 255, 255, 0.05);
      }

      .next-day-note {
        background: linear-gradient(135deg, rgba(100, 181, 246, 0.15) 0%, rgba(100, 181, 246, 0.08) 100%);
        border-left-color: #64b5f6;
        color: #64b5f6;
      }

      .time-summary {
        background: linear-gradient(135deg, rgba(129, 199, 132, 0.15) 0%, rgba(129, 199, 132, 0.08) 100%);
        border-left-color: #81c784;
      }

      .summary-item {
        color: #81c784;
      }

      .dialog-actions {
        border-top-color: rgba(255, 255, 255, 0.1);
      }
    }
  `]
})
class EditHoursDialog {
  checkInTime: string = '';
  checkOutTime: string = '';
  dateKey: string = '';
  
  constructor(private ref: MatDialogRef<EditHoursDialog>, @Inject(MAT_DIALOG_DATA) public data: any) {
    this.dateKey = data?.date || '';
    const ci = data?.checkIn ? new Date(data.checkIn) : undefined;
    const co = data?.checkOut ? new Date(data.checkOut) : undefined;
    
    if (ci) {
      this.checkInTime = `${ci.getHours().toString().padStart(2,'0')}:${ci.getMinutes().toString().padStart(2,'0')}`;
    } else {
      this.checkInTime = '09:00';
    }
    
    if (co) {
      const checkOutDate = new Date(co);
      this.checkOutTime = `${checkOutDate.getHours().toString().padStart(2,'0')}:${checkOutDate.getMinutes().toString().padStart(2,'0')}`;
    } else {
      this.checkOutTime = '18:00';
    }
  }
  
  isNextDay(): boolean {
    if (!this.checkInTime || !this.checkOutTime) return false;
    const [ciH, ciM] = this.checkInTime.split(':').map(Number);
    const [coH, coM] = this.checkOutTime.split(':').map(Number);
    const checkInMinutes = ciH * 60 + ciM;
    const checkOutMinutes = coH * 60 + coM;
    // If checkout time is earlier than check-in time, it's next day
    // Also check if the difference suggests next day (more than 12 hours earlier)
    return checkOutMinutes < checkInMinutes && (checkInMinutes - checkOutMinutes) > 12 * 60;
  }
  
  isValid(): boolean {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(this.checkInTime) && timeRegex.test(this.checkOutTime);
  }
  
  getDuration(): string {
    if (!this.checkInTime || !this.checkOutTime) return '';
    
    const [ciH, ciM] = this.checkInTime.split(':').map(Number);
    const [coH, coM] = this.checkOutTime.split(':').map(Number);
    
    let checkInMinutes = ciH * 60 + ciM;
    let checkOutMinutes = coH * 60 + coM;
    
    // Handle next day checkout
    if (checkOutMinutes < checkInMinutes) {
      checkOutMinutes += 24 * 60; // Add 24 hours
    }
    
    const totalMinutes = checkOutMinutes - checkInMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  }
  
  save(): void {
    if (this.isValid()) {
      this.ref.close({ checkIn: this.checkInTime, checkOut: this.checkOutTime });
    }
  }
}


