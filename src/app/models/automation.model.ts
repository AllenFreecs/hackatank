export interface Automation {
  id: number;
  name: string;
  trigger: string;
  action: string;
  frequency: string;
  recipient: string;
  status: 'Active' | 'Draft' | 'Disabled';
}
