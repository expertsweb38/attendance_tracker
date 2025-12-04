import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

export interface DailyHoursDialogData {
  currentHours: number;
}

@Component({
  selector: 'app-daily-hours-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    FormsModule,
    CommonModule
  ],
  template: `
    <div class="dialog-header">
      <mat-icon class="header-icon">schedule</mat-icon>
      <h2 mat-dialog-title>Set Daily Hours Limit</h2>
    </div>
    <div mat-dialog-content class="dialog-content">
      <div class="hours-input-wrapper">
        <mat-form-field appearance="outline" class="hours-field">
          <mat-label>Daily Hours Limit</mat-label>
          <input 
            matInput 
            type="number"
            [(ngModel)]="hours" 
            [value]="hours"
            min="1"
            max="24"
            step="0.5"
            placeholder="Enter hours"
            required>
          <mat-hint>Set your daily work hours requirement (1-24 hours)</mat-hint>
        </mat-form-field>
      </div>
      <div class="current-hours-display" *ngIf="hours && isValidHours()">
        <mat-icon>check_circle</mat-icon>
        <span>Daily target set to: <strong>{{ hours }} hour{{ hours !== 1 ? 's' : '' }}</strong></span>
      </div>
      <div class="info-note">
        <mat-icon>info</mat-icon>
        <div>
          This value is used to calculate ahead/behind hours and monthly targets. Changes apply immediately to all calculations.
        </div>
      </div>
    </div>
    <div mat-dialog-actions class="dialog-actions">
      <button mat-stroked-button mat-dialog-close>
        <mat-icon>close</mat-icon>
        Cancel
      </button>
      <button mat-raised-button color="primary" [disabled]="!isValidHours()" (click)="save()">
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
      padding: 24px;
      min-width: 380px;
    }

    .hours-input-wrapper {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
    }

    .input-icon {
      margin-top: 8px;
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: #1976d2;
      opacity: 0.7;
    }

    .hours-field {
      flex: 1;
    }

    .hours-field ::ng-deep .mat-mdc-text-field-wrapper {
      background-color: #f5f7fa;
    }

    .current-hours-display {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(25, 118, 210, 0.05) 100%);
      border-radius: 6px;
      border-left: 3px solid #1976d2;
      font-size: 14px;
      color: #1e3a5f;
      margin-bottom: 16px;
      
      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #4caf50;
      }
      
      strong {
        font-size: 16px;
        color: #1976d2;
        font-weight: 600;
      }
    }

    .info-note {
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

    input[type="number"] {
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

      .hours-field ::ng-deep .mat-mdc-text-field-wrapper {
        background-color: rgba(255, 255, 255, 0.05);
      }

      .current-hours-display {
        background: linear-gradient(135deg, rgba(100, 181, 246, 0.15) 0%, rgba(100, 181, 246, 0.08) 100%);
        border-left-color: #64b5f6;
        color: #e0e0e0;
        
        strong {
          color: #64b5f6;
        }
      }

      .info-note {
        background: linear-gradient(135deg, rgba(100, 181, 246, 0.15) 0%, rgba(100, 181, 246, 0.08) 100%);
        border-left-color: #64b5f6;
        color: #64b5f6;
      }

      .dialog-actions {
        border-top-color: rgba(255, 255, 255, 0.1);
      }
    }
  `]
})
export class DailyHoursDialogComponent {
  hours: number = 9;

  constructor(
    public dialogRef: MatDialogRef<DailyHoursDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DailyHoursDialogData
  ) {
    this.hours = data.currentHours || 9;
  }

  isValidHours(): boolean {
    return this.hours > 0 && this.hours <= 24;
  }

  save(): void {
    if (this.isValidHours()) {
      this.dialogRef.close({ hours: this.hours });
    }
  }
}

