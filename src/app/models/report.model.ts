export interface Report {
  id: number;
  name: string;
  status: 'Ready' | 'Pending' | 'Generating';
  lastGenerated: string;
  owner: string;
}
