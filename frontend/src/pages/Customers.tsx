// 顧客管理ページ
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, X, Edit2, Trash2, UserCheck, Phone, Mail, CalendarDays, StickyNote } from 'lucide-react';
import { apiClient } from '../api/client';

interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  birthday?: string;
  notes?: string;
  visit_count: number;
  last_visit_date?: string;
  created_at: string;
}

interface CustomerForm {
  name: string;
  phone: string;
  email: string;
  birthday: string;
  notes: string;
}

const emptyForm = (): CustomerForm => ({ name: '', phone: '', email: '', birthday: '', notes: '' });

const fetchCustomers = async (search: string): Promise<Customer[]> => {
  const res = await apiClient.get('/customers/', { params: search ? { search } : {} });
  return res.data;
};

const Customers: React.FC = () => {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; customer?: Customer } | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm());
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => fetchCustomers(search),
  });

  const openCreate = () => { setForm(emptyForm()); setModal({ mode: 'create' }); };
  const openEdit = (c: Customer) => {
    setForm({ name: c.name, phone: c.phone ?? '', email: c.email ?? '', birthday: c.birthday ?? '', notes: c.notes ?? '' });
    setModal({ mode: 'edit', customer: c });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = { ...form, phone: form.phone || undefined, email: form.email || undefined, birthday: form.birthday || undefined, notes: form.notes || undefined };
      if (modal?.mode === 'edit' && modal.customer) {
        return apiClient.put(`/customers/${modal.customer.id}`, body);
      }
      return apiClient.post('/customers/', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setModal(null);
    },
    onError: (e: any) => alert(e?.response?.data?.detail ?? '保存に失敗しました'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/customers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
    onError: (e: any) => alert(e?.response?.data?.detail ?? '削除に失敗しました'),
  });

  const visitMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`/customers/${id}/visit`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">顧客管理</h2>
          <p className="text-gray-400 text-sm mt-1">常連客・VIP顧客の情報を管理</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> 顧客登録
        </button>
      </div>

      {/* 検索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="名前・電話・メールで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-600 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* 顧客リスト */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-16">読み込み中...</div>
      ) : customers.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          {search ? '該当する顧客が見つかりません' : '顧客が登録されていません'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map((c) => (
            <div key={c.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold text-base">{c.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">来店 {c.visit_count}回</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { if (window.confirm(`${c.name}さんの来店を記録しますか？`)) visitMutation.mutate(c.id); }}
                    className="p-1.5 rounded hover:bg-green-900/30 text-gray-500 hover:text-green-400 transition-colors"
                    title="来店記録"
                  >
                    <UserCheck className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { if (window.confirm(`${c.name}を削除しますか？`)) deleteMutation.mutate(c.id); }}
                    className="p-1.5 rounded hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                {c.phone && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Phone className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                    <span>{c.phone}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Mail className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.birthday && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <CalendarDays className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                    <span>{c.birthday}</span>
                  </div>
                )}
                {c.notes && (
                  <div className="flex items-start gap-2 text-gray-400">
                    <StickyNote className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs line-clamp-2">{c.notes}</span>
                  </div>
                )}
              </div>

              {c.last_visit_date && (
                <p className="text-xs text-gray-600">最終来店: {c.last_visit_date}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 登録・編集モーダル */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold">{modal.mode === 'create' ? '顧客登録' : '顧客編集'}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: '名前 *', key: 'name', type: 'text', placeholder: '山田 太郎' },
                { label: '電話番号', key: 'phone', type: 'tel', placeholder: '090-1234-5678' },
                { label: 'メール', key: 'email', type: 'email', placeholder: 'example@email.com' },
                { label: '誕生日', key: 'birthday', type: 'date', placeholder: '' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof CustomerForm]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-400 mb-1">メモ</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="好みのお酒、アレルギー情報など"
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!form.name || saveMutation.isPending}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm"
              >
                {saveMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
