import api from '@/lib/api';

export interface Department {
  id: string;
  name: string;
}

const getDepartments = async (): Promise<Department[]> => {
  const response = await api.get('/departments');
  return response.data;
};

const createDepartment = async (departmentData: Omit<Department, 'id'>): Promise<Department> => {
  const response = await api.post('/departments', departmentData);
  return response.data;
};

export const departmentService = {
  getDepartments,
  createDepartment,
};
