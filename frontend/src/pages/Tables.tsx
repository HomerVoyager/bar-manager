// バー管理システム - 卓管理ページ
// テーブルのリアルタイム状態管理・注文・会計を行います

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { format, differenceInMinutes } from 'date-fns';
import {
  Grid,
  Plus,
  RefreshCw,
  Users,
  Clock,
  ShoppingCart,
  X,
  Receipt,
  Pencil,
  Trash2,
  Settings,
} from 'lucide-react';
import { fetchTables, createTable, updateTable, deleteTable } from '../api/tables';
import { fetchProducts } from '../api/products';
import { fetchStaff } from '../api/staff';
import {
  openSession,
  closeSession,
  addOrderItem,
  removeOrderItem,
} from '../api/sessions';
import Modal from '../components/Modal';
import AlertBadge from '../components/AlertBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { useWebSocket } from '../hooks/useWebSocket';
import type {
  Table,
  Product,
  Staff,
  Session,
  OrderItem,
  OpenSessionForm,
  AddOrderItemForm,
} from '../types';

// 日本円フォーマット
const formatYen = (amount: number): string => `¥${amount.toLocaleString('ja-JP')}`;

// 経過時間を表示形式に変換
const formatElapsed = (startedAt: string): string => {
  const minutes = differenceInMinutes(new Date(), new Date(startedAt));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}時間${m}分`;
  return `${m}分`;
};

// テーブルカードのスタイル設定
const tableCardStyles = {
  empty: 'bg-green-900/20 border-green-700 hover:bg-green-900/30',
  occupied: 'bg-red-900/20 border-red-700 hover:bg-red-900/30',
  reserved: 'bg-yellow-900/20 border-yellow-700 hover:bg-yellow-900/30',
};

type TableForm = { name: string; capacity: number };

const Tables: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isOpenSessionModal, setIsOpenSessionModal] = useState(false);
  const [isSessionDetailModal, setIsSessionDetailModal] = useState(false);
  const [isTableMasterModal, setIsTableMasterModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [splitCount, setSplitCount] = useState<number>(2);
  const queryClient = useQueryClient();

  // WebSocketリアルタイム更新
  const { lastMessage, isConnected } = useWebSocket();

  // テーブル一覧の取得
  const { data: fetchedTables, isLoading, refetch } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: fetchTables,
    refetchInterval: 60000,
  });

  // 商品一覧の取得
  const { data: products } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  // スタッフ一覧の取得
  const { data: staffList } = useQuery<Staff[]>({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });

  // テーブルデータの同期
  useEffect(() => {
    if (fetchedTables) setTables(fetchedTables);
  }, [fetchedTables]);

  // WebSocketからのテーブル更新を反映
  useEffect(() => {
    if (lastMessage?.type === 'table_update' && Array.isArray(lastMessage.data)) {
      setTables(lastMessage.data as Table[]);
      // 選択中のテーブルも更新
      if (selectedTable) {
        const updated = (lastMessage.data as Table[]).find((t) => t.id === selectedTable.id);
        if (updated) setSelectedTable(updated);
      }
    }
  }, [lastMessage, selectedTable]);

  // 開卓フォーム
  const {
    register: registerOpen,
    handleSubmit: handleSubmitOpen,
    reset: resetOpen,
    watch: watchOpen,
    formState: { errors: openErrors },
  } = useForm<Omit<OpenSessionForm, 'table_id'>>({ defaultValues: { plan_type: 'tanpin' } });

  const selectedPlan = watchOpen('plan_type');

  // テーブルマスタフォーム
  const {
    register: registerTable,
    handleSubmit: handleSubmitTable,
    reset: resetTable,
    setValue: setValueTable,
    formState: { errors: tableErrors },
  } = useForm<TableForm>();

  // テーブル作成ミューテーション
  const createTableMutation = useMutation({
    mutationFn: (data: TableForm) => createTable({ name: data.name, capacity: Number(data.capacity) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setIsTableMasterModal(false);
      resetTable();
      refetch();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } } };
      alert(e?.response?.data?.detail ?? 'テーブルの登録に失敗しました。');
    },
  });

  // テーブル更新ミューテーション
  const updateTableMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TableForm }) =>
      updateTable(id, { name: data.name, capacity: Number(data.capacity) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setIsTableMasterModal(false);
      setEditingTable(null);
      resetTable();
      refetch();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } } };
      alert(e?.response?.data?.detail ?? 'テーブルの更新に失敗しました。');
    },
  });

  // テーブル削除ミューテーション
  const deleteTableMutation = useMutation({
    mutationFn: deleteTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      refetch();
    },
    onError: () => alert('テーブルの削除に失敗しました。'),
  });

  const onTableSubmit = (data: TableForm) => {
    if (editingTable) {
      updateTableMutation.mutate({ id: editingTable.id, data });
    } else {
      createTableMutation.mutate(data);
    }
  };

  const openEditTable = (table: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTable(table);
    setValueTable('name', table.name);
    setValueTable('capacity', table.capacity);
    setIsTableMasterModal(true);
  };

  const openAddTable = () => {
    setEditingTable(null);
    resetTable();
    setIsTableMasterModal(true);
  };

  // 注文追加フォーム
  const {
    register: registerOrder,
    handleSubmit: handleSubmitOrder,
    reset: resetOrder,
    watch: watchOrder,
    formState: { errors: orderErrors },
  } = useForm<Omit<AddOrderItemForm, 'session_id'>>();

  const selectedProductId = watchOrder('product_id');
  const selectedProduct = products?.find((p) => p.id === Number(selectedProductId));

  // セッション開始ミューテーション
  const openSessionMutation = useMutation({
    mutationFn: (data: OpenSessionForm) => openSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsOpenSessionModal(false);
      setSelectedTable(null);
      resetOpen();
      refetch();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } } };
      alert(e?.response?.data?.detail ?? '卓の開設に失敗しました。');
    },
  });

  // 会計（セッション終了）ミューテーション
  const closeSessionMutation = useMutation({
    mutationFn: (sessionId: number) => closeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsSessionDetailModal(false);
      setSelectedTable(null);
      refetch();
    },
    onError: () => alert('会計処理に失敗しました。'),
  });

  // 注文アイテム追加ミューテーション
  const addOrderMutation = useMutation({
    mutationFn: (data: AddOrderItemForm) => addOrderItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      refetch().then((result) => {
        if (result.data && selectedTable) {
          const updated = result.data.find((t) => t.id === selectedTable.id);
          if (updated) setSelectedTable(updated);
        }
      });
      resetOrder();
    },
    onError: () => alert('注文の追加に失敗しました。'),
  });

  // 注文アイテム削除ミューテーション
  const removeOrderMutation = useMutation({
    mutationFn: ({ sessionId, itemId }: { sessionId: number; itemId: number }) =>
      removeOrderItem({ sessionId, itemId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      refetch().then((result) => {
        if (result.data && selectedTable) {
          const updated = result.data.find((t) => t.id === selectedTable.id);
          if (updated) setSelectedTable(updated);
        }
      });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } } };
      alert(e?.response?.data?.detail ?? '注文の削除に失敗しました。');
    },
  });

  // テーブルカードクリック処理
  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
    if (table.status === 'empty') {
      setIsOpenSessionModal(true);
    } else if (table.status === 'occupied') {
      setIsSessionDetailModal(true);
    }
  };

  // 開卓処理
  const onOpenSubmit = (data: Omit<OpenSessionForm, 'table_id'>) => {
    if (!selectedTable) return;
    openSessionMutation.mutate({
      table_id: selectedTable.id,
      staff_id: Number(data.staff_id),
      guest_count: Number(data.guest_count),
      plan_type: data.plan_type,
      time_limit_minutes: data.plan_type === 'nomi_hodai' ? Number(data.time_limit_minutes) : undefined,
    });
  };

  // 注文追加処理
  const onAddOrderSubmit = (data: Omit<AddOrderItemForm, 'session_id'>) => {
    if (!selectedTable?.current_session) return;
    addOrderMutation.mutate({
      session_id: selectedTable.current_session.id,
      product_id: Number(data.product_id),
      qty: Number(data.qty),
    });
  };

  // 会計処理
  const handleCloseSession = () => {
    if (!selectedTable?.current_session) return;
    const total = selectedTable.current_session.total;
    if (window.confirm(`${selectedTable.name}を会計しますか？\n合計: ${formatYen(total)}`)) {
      closeSessionMutation.mutate(selectedTable.current_session.id);
    }
  };

  // 割り勘計算
  const splitAmount = selectedTable?.current_session
    ? Math.ceil(selectedTable.current_session.total / splitCount)
    : 0;

  if (isLoading) {
    return <LoadingSpinner size="large" message="卓情報を読み込み中..." />;
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">卓管理</h2>
          <p className="text-gray-400 text-sm mt-1">テーブルの状態管理・注文・会計</p>
        </div>
        <div className="flex items-center gap-3">
          {/* WebSocket接続状態 */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {isConnected ? 'リアルタイム' : '切断中'}
          </div>
          <button
            onClick={openAddTable}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            テーブル追加
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </button>
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-700/50 border border-green-600 inline-block" />
          空き
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-700/50 border border-red-600 inline-block" />
          使用中
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-yellow-700/50 border border-yellow-600 inline-block" />
          予約中
        </span>
      </div>

      {/* テーブルグリッド */}
      {tables.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {tables.map((table) => (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`
                rounded-xl border-2 p-4 text-left transition-all
                ${tableCardStyles[table.status]}
                ${table.status === 'empty' ? 'cursor-pointer' : 'cursor-pointer'}
              `}
            >
              {/* テーブル名 */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-semibold text-sm">{table.name}</span>
                <div className="flex items-center gap-1">
                  {table.status === 'occupied' && (
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  )}
                  {table.status === 'empty' && (
                    <>
                      <button
                        onClick={(e) => openEditTable(table, e)}
                        className="p-1 text-gray-500 hover:text-indigo-400 rounded transition-colors"
                        title="編集"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`「${table.name}」を削除しますか？`)) {
                            deleteTableMutation.mutate(table.id);
                          }
                        }}
                        className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
                        title="削除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ステータスバッジ */}
              <AlertBadge
                label={table.status === 'empty' ? '空き' : table.status === 'occupied' ? '使用中' : '予約中'}
                variant={table.status}
              />

              {/* 使用中の場合: 客数と経過時間 */}
              {table.status === 'occupied' && table.current_session && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Users className="w-3 h-3" />
                    <span>{table.current_session.guest_count}名</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>{formatElapsed(table.current_session.started_at)}</span>
                  </div>
                  <div className="text-xs text-amber-400 font-medium">
                    {formatYen(table.current_session.total)}
                  </div>
                </div>
              )}

              {/* 定員表示 */}
              <div className="mt-2 text-xs text-gray-600">
                最大{table.capacity}名
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-500">
          <Grid className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>テーブルデータがありません</p>
        </div>
      )}

      {/* テーブル追加・編集モーダル */}
      {isTableMasterModal && (
        <Modal
          title={editingTable ? `${editingTable.name} を編集` : 'テーブル追加'}
          onClose={() => { setIsTableMasterModal(false); setEditingTable(null); resetTable(); }}
          size="small"
          footer={
            <>
              <button
                onClick={() => { setIsTableMasterModal(false); setEditingTable(null); resetTable(); }}
                className="px-4 py-2 text-gray-400 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmitTable(onTableSubmit)}
                disabled={createTableMutation.isPending || updateTableMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-lg text-sm"
              >
                {(createTableMutation.isPending || updateTableMutation.isPending) && (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                )}
                {editingTable ? '更新する' : '追加する'}
              </button>
            </>
          }
        >
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">テーブル名</label>
              <input
                type="text"
                placeholder="例: C1"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                {...registerTable('name', { required: 'テーブル名を入力してください' })}
              />
              {tableErrors.name && <p className="mt-1 text-xs text-red-400">{tableErrors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">定員（名）</label>
              <input
                type="number"
                min="1"
                max="50"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                {...registerTable('capacity', { required: '定員を入力してください', min: 1 })}
              />
              {tableErrors.capacity && <p className="mt-1 text-xs text-red-400">{tableErrors.capacity.message}</p>}
            </div>
          </form>
        </Modal>
      )}

      {/* 開卓モーダル */}
      {isOpenSessionModal && selectedTable && (
        <Modal
          title={`${selectedTable.name} - 開卓`}
          onClose={() => { setIsOpenSessionModal(false); setSelectedTable(null); resetOpen(); }}
          size="small"
          footer={
            <>
              <button
                onClick={() => { setIsOpenSessionModal(false); setSelectedTable(null); resetOpen(); }}
                className="px-4 py-2 text-gray-400 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmitOpen(onOpenSubmit)}
                disabled={openSessionMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm transition-colors"
              >
                {openSessionMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                開卓する
              </button>
            </>
          }
        >
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">担当スタッフ</label>
              <select
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                {...registerOpen('staff_id', { required: 'スタッフを選択してください' })}
              >
                <option value="">選択してください</option>
                {staffList?.filter((s) => s.is_active).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {openErrors.staff_id && (
                <p className="mt-1 text-xs text-red-400">{openErrors.staff_id.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">客数</label>
              <input
                type="number"
                min="1"
                max={selectedTable.capacity}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder={`1〜${selectedTable.capacity}名`}
                {...registerOpen('guest_count', {
                  required: '客数を入力してください',
                  min: { value: 1, message: '1名以上で入力してください' },
                  max: { value: selectedTable.capacity, message: `最大${selectedTable.capacity}名です` },
                })}
              />
              {openErrors.guest_count && (
                <p className="mt-1 text-xs text-red-400">{openErrors.guest_count.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">料金プラン</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="tanpin" {...registerOpen('plan_type')}
                    className="accent-amber-500" />
                  <span className="text-white text-sm">単品</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="nomi_hodai" {...registerOpen('plan_type')}
                    className="accent-amber-500" />
                  <span className="text-white text-sm">飲み放題</span>
                </label>
              </div>
            </div>
            {selectedPlan === 'nomi_hodai' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">制限時間（分）</label>
                <input
                  type="number"
                  min="30"
                  max="240"
                  step="30"
                  placeholder="例: 90"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  {...registerOpen('time_limit_minutes', {
                    required: selectedPlan === 'nomi_hodai' ? '制限時間を入力してください' : false,
                    min: { value: 30, message: '30分以上で入力してください' },
                  })}
                />
                {openErrors.time_limit_minutes && (
                  <p className="mt-1 text-xs text-red-400">{openErrors.time_limit_minutes.message}</p>
                )}
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* セッション詳細モーダル（注文・会計） */}
      {isSessionDetailModal && selectedTable?.current_session && (
        <Modal
          title={`${selectedTable.name} - セッション詳細`}
          onClose={() => { setIsSessionDetailModal(false); setSelectedTable(null); }}
          size="large"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
              {/* 割り勘計算 */}
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">割り勘:</span>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={splitCount}
                  onChange={(e) => setSplitCount(Math.max(2, Number(e.target.value)))}
                  className="w-16 px-2 py-1 bg-gray-900 border border-gray-600 text-white rounded text-sm focus:outline-none"
                />
                <span className="text-gray-400 text-sm">名</span>
                <span className="text-amber-400 font-semibold text-sm">
                  = {formatYen(splitAmount)}/人
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setIsSessionDetailModal(false); setSelectedTable(null); }}
                  className="px-4 py-2 text-gray-400 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                >
                  閉じる
                </button>
                <button
                  onClick={handleCloseSession}
                  disabled={closeSessionMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm transition-colors font-semibold"
                >
                  <Receipt className="w-4 h-4" />
                  会計 ({formatYen(selectedTable.current_session.total)})
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            {/* セッション情報 */}
            {selectedTable.current_session.plan_type === 'nomi_hodai' && (
              <div className="flex items-center justify-between bg-indigo-900/30 border border-indigo-700 rounded-lg px-4 py-2 text-sm">
                <span className="text-indigo-300 font-medium">🍺 飲み放題</span>
                {selectedTable.current_session.time_limit_minutes && (() => {
                  const elapsed = differenceInMinutes(new Date(), new Date(selectedTable.current_session!.started_at));
                  const remaining = selectedTable.current_session.time_limit_minutes - elapsed;
                  return remaining > 0
                    ? <span className={`font-bold ${remaining <= 10 ? 'text-red-400 animate-pulse' : 'text-indigo-300'}`}>残り {remaining}分</span>
                    : <span className="text-red-400 font-bold animate-pulse">時間終了</span>;
                })()}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-1">客数</p>
                <p className="text-white font-semibold">{selectedTable.current_session.guest_count}名</p>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-1">経過時間</p>
                <p className="text-white font-semibold">
                  {formatElapsed(selectedTable.current_session.started_at)}
                </p>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-1">現在合計</p>
                <p className="text-amber-400 font-bold">
                  {formatYen(selectedTable.current_session.total)}
                </p>
              </div>
            </div>

            {/* 注文アイテム一覧 */}
            <div>
              <h4 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-amber-400" />
                注文内容
              </h4>
              {selectedTable.current_session.items && selectedTable.current_session.items.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedTable.current_session.items.map((item: OrderItem) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2 text-sm"
                    >
                      <div className="flex-1">
                        <span className="text-white">
                          {item.product_name ?? `商品ID: ${item.product_id}`}
                        </span>
                        <span className="text-gray-500 ml-2">×{item.qty}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-amber-400">
                          {formatYen(item.unit_price * item.qty)}
                        </span>
                        <button
                          onClick={() => removeOrderMutation.mutate({ sessionId: selectedTable.current_session!.id, itemId: item.id })}
                          className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                          title="削除"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">注文がありません</p>
              )}
            </div>

            {/* 注文追加フォーム */}
            <div className="border-t border-gray-700 pt-4">
              <h4 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-green-400" />
                注文を追加
              </h4>
              <form onSubmit={handleSubmitOrder(onAddOrderSubmit)} className="flex flex-wrap gap-2">
                <select
                  className="flex-1 min-w-32 px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  {...registerOrder('product_id', { required: true })}
                >
                  <option value="">商品を選択</option>
                  {products?.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatYen(p.price)})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  max="99"
                  defaultValue={1}
                  className="w-20 px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  {...registerOrder('qty', { required: true, min: 1 })}
                />
                {selectedProduct && (
                  <span className="flex items-center text-amber-400 text-sm px-2">
                    {formatYen(selectedProduct.price)}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={addOrderMutation.isPending}
                  className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm transition-colors flex items-center gap-1.5"
                >
                  {addOrderMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  追加
                </button>
              </form>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Tables;
