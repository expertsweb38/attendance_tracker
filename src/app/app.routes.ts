import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TodayComponent } from './pages/today/today.component';
import { WeeklyViewComponent } from './pages/weekly-view/weekly-view.component';
import { MonthlyViewComponent } from './pages/monthly-view/monthly-view.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'today', component: TodayComponent },
  { path: 'weekly', component: WeeklyViewComponent },
  { path: 'monthly', component: MonthlyViewComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: '/dashboard' }
];

