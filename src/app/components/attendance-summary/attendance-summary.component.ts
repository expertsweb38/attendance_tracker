import { Component, computed, inject } from '@angular/core';
import { AttendanceService } from '../../services/attendance.service';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { formatDuration, msToHours } from '../../utils/date-utils';

@Component({
  selector: 'attendance-summary',
  standalone: true,
  imports: [MatCardModule, MatIconModule, DecimalPipe, NgFor, NgIf],
  templateUrl: './attendance-summary.component.html',
  styleUrl: './attendance-summary.component.scss'
})
export class AttendanceSummaryComponent {
  private readonly service = inject(AttendanceService);
  protected readonly summary = computed(() => this.service.getSummary());
  protected readonly getCurrentMonth = () => new Date().getMonth();
  protected readonly getCurrentYear = () => new Date().getFullYear();

  protected format(ms: number): string { return formatDuration(ms); }
  protected sign(ms: number): string { return ms >= 0 ? 'Ahead' : 'Behind'; }
  protected abs(ms: number): number { return Math.abs(ms); }
}


