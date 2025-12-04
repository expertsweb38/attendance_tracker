import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { AttendanceService } from '../../services/attendance.service';
import { AttendanceDashboardComponent } from '../../components/attendance-dashboard/attendance-dashboard.component';

@Component({
  selector: 'app-monthly-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    AttendanceDashboardComponent
  ],
  templateUrl: './monthly-view.component.html',
  styleUrl: './monthly-view.component.scss'
})
export class MonthlyViewComponent {
  // This component wraps the existing dashboard component
}

