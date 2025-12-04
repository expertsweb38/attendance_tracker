import { Component, computed, inject, AfterViewInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AttendanceService } from '../../services/attendance.service';
import { formatDuration, msToHours, startOfMonth, endOfMonth } from '../../utils/date-utils';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, Chart, registerables } from 'chart.js';
import { AttendanceActionsComponent } from '../../components/attendance-actions/attendance-actions.component';

// Register all Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    BaseChartDirective,
    AttendanceActionsComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements AfterViewInit {
  private readonly service = inject(AttendanceService);
  
  protected readonly summary = computed(() => this.service.getSummary());
  protected readonly todayStatus = computed(() => this.service.getTodayStatus());
  protected readonly records = computed(() => this.service.getDailyList());
  
  // Chart data for weekly hours
  protected weeklyChartData: ChartData<'bar'> = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Hours Worked',
      data: [],
      backgroundColor: 'rgba(100, 181, 246, 0.6)',
      borderColor: 'rgba(100, 181, 246, 1)',
      borderWidth: 2,
      borderRadius: 6
    }]
  };

  protected weeklyChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const hours = context.parsed.y ?? 0;
            const minutes = Math.round((hours - Math.floor(hours)) * 60);
            return `${Math.floor(hours)}h ${minutes}m`;
          }
        }
      }
    },
    scales: {
      y: {
        type: 'linear',
        beginAtZero: true,
        max: 12,
        ticks: {
          callback: (value) => `${value}h`
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        type: 'category',
        grid: {
          display: false
        }
      }
    }
  };

  protected monthlyChartData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      label: 'Daily Hours',
      data: [],
      borderColor: 'rgba(100, 181, 246, 1)',
      backgroundColor: 'rgba(100, 181, 246, 0.1)',
      tension: 0.4,
      fill: true,
      pointRadius: 4,
      pointHoverRadius: 6
    }, {
      label: `Target (${this.service.getDailyHoursLimit()}h)`,
      data: [],
      borderColor: 'rgba(76, 175, 80, 0.5)',
      borderDash: [5, 5],
      pointRadius: 0
    }]
  };

  protected monthlyChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const hours = context.parsed.y ?? 0;
            const minutes = Math.round((hours - Math.floor(hours)) * 60);
            return `${context.dataset.label}: ${Math.floor(hours)}h ${minutes}m`;
          }
        }
      }
    },
    scales: {
      y: {
        type: 'linear',
        beginAtZero: true,
        max: 12,
        ticks: {
          callback: (value) => `${value}h`
        }
      },
      x: {
        type: 'category'
      }
    }
  };

  constructor() {
    // Update charts when component initializes
    setTimeout(() => this.updateCharts(), 0);
    
    // React to changes in attendance records
    effect(() => {
      // Read the records signal to make this effect reactive
      this.records();
      // Update charts whenever records change
      setTimeout(() => this.updateCharts(), 0);
    });
  }
  
  ngAfterViewInit(): void {
    // Update charts after view initialization
    this.updateCharts();
  }

  private updateCharts(): void {
    const records = this.service.getDailyList();
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    const dailyHoursLimit = this.service.getDailyHoursLimit();
    
    // Weekly data
    const weeklyData: number[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateKey = this.toDateKey(date);
      const record = records.find(r => r.date === dateKey);
      const hours = record?.totalMs ? msToHours(record.totalMs) : 0;
      weeklyData.push(hours);
    }
    
    this.weeklyChartData = {
      ...this.weeklyChartData,
      datasets: [{
        ...this.weeklyChartData.datasets[0],
        data: weeklyData
      }]
    };

    // Monthly data (current month)
    const monthlyLabels: string[] = [];
    const monthlyData: number[] = [];
    const targetData: number[] = [];
    
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    // Iterate through all days of the current month
    const currentDate = new Date(monthStart);
    while (currentDate <= monthEnd) {
      const dateKey = this.toDateKey(currentDate);
      const record = records.find(r => r.date === dateKey);
      const hours = record?.totalMs ? msToHours(record.totalMs) : 0;
      
      monthlyLabels.push(currentDate.getDate().toString());
      monthlyData.push(hours);
      targetData.push(dailyHoursLimit); // Dynamic hour target
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    this.monthlyChartData = {
      labels: monthlyLabels,
      datasets: [{
        ...this.monthlyChartData.datasets[0],
        data: monthlyData
      }, {
        ...this.monthlyChartData.datasets[1],
        label: `Target (${dailyHoursLimit}h)`,
        data: targetData
      }]
    };
  }

  private toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  protected format(ms: number): string {
    return formatDuration(ms);
  }

  protected sign(ms: number): string {
    return ms >= 0 ? 'Ahead' : 'Behind';
  }

  protected abs(ms: number): number {
    return Math.abs(ms);
  }

  protected getStatusIcon(aheadBehindMs: number): string {
    return aheadBehindMs >= 0 ? 'trending_up' : 'trending_down';
  }

  protected getCumulativeStatus(): {
    aheadBehindMs: number;
    workingDaysElapsed: number;
    cumulativeTargetMs: number;
  } {
    const summary = this.summary();
    const dailyTargetMs = this.service.getDailyHoursLimit() * 60 * 60 * 1000;
    return {
      aheadBehindMs: summary.cumulativeAheadBehindMs,
      workingDaysElapsed: summary.workingDaysElapsed,
      cumulativeTargetMs: summary.workingDaysElapsed * dailyTargetMs
    };
  }
}

