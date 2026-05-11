// バー管理システム - スタッフ管理ページ（マネージャー専用）
// スタッフの追加・編集・無効化を管理します

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { UserPlus, Edit2, UserX, UserCheck, RefreshCw, Users } from 'lucide-react';
import { fetchStaff, createStaff, updateStaff, deactivateStaff, activateStaff } from '../api/staff';
import Modal from '../components/Modal';
import AlertBadge from '../components/AlertBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Staff, CreateStaffForm } from '../types';

// 日本円フォーマット
const formatYen = (amount: number): string => `¥${amount.toLocaleString('ja-JP')}`;

const StaffPage: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const queryClient = useQueryClient();

  // スタッフ一覧の取得
  const { data: staffList, isLoading } = useQuery<Staff[]>({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });

  // 新規スタッフ作成フォーム
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: createErrors },
  } = useForm<CreateStaffForm>();

  // スタッフ編集フォーム
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm<Partial<CreateStaffForm>>();

  // スタッフ作成ミューテーション
  const createMutation = useMutation({
    mutationFn: createStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setIsCreateModalOpen(false);
      resetCreate();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(`スタッフの作成に失敗しました: ${error?.response?.data?.detail ?? '不明なエラー'}`);
    },
  });

  // スタッフ更新ミューテーション
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateStaffForm> }) =>
      updateStaff(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setEditingStaff(null);
      resetEdit();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(`スタッフ情報の更新に失敗しました: ${error?.response?.data?.detail ?? '不明なエラー'}`);
    },
  });

  // スタッフ無効化ミューテーション
  const deactivateMutation = useMutation({
    mutationFn: deactivateStaff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
    onError: () => alert('スタッフの無効化に失敗しました。'),
  });

  // スタッフ有効化ミューテーション
  const activateMutation = useMutation({
    mutationFn: activateStaff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
    onError: () => alert('スタッフの有効化に失敗しました。'),
  });

  // 編集モーダルを開く
  const handleEditOpen = (staff: Staff) => {
    setEditingStaff(staff);
    resetEdit({
      name: staff.name,
      role: staff.role,
      hourly_wage: staff.hourly_wage,
      drink_back_rate: staff.drink_back_rate,
    });
  };

  // 無効化確認
  const handleDeactivate = (staff: Staff) => {
    if (window.confirm(`${staff.name}を無効化しますか？\nログインできなくなります。`)) {
      deactivateMutation.mutate(staff.id);
    }
  };

  // 有効化確認
  const handleActivate = (staff: Staff) => {
    if (window.confirm(`${staff.name}を有効化しますか？`)) {
      activateMutation.mutate(staff.id);
    }
  };

  // スタッフ作成の送信
  const onCreateSubmit = (data: CreateStaffForm) => {
    createMutation.mutate({
      ...data,
      hourly_wage: Number(data.hourly_wage),
      drink_back_rate: Number(data.drink_back_rate),
    });
  };

  // スタッフ編集の送信
  const onEditSubmit = (data: Partial<CreateStaffForm>) => {
    if (!editingStaff) return;
    const updateData: Partial<CreateStaffForm> = {
      name: data.name,
      role: data.role,
      hourly_wage: data.hourly_wage ? Number(data.hourly_wage) : undefined,
      drink_back_rate: data.drink_back_rate !== undefined ? Number(data.drink_back_rate) : undefined,
    };
    // パスワードは入力された場合のみ送信（空欄はバリデーションエラーになるため除外）
    if (data.password) updateData.password = data.password;
    updateMutation.mutate({ id: editingStaff.id, data: updateData });
  };

  // スタッフ数の集計
  const activeCount = staffList?.filter((s) => s.is_active).length ?? 0;
  const managerCount = staffList?.filter((s) => s.role === 'manager' && s.is_active).length ?? 0;

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">スタッフ管理</h2>
          <p className="text-gray-400 text-sm mt-1">スタッフの登録・編集・権限管理</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors text-sm"
        >
          <UserPlus className="w-4 h-4" />
          スタッフ追加
        </button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-900/50 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-gray-400 text-xs">有効スタッフ数</p>
            <p className="text-white text-xl font-bold">{activeCount}名</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-900/50 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-gray-400 text-xs">マネージャー数</p>
            <p className="text-white text-xl font-bold">{managerCount}名</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-700/50 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <p className="text-gray-400 text-xs">総スタッフ数</p>
            <p className="text-white text-xl font-bold">{staffList?.length ?? 0}名</p>
          </div>
        </div>
      </div>

      {/* スタッフ一覧テーブル */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        {isLoading ? (
          <LoadingSpinner message="スタッフデータを読み込み中..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 px-5 py-3 font-medium">スタッフ名</th>
                  <th className="text-center text-gray-400 px-5 py-3 font-medium">ロール</th>
                  <th className="text-right text-gray-400 px-5 py-3 font-medium">時給</th>
                  <th className="text-right text-gray-400 px-5 py-3 font-medium">バック率</th>
                  <th className="text-center text-gray-400 px-5 py-3 font-medium">状態</th>
                  <th className="text-left text-gray-400 px-5 py-3 font-medium">登録日</th>
                  <th className="text-center text-gray-400 px-5 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {staffList?.map((staff) => (
                  <tr
                    key={staff.id}
                    className={`hover:bg-gray-700/30 transition-colors ${!staff.is_active ? 'opacity-50' : ''}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          staff.is_active ? 'bg-amber-700' : 'bg-gray-700'
                        }`}>
                          <span className="text-white text-sm font-medium">
                            {staff.name.charAt(0)}
                          </span>
                        </div>
                        <span className="text-white font-medium">{staff.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <AlertBadge
                        label={staff.role === 'manager' ? 'マネージャー' : 'スタッフ'}
                        variant={staff.role === 'manager' ? 'info' : 'neutral'}
                      />
                    </td>
                    <td className="px-5 py-3 text-right text-amber-400 font-medium">
                      {formatYen(staff.hourly_wage)}/時
                    </td>
                    <td className="px-5 py-3 text-right text-indigo-400 font-medium">
                      {staff.drink_back_rate}%
                    </td>
                    <td className="px-5 py-3 text-center">
                      <AlertBadge
                        label={staff.is_active ? '有効' : '無効'}
                        variant={staff.is_active ? 'success' : 'neutral'}
                      />
                    </td>
                    <td className="px-5 py-3 text-gray-400">
                      {new Date(staff.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {/* 編集ボタン */}
                        <button
                          onClick={() => handleEditOpen(staff)}
                          className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                          title="編集"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {/* 有効/無効化ボタン */}
                        {staff.is_active ? (
                          <button
                            onClick={() => handleDeactivate(staff)}
                            disabled={deactivateMutation.isPending}
                            className="p-1.5 rounded-lg bg-red-900/40 hover:bg-red-700/40 text-red-400 transition-colors"
                            title="無効化"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(staff)}
                            disabled={activateMutation.isPending}
                            className="p-1.5 rounded-lg bg-green-900/40 hover:bg-green-700/40 text-green-400 transition-colors"
                            title="有効化"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!staffList || staffList.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                      スタッフが登録されていません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* スタッフ追加モーダル */}
      {isCreateModalOpen && (
        <Modal
          title="スタッフ追加"
          onClose={() => { setIsCreateModalOpen(false); resetCreate(); }}
          size="medium"
          footer={
            <>
              <button
                onClick={() => { setIsCreateModalOpen(false); resetCreate(); }}
                className="px-4 py-2 text-gray-400 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmitCreate(onCreateSubmit)}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white rounded-lg text-sm transition-colors"
              >
                {createMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                追加する
              </button>
            </>
          }
        >
          <form className="space-y-4">
            {/* 名前 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">氏名</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: 田中 太郎"
                {...registerCreate('name', { required: '氏名を入力してください' })}
              />
              {createErrors.name && (
                <p className="mt-1 text-xs text-red-400">{createErrors.name.message}</p>
              )}
            </div>

            {/* ロール */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">ロール</label>
              <select
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                {...registerCreate('role', { required: 'ロールを選択してください' })}
              >
                <option value="">選択してください</option>
                <option value="staff">スタッフ</option>
                <option value="manager">マネージャー</option>
              </select>
              {createErrors.role && (
                <p className="mt-1 text-xs text-red-400">{createErrors.role.message}</p>
              )}
            </div>

            {/* 時給 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">時給（円）</label>
              <input
                type="number"
                min="1000"
                max="5000"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: 1200"
                {...registerCreate('hourly_wage', {
                  required: '時給を入力してください',
                  min: { value: 1000, message: '1000円以上で入力してください' },
                })}
              />
              {createErrors.hourly_wage && (
                <p className="mt-1 text-xs text-red-400">{createErrors.hourly_wage.message}</p>
              )}
            </div>

            {/* ドリンクバック率 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">ドリンクバック率（%）</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: 10"
                defaultValue={0}
                {...registerCreate('drink_back_rate', {
                  min: { value: 0, message: '0以上で入力してください' },
                  max: { value: 100, message: '100以下で入力してください' },
                })}
              />
              {createErrors.drink_back_rate && (
                <p className="mt-1 text-xs text-red-400">{createErrors.drink_back_rate.message}</p>
              )}
            </div>

            {/* パスワード */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">初期パスワード</label>
              <input
                type="password"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="6文字以上"
                {...registerCreate('password', {
                  required: 'パスワードを入力してください',
                  minLength: { value: 6, message: '6文字以上で入力してください' },
                })}
              />
              {createErrors.password && (
                <p className="mt-1 text-xs text-red-400">{createErrors.password.message}</p>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* スタッフ編集モーダル */}
      {editingStaff && (
        <Modal
          title={`${editingStaff.name} - 編集`}
          onClose={() => { setEditingStaff(null); resetEdit(); }}
          size="medium"
          footer={
            <>
              <button
                onClick={() => { setEditingStaff(null); resetEdit(); }}
                className="px-4 py-2 text-gray-400 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmitEdit(onEditSubmit)}
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white rounded-lg text-sm transition-colors"
              >
                {updateMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                更新する
              </button>
            </>
          }
        >
          <form className="space-y-4">
            {/* 名前 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">氏名</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                {...registerEdit('name', { required: '氏名を入力してください' })}
              />
              {editErrors.name && (
                <p className="mt-1 text-xs text-red-400">{editErrors.name.message}</p>
              )}
            </div>

            {/* ロール */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">ロール</label>
              <select
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                {...registerEdit('role')}
              >
                <option value="staff">スタッフ</option>
                <option value="manager">マネージャー</option>
              </select>
            </div>

            {/* 時給 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">時給（円）</label>
              <input
                type="number"
                min="1000"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                {...registerEdit('hourly_wage', {
                  min: { value: 1000, message: '1000円以上で入力してください' },
                })}
              />
              {editErrors.hourly_wage && (
                <p className="mt-1 text-xs text-red-400">{editErrors.hourly_wage.message}</p>
              )}
            </div>

            {/* ドリンクバック率 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">ドリンクバック率（%）</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                {...registerEdit('drink_back_rate', {
                  min: { value: 0, message: '0以上で入力してください' },
                  max: { value: 100, message: '100以下で入力してください' },
                })}
              />
              {editErrors.drink_back_rate && (
                <p className="mt-1 text-xs text-red-400">{editErrors.drink_back_rate.message}</p>
              )}
            </div>

            {/* 新しいパスワード（任意） */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                新しいパスワード（変更する場合のみ）
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="変更しない場合は空欄"
                {...registerEdit('password', {
                  minLength: { value: 6, message: '6文字以上で入力してください' },
                })}
              />
              {editErrors.password && (
                <p className="mt-1 text-xs text-red-400">{editErrors.password.message}</p>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default StaffPage;
