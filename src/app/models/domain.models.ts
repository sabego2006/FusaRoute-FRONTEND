export interface Route {
  id: string;
  name: string;
  geoJson: string;
  neighborhoods: string[];
  fare: number;
  status: 'active' | 'suspended';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface AuthResponse {
  token: string;
  user: User;
}
