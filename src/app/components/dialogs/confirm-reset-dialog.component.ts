import { Component } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-confirm-reset-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="warn">warning</mat-icon>
      Confirm Reset
    </h2>
    <div mat-dialog-content class="dialog-content">
      <p class="warning-text">
        Are you sure you want to reset all attendance records? This action cannot be undone.
      </p>
      <div class="warning-box">
        <mat-icon>info</mat-icon>
        <span>All your attendance data will be permanently deleted.</span>
      </div>
    </div>
    <div mat-dialog-actions class="dialog-actions">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">
        <mat-icon>delete</mat-icon>
        Reset All Data
      </button>
    </div>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      padding: 24px 24px 0 24px;
      font-size: 20px;
      font-weight: 600;
    }

    .dialog-content {
      padding: 20px 24px;
      min-width: 400px;
    }

    .warning-text {
      margin: 0 0 16px 0;
      font-size: 15px;
      line-height: 1.5;
      color: rgba(0, 0, 0, 0.87);
    }

    .warning-box {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: rgba(244, 67, 54, 0.1);
      border-left: 4px solid #f44336;
      border-radius: 6px;
      color: #c62828;
      font-size: 14px;
      
      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .dialog-actions {
      justify-content: flex-end;
      gap: 8px;
      padding: 0 24px 24px 24px;
      margin: 0;
      
      button {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    :host-context(.dark-theme) {
      .warning-text {
        color: rgba(255, 255, 255, 0.87);
      }

      .warning-box {
        background: rgba(244, 67, 54, 0.2);
        border-left-color: #ef5350;
        color: #ef5350;
      }
    }
  `]
})
export class ConfirmResetDialogComponent {
  constructor(public dialogRef: MatDialogRef<ConfirmResetDialogComponent>) {}
}

