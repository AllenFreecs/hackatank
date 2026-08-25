export interface Task {
  id: number;
  department: string;
  title: string;
  status: 'Pending' | 'Completed';
  owner: string;
  dueDate: string;
  category: string;
}
