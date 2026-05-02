// バー管理システム - 勤怠API
// スタッフの勤怠管理（打刻・集計）に関するAPI呼び出しを定義します

import { apiClient } from './client';
import type { Attendance, AttendanceSummary } from '../types';

// 月次勤怠一覧を取得
export const fetchAttendance = async (year: number, month: number): Promise<Attendance[]> => {
  const response = await apiClient.get<Attendance[]>('/attendance', {
    params: { year, month },
  });
  return response.data;
};

// スタッフ別勤怠を取得
export const fetchAttendanceByStaff = async (
  staffId: number,
  year: number,
  month: number
): Promise<Attendance[]> => {
  const response = await apiClient.get<Attendance[]>(`/attendance/staff/${staffId}`, {
    params: { year, month },
  });
  return response.data;
};

// 出勤打刻（クロックイン）
export const clockIn = async (staffId: number): Promise<Attendance> => {
  const response = await apiClient.post<Attendance>(`/attendance/clock-in/${staffId}`);
  return response.data;
};

// 退勤打刻（クロックアウト）
export const clockOut = async (staffId: number): Promise<Attendance> => {
  const response = await apiClient.post<Attendance>(`/attendance/clock-out/${staffId}`);
  return response.data;
};

// 月次サマリーを取得（スタッフ別集計）
export const fetchMonthlySummary = async (
  year: number,
  month: number
): Promise<AttendanceSummary[]> => {
  const response = await apiClient.get<AttendanceSummary[]>('/attendance/monthly-summary', {
    params: { year, month },
  });
  return response.data;
};

// 月次締め処理
export const monthlyClose = async (year: number, month: number): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/attendance/monthly-close', {
    year,
    month,
  });
  return response.data;
};

// 給与明細PDFダウンロード
export const downloadPayslipPdf = async (
  staffId: number,
  year: number,
  month: number
): Promise<Blob> => {
  const response = await apiClient.post(
    `/attendance/payslip/${staffId}/${year}/${month}/pdf`,
    {},
    { responseType: 'blob' }
  );
  return response.data;
};

// 手動で勤怠記録を修正
export const updateAttendance = async (
  id: number,
  data: { clock_in?: string; clock_out?: string }
): Promise<Attendance> => {
  const response = await apiClient.put<Attendance>(`/attendance/${id}`, data);
  return response.data;
};
