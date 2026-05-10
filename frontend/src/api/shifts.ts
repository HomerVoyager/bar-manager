import { apiClient } from './client';
import type { Shift } from '../types';

export const fetchShifts = async (dateFrom: string, dateTo: string, staffId?: number): Promise<Shift[]> => {
  const response = await apiClient.get<Shift[]>('/shifts/', {
    params: { date_from: dateFrom, date_to: dateTo, staff_id: staffId },
  });
  return response.data;
};

export const createShift = async (data: {
  staff_id: number;
  date: string;
  start_time: string;
  end_time: string;
  note?: string;
}): Promise<Shift> => {
  const response = await apiClient.post<Shift>('/shifts/', data);
  return response.data;
};

export const updateShift = async (id: number, data: {
  start_time?: string;
  end_time?: string;
  note?: string;
}): Promise<Shift> => {
  const response = await apiClient.put<Shift>(`/shifts/${id}`, data);
  return response.data;
};

export const deleteShift = async (id: number): Promise<void> => {
  await apiClient.delete(`/shifts/${id}`);
};
