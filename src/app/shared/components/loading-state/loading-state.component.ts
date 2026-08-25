import { Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: '<div class="loading"><mat-spinner diameter="28"></mat-spinner><span>{{ message() }}</span></div>',
  styles: ['.loading { display:flex; align-items:center; gap: 0.75rem; color:#5b6d8a; }']
})
export class LoadingStateComponent {
  message = input<string>('Working on it...');
}
