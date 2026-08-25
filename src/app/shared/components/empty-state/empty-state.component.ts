import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule],
  template: '<div class="empty"><mat-icon>{{ icon() }}</mat-icon><p>{{ title() }}</p></div>',
  styles: ['.empty { text-align:center; color:#6a7a96; padding: 1.5rem; } mat-icon { font-size:2rem; width:2rem; height:2rem; } p { margin:0.5rem 0 0;}']
})
export class EmptyStateComponent {
  title = input.required<string>();
  icon = input<string>('inbox');
}
