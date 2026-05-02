// バー管理システム - メニュー画面（商品一覧・在庫確認）
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { Product } from '../types';

// カテゴリー一覧
const CATEGORIES = ['すべて', 'ドリンク', 'フード', 'ソフトドリンク', 'その他'];

const MenuScreen: React.FC = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [searchText, setSearchText] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);

  // 編集フォームの状態
  const [editForm, setEditForm] = useState({
    name: '',
    price: '',
    cost: '',
    category: '',
    stock_qty: '',
    alert_qty: '',
    unit: '',
  });

  // 商品一覧を取得
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Product[]>('/products/');
      setProducts(response.data);
    } catch {
      Alert.alert('エラー', '商品情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // カテゴリーと検索でフィルタリング
  const filteredProducts = products.filter((p) => {
    const matchCategory =
      selectedCategory === 'すべて' || p.category === selectedCategory;
    const matchSearch =
      !searchText || p.name.includes(searchText);
    return matchCategory && matchSearch && p.is_active;
  });

  // 在庫状態に応じたバッジカラー
  const getStockBadge = (product: Product) => {
    if (product.stock_qty === 0) {
      return { bg: '#7f1d1d', text: '#fca5a5', label: '品切れ' };
    }
    if (product.stock_qty <= product.alert_qty) {
      return { bg: '#78350f', text: '#fcd34d', label: '要発注' };
    }
    return { bg: '#14532d', text: '#86efac', label: '在庫あり' };
  };

  // 編集モーダルを開く
  const openEditModal = (product: Product) => {
    setEditTarget(product);
    setEditForm({
      name: product.name,
      price: String(product.price),
      cost: String(product.cost),
      category: product.category ?? '',
      stock_qty: String(product.stock_qty),
      alert_qty: String(product.alert_qty),
      unit: product.unit ?? '',
    });
    setEditModalVisible(true);
  };

  // 商品を更新
  const handleSaveProduct = async () => {
    if (!editTarget) return;
    try {
      await apiClient.put(`/products/${editTarget.id}`, {
        name: editForm.name,
        price: parseInt(editForm.price, 10),
        cost: parseInt(editForm.cost, 10),
        category: editForm.category || null,
        stock_qty: parseInt(editForm.stock_qty, 10),
        alert_qty: parseInt(editForm.alert_qty, 10),
        unit: editForm.unit || null,
      });
      Alert.alert('成功', '商品情報を更新しました');
      setEditModalVisible(false);
      fetchProducts();
    } catch {
      Alert.alert('エラー', '商品の更新に失敗しました');
    }
  };

  // 在庫を増やす（クイック入荷）
  const handleQuickRestock = (product: Product) => {
    Alert.prompt(
      '入荷数量',
      `${product.name} の入荷数を入力してください`,
      async (qty) => {
        if (!qty || isNaN(parseInt(qty, 10))) return;
        try {
          await apiClient.post('/stock/logs', {
            product_id: product.id,
            change_qty: parseInt(qty, 10),
            reason: 'purchase',
          });
          Alert.alert('完了', `${product.name} を ${qty} ${product.unit ?? '個'}入荷しました`);
          fetchProducts();
        } catch {
          Alert.alert('エラー', '在庫更新に失敗しました');
        }
      },
      'plain-text',
      '',
      'number-pad'
    );
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const badge = getStockBadge(item);
    const marginRate = item.price > 0
      ? Math.round(((item.price - item.cost) / item.price) * 100)
      : 0;

    return (
      <View style={styles.productCard}>
        {/* 商品名と原価率 */}
        <View style={styles.productHeader}>
          <Text style={styles.productName}>{item.name}</Text>
          <View style={[styles.stockBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.stockBadgeText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        {/* 価格・原価・在庫 */}
        <View style={styles.productDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>価格</Text>
            <Text style={styles.detailValue}>¥{item.price.toLocaleString()}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>原価</Text>
            <Text style={styles.detailValue}>¥{item.cost.toLocaleString()}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>原価率</Text>
            <Text style={[
              styles.detailValue,
              { color: marginRate >= 60 ? '#86efac' : marginRate >= 40 ? '#fcd34d' : '#fca5a5' }
            ]}>
              {100 - marginRate}%
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>在庫</Text>
            <Text style={[
              styles.detailValue,
              { color: item.stock_qty <= item.alert_qty ? '#fcd34d' : '#e5e7eb' }
            ]}>
              {item.stock_qty} {item.unit ?? ''}
            </Text>
          </View>
        </View>

        {/* アクションボタン（マネージャーのみ） */}
        {isManager && (
          <View style={styles.productActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleQuickRestock(item)}
            >
              <Ionicons name="add-circle-outline" size={16} color="#fbbf24" />
              <Text style={styles.actionBtnText}>入荷</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.editBtn]}
              onPress={() => openEditModal(item)}
            >
              <Ionicons name="pencil-outline" size={16} color="#93c5fd" />
              <Text style={[styles.actionBtnText, { color: '#93c5fd' }]}>編集</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fbbf24" />
        <Text style={styles.loadingText}>商品情報を読み込み中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🍺 メニュー管理</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchProducts}>
          <Ionicons name="refresh-outline" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* 検索バー */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#6b7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="商品名で検索..."
          placeholderTextColor="#6b7280"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* カテゴリータブ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryTabs}
        contentContainerStyle={styles.categoryTabsContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryTab,
              selectedCategory === cat && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[
              styles.categoryTabText,
              selectedCategory === cat && styles.categoryTabTextActive,
            ]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 商品数表示 */}
      <Text style={styles.countText}>{filteredProducts.length}件</Text>

      {/* 商品リスト */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>該当する商品がありません</Text>
        }
      />

      {/* 商品編集モーダル */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>商品を編集</Text>

            <ScrollView>
              {[
                { label: '商品名', key: 'name', keyboardType: 'default' as const },
                { label: '販売価格 (円)', key: 'price', keyboardType: 'number-pad' as const },
                { label: '原価 (円)', key: 'cost', keyboardType: 'number-pad' as const },
                { label: 'カテゴリー', key: 'category', keyboardType: 'default' as const },
                { label: '在庫数', key: 'stock_qty', keyboardType: 'number-pad' as const },
                { label: '発注アラート閾値', key: 'alert_qty', keyboardType: 'number-pad' as const },
                { label: '単位', key: 'unit', keyboardType: 'default' as const },
              ].map(({ label, key, keyboardType }) => (
                <View key={key} style={styles.formGroup}>
                  <Text style={styles.formLabel}>{label}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editForm[key as keyof typeof editForm]}
                    onChangeText={(v) => setEditForm((prev) => ({ ...prev, [key]: v }))}
                    keyboardType={keyboardType}
                    placeholderTextColor="#6b7280"
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleSaveProduct}
              >
                <Text style={styles.saveBtnText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030712' },
  loadingText: { color: '#9ca3af', marginTop: 12, fontSize: 14 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: { color: '#f9fafb', fontSize: 18, fontWeight: '700' },
  refreshBtn: { padding: 4 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#f9fafb', fontSize: 14, height: 40 },

  categoryTabs: { maxHeight: 48 },
  categoryTabsContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  categoryTabActive: { backgroundColor: '#92400e', borderColor: '#d97706' },
  categoryTabText: { color: '#9ca3af', fontSize: 13 },
  categoryTabTextActive: { color: '#fbbf24', fontWeight: '600' },

  countText: { color: '#6b7280', fontSize: 12, paddingHorizontal: 16, paddingTop: 8 },

  listContent: { padding: 12 },
  row: { gap: 12, marginBottom: 12 },

  productCard: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  productName: { color: '#f9fafb', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  stockBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  stockBadgeText: { fontSize: 10, fontWeight: '600' },

  productDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  detailItem: { width: '45%' },
  detailLabel: { color: '#6b7280', fontSize: 10, marginBottom: 2 },
  detailValue: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },

  productActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#422006',
    borderWidth: 1,
    borderColor: '#d97706',
  },
  editBtn: { backgroundColor: '#1e3a5f', borderColor: '#3b82f6' },
  actionBtnText: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },

  emptyText: { color: '#6b7280', textAlign: 'center', marginTop: 40, fontSize: 14 },

  // モーダル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalTitle: { color: '#f9fafb', fontSize: 16, fontWeight: '700', marginBottom: 16 },

  formGroup: { marginBottom: 12 },
  formLabel: { color: '#9ca3af', fontSize: 12, marginBottom: 4 },
  formInput: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 6,
    color: '#f9fafb',
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#374151' },
  cancelBtnText: { color: '#9ca3af', fontWeight: '600' },
  saveBtn: { backgroundColor: '#d97706' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});

export default MenuScreen;
