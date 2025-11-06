import { Component, computed, inject, Inject } from '@angular/core';
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
import { MatSelectModule } from '@angular/material/select';
import { endOfMonth, formatDuration, startOfMonth, toDateKey } from '../../utils/date-utils';
import { MatOptionModule } from '@angular/material/core';

@Component({
  selector: 'attendance-dashboard',
  standalone: true,
  imports: [MatCardModule, MatTableModule, MatIconModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, NgIf, DatePipe, CommonModule, MatOptionModule],
  templateUrl: './attendance-dashboard.component.html',
  styleUrl: './attendance-dashboard.component.scss'
})
export class AttendanceDashboardComponent {
  private readonly service = inject(AttendanceService);
  private readonly dialog = inject(MatDialog);
  protected readonly records = computed(() => this.service.getDailyList());
  protected readonly monthRows = computed(() => {
    const now = new Date();
    const s = startOfMonth(now);
    const e = endOfMonth(now);
    const list = this.service.getDailyList();
    const rows: { dateKey: string; dateLabel: string; totalMs: number; present: boolean; weekend: boolean }[] = [];
    const d = new Date(s);
    while (d <= e) {
      const key = toDateKey(d);
      const rec = list.find(r => r.date === key);
      rows.push({
        dateKey: key,
        dateLabel: d.toDateString(),
        totalMs: rec?.totalMs ?? 0,
        present: !!rec,
        weekend: d.getDay() === 0 || d.getDay() === 6
      });
      d.setDate(d.getDate() + 1);
    }
    return rows;
  });

  protected format(ms?: number): string {
    return formatDuration(ms ?? 0);
  }

  protected edit(row: { date: string; totalMs?: number; checkIn?: string; checkOut?: string }): void {
    const ref = this.dialog.open(EditHoursDialog, {
      data: { date: row.date, totalMs: row.totalMs ?? 0, checkIn: row['checkIn'], checkOut: row['checkOut'] },
      minWidth: '320px'
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
  imports: [MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, FormsModule,CommonModule],
  template: `
  <h2 mat-dialog-title>Edit Times</h2>
  <div mat-dialog-content style="display:flex; gap:12px; align-items:center;">
    <div style="display:flex; gap:8px; align-items:center;">
      <mat-form-field appearance="outline" style="width:110px;">
        <mat-label>Check-in Hour</mat-label>
        <mat-select [(ngModel)]="inHour">
          <mat-option *ngFor="let h of hours" [value]="h">{{ h }}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" style="width:110px;">
        <mat-label>Check-in Min</mat-label>
        <mat-select [(ngModel)]="inMin">
          <mat-option *ngFor="let m of minutes" [value]="m">{{ m }}</mat-option>
        </mat-select>
      </mat-form-field>
    </div>
    <div style="display:flex; gap:8px; align-items:center;">
      <mat-form-field appearance="outline" style="width:110px;">
        <mat-label>Check-out Hour</mat-label>
        <mat-select [(ngModel)]="outHour">
          <mat-option *ngFor="let h of hours" [value]="h">{{ h }}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" style="width:110px;">
        <mat-label>Check-out Min</mat-label>
        <mat-select [(ngModel)]="outMin">
          <mat-option *ngFor="let m of minutes" [value]="m">{{ m }}</mat-option>
        </mat-select>
      </mat-form-field>
    </div>
  </div>
  <div mat-dialog-actions style="justify-content:flex-end; gap:8px;">
    <button mat-stroked-button mat-dialog-close>Cancel</button>
    <button mat-raised-button color="primary" [disabled]="inHour===undefined||inMin===undefined||outHour===undefined||outMin===undefined" [mat-dialog-close]="{checkIn: build(inHour,inMin), checkOut: build(outHour,outMin)}">Save</button>
  </div>
  `
})
class EditHoursDialog {
  hours = Array.from({length:24}, (_,i) => i.toString().padStart(2,'0'));
  minutes = Array.from({length:60}, (_,i) => i.toString().padStart(2,'0'));
  inHour?: string;
  inMin?: string;
  outHour?: string;
  outMin?: string;
  constructor(private ref: MatDialogRef<EditHoursDialog>, @Inject(MAT_DIALOG_DATA) public data: any) {
    const ci = data?.checkIn ? new Date(data.checkIn) : undefined;
    const co = data?.checkOut ? new Date(data.checkOut) : undefined;
    if (ci) { this.inHour = ci.getHours().toString().padStart(2,'0'); this.inMin = ci.getMinutes().toString().padStart(2,'0'); }
    if (co) { this.outHour = co.getHours().toString().padStart(2,'0'); this.outMin = co.getMinutes().toString().padStart(2,'0'); }
  }
  build(h?: string, m?: string) { return `${h ?? '00'}:${m ?? '00'}`; }
}


