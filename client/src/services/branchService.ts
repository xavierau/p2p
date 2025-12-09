import api from '@/lib/api';

export interface Branch {
  id: string;
  name: string;
}

const getBranches = async (): Promise<Branch[]> => {
  const response = await api.get('/branches');
  return response.data;
};

const createBranch = async (branchData: Omit<Branch, 'id'>): Promise<Branch> => {
  const response = await api.post('/branches', branchData);
  return response.data;
};

export const branchService = {
  getBranches,
  createBranch,
};
