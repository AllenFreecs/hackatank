import { Routes } from '@angular/router';
import { ActivityComponent } from './features/activity/activity.component';
import { AssistantComponent } from './features/assistant/assistant.component';
import { AutomationsComponent } from './features/automations/automations.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { KnowledgeComponent } from './features/knowledge/knowledge.component';
import { ReportsComponent } from './features/reports/reports.component';
import { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'assistant', component: AssistantComponent },
  { path: 'reports', component: ReportsComponent },
  { path: 'knowledge', component: KnowledgeComponent },
  { path: 'automations', component: AutomationsComponent },
  { path: 'activity', component: ActivityComponent },
  { path: 'settings', component: SettingsComponent }
];
