export interface Route {
  id: string;
  name: string;
  description: string;
  fare: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  neighborhoods: string[];
}
