import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface SuccessDialogData {
  title: string;
  message: string;
  icon?: string;
}

@Component({
  selector: 'app-success-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon [color]="data.icon === 'error' ? 'warn' : 'primary'">{{ data.icon || 'check_circle' }}</mat-icon>
      {{ data.title }}
    </h2>
    <div mat-dialog-content class="dialog-content">
      <p>{{ data.message }}</p>
    </div>
    <div mat-dialog-actions class="dialog-actions">
      <button mat-raised-button color="primary" mat-dialog-close>OK</button>
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
      min-width: 300px;
      
      p {
        margin: 0;
        font-size: 15px;
        line-height: 1.5;
        color: rgba(0, 0, 0, 0.87);
      }
    }

    .dialog-actions {
      justify-content: flex-end;
      padding: 0 24px 24px 24px;
      margin: 0;
    }

    :host-context(.dark-theme) {
      .dialog-content p {
        color: rgba(255, 255, 255, 0.87);
      }
    }
  `]
})
export class SuccessDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<SuccessDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SuccessDialogData
  ) {}
}

