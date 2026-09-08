export interface Automation {
  id: number;
  name: string;
  trigger?: string;
  action?: string;
  frequency: string;
  recipient?: string;
  automationType?: 'File Creation' | 'Email Creation';
  fileType?: 'excel' | 'word' | 'pdf';
  outputPath?: string;
  aiQuery?: string;
  status: 'Enabled' | 'Disabled' | 'Active' | 'Draft';
}
