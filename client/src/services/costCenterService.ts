import api from '@/lib/api';

export interface CostCenter {
  id: string;
  name: string;
}

const getCostCenters = async (): Promise<CostCenter[]> => {
  const response = await api.get('/cost-centers');
  return response.data;
};

const createCostCenter = async (costCenterData: Omit<CostCenter, 'id'>): Promise<CostCenter> => {
  const response = await api.post('/cost-centers', costCenterData);
  return response.data;
};

export const costCenterService = {
  getCostCenters,
  createCostCenter,
};
