import api from '@/lib/api';

// Type definitions
export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface RegisterResponse {
  message: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

/**
 * Login with email and password.
 * Returns access token in response body, refresh token is set as httpOnly cookie.
 */
const login = async (data: LoginData): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', data);
  return response.data;
};

/**
 * Register a new user account.
 */
const register = async (data: RegisterData): Promise<RegisterResponse> => {
  const response = await api.post<RegisterResponse>('/auth/register', data);
  return response.data;
};

/**
 * Request password reset email.
 */
const forgotPassword = async (data: ForgotPasswordData): Promise<ForgotPasswordResponse> => {
  const response = await api.post<ForgotPasswordResponse>('/auth/forgot-password', data);
  return response.data;
};

/**
 * Refresh access token using the httpOnly refresh token cookie.
 * Returns new access token in response body, new refresh token is set as httpOnly cookie.
 */
const refresh = async (): Promise<RefreshResponse> => {
  const response = await api.post<RefreshResponse>('/auth/refresh');
  return response.data;
};

/**
 * Logout and invalidate refresh token.
 * Clears the httpOnly cookie on server side.
 */
const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const authService = {
  login,
  register,
  forgotPassword,
  refresh,
  logout,
};
