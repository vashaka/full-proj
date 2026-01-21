import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

export class AuthService {
  static async register(username: string, email: string, password: string) {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      username,
      email,
      password,
    });
    
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  }

  static async login(username: string, password: string) {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username,
      password,
    });
    
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  }

  static logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  static getToken(): string | null {
    return localStorage.getItem('token');
  }

  static getUser(): any {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
}

