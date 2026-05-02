// ============================================================
// ProductGrid コンポーネント
// 商品グリッド - 3列のタッチブルボタングリッド
// ============================================================

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Product } from '../types';

// テーマカラー
const COLORS = {
  background: '#0f0f1a',
  itemBg: '#1e1e3e',
  itemBorder: '#2e2e5e',
  itemPressed: '#2e2e4e',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  priceGold: '#f59e0b',
  outOfStock: '#450a0a',
  outOfStockBorder: '#7f1d1d',
  outOfStockText: '#f87171',
  lowStockBadge: '#78350f',
  lowStockText: '#fcd34d',
};

// 列数
const NUM_COLUMNS = 3;

interface ProductGridProps {
  products: Product[];                      // 表示する商品リスト
  onSelect: (product: Product) => void;     // 商品選択コールバック
  category?: string;                        // フィルタリングするカテゴリ
  style?: ViewStyle;                        // 外部スタイル
}

/**
 * 商品グリッドコンポーネント
 * 3列グリッドで商品ボタンを表示する
 */
const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  onSelect,
  category,
  style,
}) => {
  // カテゴリフィルタリング
  const filteredProducts = category
    ? products.filter((p) => p.category === category)
    : products;

  /**
   * 商品ボタンのレンダリング
   */
  const renderProduct = ({ item }: { item: Product }) => {
    const isOutOfStock = !item.is_available || item.stock === 0;
    const isLowStock = item.stock > 0 && item.stock <= item.low_stock_threshold;

    return (
      <TouchableOpacity
        style={[
          styles.productItem,
          isOutOfStock && styles.outOfStockItem,
        ]}
        onPress={() => !isOutOfStock && onSelect(item)}
        disabled={isOutOfStock}
        activeOpacity={0.7}
      >
        {/* 在庫少バッジ */}
        {isLowStock && !isOutOfStock && (
          <View style={styles.lowStockBadge}>
            <Text style={styles.lowStockBadgeText}>残{item.stock}</Text>
          </View>
        )}

        {/* 商品名 */}
        <Text
          style={[
            styles.productName,
            isOutOfStock && styles.outOfStockText,
          ]}
          numberOfLines={2}
        >
          {item.name}
        </Text>

        {/* 価格 */}
        <Text
          style={[
            styles.productPrice,
            isOutOfStock && styles.outOfStockText,
          ]}
        >
          ¥{item.price.toLocaleString()}
        </Text>

        {/* 在庫切れオーバーレイ */}
        {isOutOfStock && (
          <View style={styles.soldOutOverlay}>
            <Text style={styles.soldOutText}>品切れ</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // 空の場合の表示
  if (filteredProducts.length === 0) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Text style={styles.emptyText}>
          {category ? `「${category}」の商品がありません` : '商品がありません'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.grid, style]}
      data={filteredProducts}
      renderItem={renderProduct}
      keyExtractor={(item) => item.id.toString()}
      numColumns={NUM_COLUMNS}
      // グリッドのパディング
      contentContainerStyle={styles.gridContent}
      // パフォーマンス最適化
      removeClippedSubviews={true}
      maxToRenderPerBatch={12}
      initialNumToRender={12}
      // グリッドが変わったときにリセット（カテゴリ変更時）
      key={`grid-${category || 'all'}`}
    />
  );
};

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gridContent: {
    padding: 8,
    gap: 0,
  },
  productItem: {
    flex: 1,
    margin: 4,
    backgroundColor: COLORS.itemBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.itemBorder,
    padding: 10,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  outOfStockItem: {
    backgroundColor: COLORS.outOfStock,
    borderColor: COLORS.outOfStockBorder,
    opacity: 0.6,
  },
  productName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  productPrice: {
    color: COLORS.priceGold,
    fontSize: 15,
    fontWeight: '700',
  },
  outOfStockText: {
    color: COLORS.outOfStockText,
  },
  // 在庫少バッジ（右上角）
  lowStockBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.lowStockBadge,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lowStockBadgeText: {
    color: COLORS.lowStockText,
    fontSize: 10,
    fontWeight: '700',
  },
  // 品切れオーバーレイ
  soldOutOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  soldOutText: {
    color: '#f87171',
    fontSize: 16,
    fontWeight: '800',
    transform: [{ rotate: '-15deg' }],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});

export default ProductGrid;
