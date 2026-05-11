import client from './client';
import type { StaffDrink } from '../types';

export const fetchStaffDrinks = async (sessionId: number): Promise<StaffDrink[]> => {
  const { data } = await client.get('/staff_drinks/', { params: { session_id: sessionId } });
  return data;
};

export const createStaffDrink = async (payload: {
  session_id: number;
  staff_id: number;
  product_id?: number;
  qty: number;
  note?: string;
}): Promise<StaffDrink> => {
  const { data } = await client.post('/staff_drinks/', payload);
  return data;
};

export const deleteStaffDrink = async (id: number): Promise<void> => {
  await client.delete(`/staff_drinks/${id}`);
};
