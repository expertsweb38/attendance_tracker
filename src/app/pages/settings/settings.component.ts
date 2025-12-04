import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AttendanceService } from '../../services/attendance.service';
import { FormsModule } from '@angular/forms';
import { ConfirmResetDialogComponent } from '../../components/dialogs/confirm-reset-dialog.component';
import { SuccessDialogComponent, SuccessDialogData } from '../../components/dialogs/success-dialog.component';
import { DailyHoursDialogComponent } from '../../components/dialogs/daily-hours-dialog.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    FormsModule
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private readonly service = inject(AttendanceService);
  private readonly dialog = inject(MatDialog);
  
  protected readonly isDarkMode = signal<boolean>(this.loadDarkMode());

  constructor() {
    // Listen to dark mode changes from app component
    const saved = localStorage.getItem('darkMode');
    this.isDarkMode.set(saved === 'true');
  }

  protected toggleDarkMode(): void {
    this.isDarkMode.set(!this.isDarkMode());
    localStorage.setItem('darkMode', this.isDarkMode().toString());
    document.body.classList.toggle('dark-theme', this.isDarkMode());
    // Dispatch event for app component
    window.dispatchEvent(new Event('darkModeChanged'));
  }

  private loadDarkMode(): boolean {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  }

  protected exportData(): void {
    const records = this.service.getDailyList();
    
    if (records.length === 0) {
      this.dialog.open(SuccessDialogComponent, {
        width: '400px',
        data: {
          title: 'No Data',
          message: 'There are no attendance records to export.',
          icon: 'info'
        } as SuccessDialogData
      });
      return;
    }
    
    const csv = this.convertToCSV(records);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    // Show success message
    this.dialog.open(SuccessDialogComponent, {
      width: '400px',
      data: {
        title: 'Export Successful',
        message: `Successfully exported ${records.length} attendance record${records.length !== 1 ? 's' : ''} to CSV file.`,
        icon: 'check_circle'
      } as SuccessDialogData
    });
  }

  private convertToCSV(records: any[]): string {
    const headers = ['Date', 'Check In', 'Check Out', 'Total Hours'];
    const rows = records.map(r => [
      r.date,
      r.checkIn ? new Date(r.checkIn).toLocaleString() : '',
      r.checkOut ? new Date(r.checkOut).toLocaleString() : '',
      r.totalMs ? (r.totalMs / (1000 * 60 * 60)).toFixed(2) : '0'
    ]);
    
    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  protected resetData(): void {
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

  protected openDailyHoursDialog(): void {
    const dialogRef = this.dialog.open(DailyHoursDialogComponent, {
      width: '450px',
      data: {
        currentHours: this.service.getDailyHoursLimit()
      }
    });

    dialogRef.afterClosed().subscribe((result?: { hours: number }) => {
      if (result?.hours) {
        this.service.setDailyHoursLimit(result.hours);
        this.dialog.open(SuccessDialogComponent, {
          width: '400px',
          data: {
            title: 'Settings Saved',
            message: `Daily hours limit updated to ${result.hours} hour${result.hours !== 1 ? 's' : ''}.`,
            icon: 'check_circle'
          } as SuccessDialogData
        });
      }
    });
  }
  
  protected getDailyHoursLimit(): number {
    return this.service.getDailyHoursLimit();
  }
}

