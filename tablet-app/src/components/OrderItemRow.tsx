// ============================================================
// OrderItemRow コンポーネント
// 注文明細行 - 数量変更ボタン、商品名、単価、小計を表示
// ============================================================

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { OrderItem } from '../types';

// テーマカラー
const COLORS = {
  surface: '#2a2a3e',
  border: '#3a3a5e',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  accent: '#f59e0b',
  deleteRed: '#dc2626',
  deleteBg: '#450a0a',
  plusGreen: '#16a34a',
  plusBg: '#052e16',
  priceGold: '#fcd34d',
};

interface OrderItemRowProps {
  item: OrderItem;                                      // 注文明細
  onIncrease: (item: OrderItem) => void;                // 数量を増やす
  onDecrease: (item: OrderItem) => void;                // 数量を減らす（0になったら削除）
  onDelete: (item: OrderItem) => void;                  // 明細を削除
  isEditable?: boolean;                                 // 編集可能かどうか（会計済みは不可）
}

/**
 * 注文明細行コンポーネント
 */
const OrderItemRow: React.FC<OrderItemRowProps> = ({
  item,
  onIncrease,
  onDecrease,
  onDelete,
  isEditable = true,
}) => {
  return (
    <View style={styles.row}>
      {/* 左側: 数量コントロール */}
      <View style={styles.qtyControl}>
        {isEditable ? (
          <>
            {/* 減らすボタン */}
            <TouchableOpacity
              style={[
                styles.qtyButton,
                item.quantity === 1 ? styles.deleteButton : styles.minusButton,
              ]}
              onPress={() => item.quantity === 1 ? onDelete(item) : onDecrease(item)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.qtyButtonText,
                item.quantity === 1 ? styles.deleteButtonText : styles.minusButtonText,
              ]}>
                {item.quantity === 1 ? '✕' : '－'}
              </Text>
            </TouchableOpacity>

            {/* 数量表示 */}
            <Text style={styles.quantity}>{item.quantity}</Text>

            {/* 増やすボタン */}
            <TouchableOpacity
              style={[styles.qtyButton, styles.plusButton]}
              onPress={() => onIncrease(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.qtyButtonText, styles.plusButtonText]}>＋</Text>
            </TouchableOpacity>
          </>
        ) : (
          // 編集不可の場合は数量のみ表示
          <Text style={styles.quantityReadOnly}>×{item.quantity}</Text>
        )}
      </View>

      {/* 中央: 商品名と注文時刻 */}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {item.product_name}
        </Text>
        {item.note ? (
          <Text style={styles.note} numberOfLines={1}>
            備考: {item.note}
          </Text>
        ) : null}
        <Text style={styles.orderedAt}>
          {new Date(item.ordered_at).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>

      {/* 右側: 単価と小計 */}
      <View style={styles.priceInfo}>
        <Text style={styles.unitPrice}>
          ¥{item.unit_price.toLocaleString()}
        </Text>
        <Text style={styles.subtotal}>
          ¥{item.subtotal.toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 8,
  },
  // 数量コントロール部分
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 110,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  minusButton: {
    backgroundColor: '#1e1e3e',
    borderColor: COLORS.border,
  },
  plusButton: {
    backgroundColor: COLORS.plusBg,
    borderColor: COLORS.plusGreen,
  },
  deleteButton: {
    backgroundColor: COLORS.deleteBg,
    borderColor: COLORS.deleteRed,
  },
  qtyButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  minusButtonText: {
    color: COLORS.textSecondary,
  },
  plusButtonText: {
    color: '#4ade80',
  },
  deleteButtonText: {
    color: '#f87171',
    fontSize: 13,
  },
  quantity: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  quantityReadOnly: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    width: 110,
  },
  // 商品情報部分
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  orderedAt: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  // 価格情報部分
  priceInfo: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 90,
  },
  unitPrice: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  subtotal: {
    color: COLORS.priceGold,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default OrderItemRow;
