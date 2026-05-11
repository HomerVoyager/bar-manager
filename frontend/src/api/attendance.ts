// バー管理システム - 勤怠API
// スタッフの勤怠管理（打刻・集計）に関するAPI呼び出しを定義します

import { apiClient } from './client';
import type { Attendance, AttendanceSummary } from '../types';

// 本日の勤怠一覧を取得
export const fetchTodayAttendance = async (): Promise<Attendance[]> => {
  const response = await apiClient.get<Attendance[]>('/attendance/today');
  return response.data;
};

// 月次勤怠一覧を取得
export const fetchAttendance = async (year: number, month: number): Promise<Attendance[]> => {
  const response = await apiClient.get<Attendance[]>('/attendance/', {
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
  const response = await apiClient.get<Attendance[]>('/attendance/', {
    params: { staff_id: staffId, year, month },
  });
  return response.data;
};

// 出勤打刻（クロックイン）
export const clockIn = async (staffId: number): Promise<Attendance> => {
  const response = await apiClient.post<Attendance>('/attendance/clock-in', { staff_id: staffId });
  return response.data;
};

// 退勤打刻（クロックアウト）
export const clockOut = async (staffId: number): Promise<Attendance> => {
  const response = await apiClient.post<Attendance>('/attendance/clock-out', { staff_id: staffId });
  return response.data;
};

// 休憩開始打刻
export const breakStart = async (staffId: number): Promise<Attendance> => {
  const response = await apiClient.post<Attendance>('/attendance/break-start', { staff_id: staffId });
  return response.data;
};

// 休憩終了打刻
export const breakEnd = async (staffId: number): Promise<Attendance> => {
  const response = await apiClient.post<Attendance>('/attendance/break-end', { staff_id: staffId });
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

// スタッフ別月次詳細を取得
export const fetchMonthlyDetail = async (
  staffId: number,
  year: number,
  month: number
): Promise<AttendanceSummary & { daily_details: DailyDetail[]; base_pay: number; night_premium: number; overtime_premium: number; drink_back_total: number; total_overtime_minutes: number; hourly_wage?: number }> => {
  const response = await apiClient.get(`/attendance/monthly-detail/${staffId}`, {
    params: { year, month },
  });
  return response.data;
};

export interface DailyDetail {
  date: string;
  attendance_id: number;
  clock_in?: string;
  clock_out?: string;
  break_minutes: number;
  work_minutes: number;
  night_minutes: number;
  overtime_minutes: number;
  base_pay: number;
  night_premium: number;
  overtime_premium: number;
  drink_back: number;
  yobiback: number;
  daily_total: number;
  is_late?: boolean;
  is_early_leave?: boolean;
  absence_type?: string | null;
}

// 月次締め処理
export const monthlyClose = async (year: number, month: number): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/attendance/monthly-close', null, {
    params: { year, month },
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
  data: { clock_in?: string; clock_out?: string; break_minutes?: number }
): Promise<Attendance> => {
  const response = await apiClient.put<Attendance>(`/attendance/${id}`, data);
  return response.data;
};

// 欠勤・有給・特休を登録
export const registerAbsence = async (
  staffId: number,
  date: string,
  absenceType: string,
  note?: string
): Promise<Attendance> => {
  const response = await apiClient.post<Attendance>('/attendance/absence', {
    staff_id: staffId,
    date,
    absence_type: absenceType,
    note,
  });
  return response.data;
};

// 欠勤・有給登録を削除
export const deleteAbsence = async (attendanceId: number): Promise<void> => {
  await apiClient.delete(`/attendance/absence/${attendanceId}`);
};
