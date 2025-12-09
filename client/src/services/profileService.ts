import api from '@/lib/api';

export interface Profile {
  id: string;
  name: string;
  email: string;
}

const getProfile = async (): Promise<Profile> => {
  const response = await api.get('/profile');
  return response.data;
};

const updateProfile = async (profileData: Omit<Profile, 'id' | 'email'>): Promise<Profile> => {
  const response = await api.put('/profile', profileData);
  return response.data;
};

export const profileService = {
  getProfile,
  updateProfile,
};
