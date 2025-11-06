import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { NgIf, DatePipe, CommonModule } from '@angular/common';
import { AttendanceService } from '../../services/attendance.service';
import { formatDurationHMS } from '../../utils/date-utils';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { } from '@angular/common';

@Component({
  selector: 'attendance-actions',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, FormsModule, NgIf, DatePipe],
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

  protected checkIn(): void { this.service.checkIn(); }
  protected checkOut(): void { this.service.checkOut(); }
  protected reset(): void { this.service.reset(); }

  protected adjustCheckIn(): void {
    const todayKey = toDateKey(new Date());
    const current = this.service.getTodayStatus();
    const defaultTime = current.checkInTime ? new Date(current.checkInTime) : new Date();
    const defaultHHMM = `${defaultTime.getHours().toString().padStart(2,'0')}:${defaultTime.getMinutes().toString().padStart(2,'0')}`;
    const ref = this.dialog.open(AdjustCheckInDialog, { data: { hhmm: defaultHHMM } });
    ref.afterClosed().subscribe((val?: { hhmm: string }) => {
      if (!val?.hhmm) return;
      this.service.setCheckInByClock(todayKey, val.hhmm);
      // Force timer recompute immediately
      this.now.set(new Date());
    });
  }
}

import { toDateKey } from '../../utils/date-utils';
import { MatOptionModule } from '@angular/material/core';

@Component({
  selector: 'adjust-checkin-dialog',
  standalone: true,
  imports: [MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, FormsModule, CommonModule, MatOptionModule],
  template: `
  <h2 mat-dialog-title>Adjust Today's Check-in</h2>
  <div mat-dialog-content style="display:flex; gap:8px; align-items:center;">
    <mat-form-field appearance="outline" style="width:120px;">
      <mat-label>Hour</mat-label>
      <mat-select [(ngModel)]="hour">
        <mat-option *ngFor="let h of hours" [value]="h">{{ h }}</mat-option>
      </mat-select>
    </mat-form-field>
    <mat-form-field appearance="outline" style="width:120px;">
      <mat-label>Minute</mat-label>
      <mat-select [(ngModel)]="minute">
        <mat-option *ngFor="let m of minutes" [value]="m">{{ m }}</mat-option>
      </mat-select>
    </mat-form-field>
  </div>
  <div mat-dialog-actions style="justify-content:flex-end; gap:8px;">
    <button mat-stroked-button mat-dialog-close>Cancel</button>
    <button mat-raised-button color="primary" [disabled]="hour===undefined||minute===undefined" [mat-dialog-close]="{hhmm: build(hour, minute)}">Save</button>
  </div>
  `
})
class AdjustCheckInDialog {
  hours = Array.from({length:24}, (_,i) => i.toString().padStart(2,'0'));
  minutes = Array.from({length:60}, (_,i) => i.toString().padStart(2,'0'));
  hour?: string;
  minute?: string;
  constructor(public dialogRef: MatDialogRef<AdjustCheckInDialog>) {}
  build(h?: string, m?: string) { return `${h ?? '00'}:${m ?? '00'}`; }
}


