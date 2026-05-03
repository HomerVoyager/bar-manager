// バー管理システム - 在庫管理ページ
// 在庫一覧・入出庫履歴・発注アラートを管理します

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Package, AlertTriangle, History, Plus, RefreshCw, Pencil, Trash2, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { fetchProducts, createProduct, updateProduct, deleteProduct } from '../api/products';
import { fetchStockLogs, adjustStock } from '../api/stock';
import AlertBadge from '../components/AlertBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import type { Product, StockLog, StockAdjustForm } from '../types';

type ProductForm = {
  name: string;
  category: string;
  price: number;
  cost: number;
  unit: string;
  alert_qty: number;
  stock_qty: number;
};

// 在庫状態を判定する関数
const getStockStatus = (product: Product): { label: string; variant: 'success' | 'warning' | 'danger' } => {
  if (product.stock_qty === 0) return { label: '品切れ', variant: 'danger' };
  if (product.stock_qty <= product.alert_qty) return { label: '要発注', variant: 'warning' };
  return { label: '正常', variant: 'success' };
};

// タブの型定義
type TabType = 'list' | 'history' | 'alert' | 'master';

const Inventory: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const queryClient = useQueryClient();

  // 商品一覧の取得
  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  // 在庫ログの取得
  const { data: stockLogs, isLoading: logsLoading } = useQuery<StockLog[]>({
    queryKey: ['stock-logs'],
    queryFn: () => fetchStockLogs({ limit: 100 }),
    enabled: activeTab === 'history',
  });

  // 在庫調整フォーム
  const { register, handleSubmit, reset, formState: { errors } } = useForm<StockAdjustForm>();

  // 商品マスタフォーム
  const {
    register: registerMaster,
    handleSubmit: handleSubmitMaster,
    reset: resetMaster,
    setValue: setValueMaster,
    formState: { errors: masterErrors },
  } = useForm<ProductForm>();

  // 商品作成ミューテーション
  const createProductMutation = useMutation({
    mutationFn: (data: ProductForm) => createProduct({
      ...data,
      price: Number(data.price),
      cost: Number(data.cost),
      alert_qty: Number(data.alert_qty),
      stock_qty: Number(data.stock_qty),
      is_active: true,
    } as Omit<Product, 'id' | 'is_low_stock'>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsMasterModalOpen(false);
      resetMaster();
    },
    onError: () => alert('商品の登録に失敗しました。'),
  });

  // 商品更新ミューテーション
  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProductForm }) =>
      updateProduct(id, {
        ...data,
        price: Number(data.price),
        cost: Number(data.cost),
        alert_qty: Number(data.alert_qty),
        stock_qty: Number(data.stock_qty),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsMasterModalOpen(false);
      setEditingProduct(null);
      resetMaster();
    },
    onError: () => alert('商品の更新に失敗しました。'),
  });

  // 商品削除ミューテーション
  const deleteProductMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    onError: () => alert('商品の削除に失敗しました。'),
  });

  const onMasterSubmit = (data: ProductForm) => {
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data });
    } else {
      createProductMutation.mutate(data);
    }
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setValueMaster('name', product.name);
    setValueMaster('category', product.category ?? '');
    setValueMaster('price', product.price);
    setValueMaster('cost', product.cost);
    setValueMaster('unit', product.unit ?? '');
    setValueMaster('alert_qty', product.alert_qty);
    setValueMaster('stock_qty', product.stock_qty);
    setIsMasterModalOpen(true);
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    resetMaster();
    setIsMasterModalOpen(true);
  };

  // 在庫調整ミューテーション
  const adjustMutation = useMutation({
    mutationFn: adjustStock,
    onSuccess: () => {
      // キャッシュを無効化して再取得
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-logs'] });
      setIsAdjustModalOpen(false);
      reset();
    },
    onError: (err) => {
      console.error('在庫調整エラー:', err);
      alert('在庫の調整に失敗しました。');
    },
  });

  const onAdjustSubmit = (data: StockAdjustForm) => {
    adjustMutation.mutate({
      ...data,
      product_id: Number(data.product_id),
      change_qty: Number(data.change_qty),
    });
  };

  // 在庫アラート対象の商品
  const lowStockProducts = products?.filter(
    (p) => p.is_active && p.stock_qty <= p.alert_qty
  ) ?? [];

  // 理由ラベルの変換
  const reasonLabel = (reason: string) => {
    switch (reason) {
      case 'purchase': return '入庫';
      case 'sale': return '売上';
      case 'loss': return '損失';
      default: return reason;
    }
  };

  const reasonVariant = (reason: string): 'success' | 'warning' | 'danger' | 'neutral' => {
    switch (reason) {
      case 'purchase': return 'success';
      case 'sale': return 'info' as 'neutral';
      case 'loss': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">在庫管理</h2>
          <p className="text-gray-400 text-sm mt-1">商品の在庫状況と入出庫管理</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'master' && (
            <button
              onClick={openAddProduct}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              商品追加
            </button>
          )}
          <button
            onClick={() => setIsAdjustModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            在庫調整
          </button>
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="flex bg-gray-800 rounded-xl border border-gray-700 p-1 w-fit">
        {([
          { key: 'list', icon: Package, label: '在庫一覧' },
          { key: 'history', icon: History, label: '入出庫履歴' },
          { key: 'alert', icon: AlertTriangle, label: `発注アラート (${lowStockProducts.length})` },
          { key: 'master', icon: Settings, label: '商品マスタ' },
        ] as { key: TabType; icon: React.ComponentType<{ className?: string }>; label: string }[]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === key
                ? 'bg-amber-600 text-white'
                : 'text-gray-400 hover:text-white'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* 在庫一覧タブ */}
      {activeTab === 'list' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          {productsLoading ? (
            <LoadingSpinner message="商品データを読み込み中..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-400 px-5 py-3 font-medium">商品名</th>
                    <th className="text-left text-gray-400 px-5 py-3 font-medium">カテゴリ</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">現在庫</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">アラート数</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">単位</th>
                    <th className="text-center text-gray-400 px-5 py-3 font-medium">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {products?.filter((p) => p.is_active).map((product) => {
                    const status = getStockStatus(product);
                    return (
                      <tr key={product.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-5 py-3 text-white font-medium">{product.name}</td>
                        <td className="px-5 py-3 text-gray-400">{product.category ?? '-'}</td>
                        <td className={`px-5 py-3 text-right font-medium ${
                          product.stock_qty === 0 ? 'text-red-400' :
                          product.stock_qty <= product.alert_qty ? 'text-yellow-400' : 'text-white'
                        }`}>
                          {product.stock_qty.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-400">
                          {product.alert_qty.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-400">
                          {product.unit ?? '個'}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <AlertBadge label={status.label} variant={status.variant} />
                        </td>
                      </tr>
                    );
                  })}
                  {(!products || products.filter((p) => p.is_active).length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                        商品データがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 入出庫履歴タブ */}
      {activeTab === 'history' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          {logsLoading ? (
            <LoadingSpinner message="履歴を読み込み中..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-400 px-5 py-3 font-medium">日時</th>
                    <th className="text-left text-gray-400 px-5 py-3 font-medium">商品名</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">数量変化</th>
                    <th className="text-center text-gray-400 px-5 py-3 font-medium">理由</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {stockLogs?.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3 text-gray-400">
                        {format(new Date(log.created_at), 'yyyy年M月d日 HH:mm')}
                      </td>
                      <td className="px-5 py-3 text-white">
                        {log.product_name ?? `商品ID: ${log.product_id}`}
                      </td>
                      <td className={`px-5 py-3 text-right font-medium ${
                        log.change_qty > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {log.change_qty > 0 ? '+' : ''}{log.change_qty}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <AlertBadge
                          label={reasonLabel(log.reason)}
                          variant={reasonVariant(log.reason)}
                        />
                      </td>
                    </tr>
                  ))}
                  {(!stockLogs || stockLogs.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-gray-500">
                        入出庫履歴がありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 発注アラートタブ */}
      {activeTab === 'alert' && (
        <div className="space-y-4">
          {lowStockProducts.length === 0 ? (
            <div className="bg-gray-800 rounded-xl border border-green-800 p-8 text-center">
              <Package className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-green-400 font-medium">すべての在庫が適正水準です</p>
              <p className="text-gray-500 text-sm mt-1">発注が必要な商品はありません</p>
            </div>
          ) : (
            <>
              <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">
                  <strong>{lowStockProducts.length}件</strong>の商品が在庫不足です。早急に発注を行ってください。
                </p>
              </div>
              <div className="bg-gray-800 rounded-xl border border-gray-700">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-gray-400 px-5 py-3 font-medium">商品名</th>
                        <th className="text-left text-gray-400 px-5 py-3 font-medium">カテゴリ</th>
                        <th className="text-right text-gray-400 px-5 py-3 font-medium">現在庫</th>
                        <th className="text-right text-gray-400 px-5 py-3 font-medium">アラート数</th>
                        <th className="text-right text-gray-400 px-5 py-3 font-medium">不足数</th>
                        <th className="text-center text-gray-400 px-5 py-3 font-medium">状態</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {lowStockProducts.map((product) => {
                        const status = getStockStatus(product);
                        const shortage = Math.max(0, product.alert_qty - product.stock_qty);
                        return (
                          <tr key={product.id} className="hover:bg-gray-700/30 transition-colors">
                            <td className="px-5 py-3 text-white font-medium">{product.name}</td>
                            <td className="px-5 py-3 text-gray-400">{product.category ?? '-'}</td>
                            <td className={`px-5 py-3 text-right font-bold ${
                              product.stock_qty === 0 ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {product.stock_qty}
                            </td>
                            <td className="px-5 py-3 text-right text-gray-400">{product.alert_qty}</td>
                            <td className="px-5 py-3 text-right text-red-400 font-medium">
                              -{shortage} {product.unit ?? '個'}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <AlertBadge label={status.label} variant={status.variant} pulse />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 商品マスタタブ */}
      {activeTab === 'master' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          {productsLoading ? (
            <LoadingSpinner message="商品データを読み込み中..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-400 px-4 py-3 font-medium">商品名</th>
                    <th className="text-left text-gray-400 px-4 py-3 font-medium">カテゴリ</th>
                    <th className="text-right text-gray-400 px-4 py-3 font-medium">販売価格</th>
                    <th className="text-right text-gray-400 px-4 py-3 font-medium">原価</th>
                    <th className="text-right text-gray-400 px-4 py-3 font-medium">単位</th>
                    <th className="text-right text-gray-400 px-4 py-3 font-medium">アラート数</th>
                    <th className="text-center text-gray-400 px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {products?.map((product) => (
                    <tr key={product.id} className={`hover:bg-gray-700/30 transition-colors ${!product.is_active ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3 text-white font-medium">{product.name}</td>
                      <td className="px-4 py-3 text-gray-400">{product.category ?? '-'}</td>
                      <td className="px-4 py-3 text-right text-amber-400">¥{product.price.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-400">¥{product.cost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{product.unit ?? '個'}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{product.alert_qty}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditProduct(product)}
                            className="p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-indigo-900/30 rounded transition-colors"
                            title="編集"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`「${product.name}」を削除しますか？`)) {
                                deleteProductMutation.mutate(product.id);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                            title="削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!products || products.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-500">商品データがありません</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 商品マスタ編集モーダル */}
      {isMasterModalOpen && (
        <Modal
          title={editingProduct ? '商品編集' : '商品追加'}
          onClose={() => { setIsMasterModalOpen(false); setEditingProduct(null); resetMaster(); }}
          size="medium"
          footer={
            <>
              <button
                onClick={() => { setIsMasterModalOpen(false); setEditingProduct(null); resetMaster(); }}
                className="px-4 py-2 text-gray-400 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmitMaster(onMasterSubmit)}
                disabled={createProductMutation.isPending || updateProductMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-lg text-sm"
              >
                {(createProductMutation.isPending || updateProductMutation.isPending) && (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                )}
                {editingProduct ? '更新する' : '登録する'}
              </button>
            </>
          }
        >
          <form className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">商品名</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  {...registerMaster('name', { required: '商品名を入力してください' })}
                />
                {masterErrors.name && <p className="mt-1 text-xs text-red-400">{masterErrors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">カテゴリ</label>
                <input
                  type="text"
                  placeholder="例: アルコール"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  {...registerMaster('category')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">単位</label>
                <input
                  type="text"
                  placeholder="例: 杯"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  {...registerMaster('unit')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">販売価格（円）</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  {...registerMaster('price', { required: '販売価格を入力してください', min: 0 })}
                />
                {masterErrors.price && <p className="mt-1 text-xs text-red-400">{masterErrors.price.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">原価（円）</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  {...registerMaster('cost', { required: '原価を入力してください', min: 0 })}
                />
                {masterErrors.cost && <p className="mt-1 text-xs text-red-400">{masterErrors.cost.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">アラート在庫数</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  {...registerMaster('alert_qty', { required: true, min: 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">初期在庫数</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  {...registerMaster('stock_qty', { required: true, min: 0 })}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* 在庫調整モーダル */}
      {isAdjustModalOpen && (
        <Modal
          title="在庫調整"
          onClose={() => { setIsAdjustModalOpen(false); reset(); }}
          size="medium"
          footer={
            <>
              <button
                onClick={() => { setIsAdjustModalOpen(false); reset(); }}
                className="px-4 py-2 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit(onAdjustSubmit)}
                disabled={adjustMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white rounded-lg transition-colors text-sm"
              >
                {adjustMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : null}
                調整する
              </button>
            </>
          }
        >
          <form className="space-y-4">
            {/* 商品選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">商品</label>
              <select
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                {...register('product_id', { required: '商品を選択してください' })}
              >
                <option value="">商品を選択してください</option>
                {products?.filter((p) => p.is_active).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (現在: {p.stock_qty} {p.unit ?? '個'})
                  </option>
                ))}
              </select>
              {errors.product_id && (
                <p className="mt-1 text-xs text-red-400">{errors.product_id.message}</p>
              )}
            </div>

            {/* 数量 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                変更数量（入庫: 正数、損失: 負数）
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: 10 または -2"
                {...register('change_qty', {
                  required: '数量を入力してください',
                  validate: (v) => v !== 0 || '0は入力できません',
                })}
              />
              {errors.change_qty && (
                <p className="mt-1 text-xs text-red-400">{errors.change_qty.message}</p>
              )}
            </div>

            {/* 理由 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">理由</label>
              <select
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                {...register('reason', { required: '理由を選択してください' })}
              >
                <option value="">理由を選択してください</option>
                <option value="purchase">入庫（仕入れ）</option>
                <option value="loss">損失（廃棄・紛失）</option>
              </select>
              {errors.reason && (
                <p className="mt-1 text-xs text-red-400">{errors.reason.message}</p>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Inventory;
