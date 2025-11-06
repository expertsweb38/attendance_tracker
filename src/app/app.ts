import { Component, signal } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { AttendanceActionsComponent } from './components/attendance-actions/attendance-actions.component';
import { AttendanceDashboardComponent } from './components/attendance-dashboard/attendance-dashboard.component';
import { AttendanceSummaryComponent } from './components/attendance-summary/attendance-summary.component';

@Component({
  selector: 'app-root',
  imports: [MatToolbarModule, MatDividerModule, AttendanceActionsComponent, AttendanceDashboardComponent, AttendanceSummaryComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('attendance-tracker');
}
