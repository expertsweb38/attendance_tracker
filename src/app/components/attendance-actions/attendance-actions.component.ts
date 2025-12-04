import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { NgIf, DatePipe, CommonModule } from '@angular/common';
import { AttendanceService } from '../../services/attendance.service';
import { formatDurationHMS } from '../../utils/date-utils';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmResetDialogComponent } from '../dialogs/confirm-reset-dialog.component';
import { SuccessDialogComponent, SuccessDialogData } from '../dialogs/success-dialog.component';
import { AdjustTimeDialogComponent, AdjustTimeDialogData } from '../dialogs/adjust-time-dialog.component';

@Component({
  selector: 'attendance-actions',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatDialogModule, CommonModule, NgIf, DatePipe],
  templateUrl: './attendance-actions.component.html',
  styleUrl: './attendance-actions.component.scss'
})
export class AttendanceActionsComponent implements OnDestroy {
  private readonly service = inject(AttendanceService);
  private readonly dialog = inject(MatDialog);

  private readonly now = signal<Date>(new Date());
  private timerId: any;

  constructor() {
    this.timerId = setInterval(() => {
      this.now.set(new Date());
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId) clearInterval(this.timerId);
  }

  protected readonly status = computed(() => this.service.getTodayStatus(this.now()));

  protected formatHMS(ms: number): string { return formatDurationHMS(ms); }
  
  protected getDailyHoursLimit(): number {
    return this.service.getDailyHoursLimit();
  }

  protected checkIn(): void { this.service.checkIn(); }
  protected checkOut(): void { this.service.checkOut(); }
  protected reset(): void {
    const confirmRef = this.dialog.open(ConfirmResetDialogComponent, {
      width: '450px',
      disableClose: true
    });
    
    confirmRef.afterClosed().subscribe((confirmed?: boolean) => {
      if (confirmed) {
        this.service.reset();
        this.dialog.open(SuccessDialogComponent, {
          width: '400px',
          data: {
            title: 'Reset Successful',
            message: 'All attendance records have been reset successfully.',
            icon: 'check_circle'
          } as SuccessDialogData
        });
      }
    });
  }

  protected adjustCheckIn(): void {
    const todayKey = toDateKey(new Date());
    const current = this.service.getTodayStatus();
    const defaultTime = current.checkInTime ? new Date(current.checkInTime) : new Date();
    const defaultHHMM = `${defaultTime.getHours().toString().padStart(2,'0')}:${defaultTime.getMinutes().toString().padStart(2,'0')}`;
    
    const dialogRef = this.dialog.open(AdjustTimeDialogComponent, {
      width: '400px',
      disableClose: false,
      hasBackdrop: true,
      panelClass: 'time-picker-dialog',
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
}

import { toDateKey } from '../../utils/date-utils';



