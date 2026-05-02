// ============================================================
// TableCard コンポーネント
// テーブルの状態に応じて色と表示が変わる大きなタッチブルカード
// ============================================================

import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Table } from '../types';

// テーブル状態別カラー設定
const STATUS_COLORS = {
  empty: {
    background: '#052e16',    // 深い緑
    border: '#16a34a',        // 緑
    badgeBg: '#14532d',
    badgeText: '#4ade80',
    titleText: '#4ade80',
    infoText: '#86efac',
  },
  occupied: {
    background: '#450a0a',    // 深い赤
    border: '#dc2626',        // 赤
    badgeBg: '#7f1d1d',
    badgeText: '#fca5a5',
    titleText: '#fca5a5',
    infoText: '#fecaca',
  },
  reserved: {
    background: '#422006',    // 深い黄
    border: '#d97706',        // 黄金色
    badgeBg: '#78350f',
    badgeText: '#fcd34d',
    titleText: '#fcd34d',
    infoText: '#fde68a',
  },
};

interface TableCardProps {
  table: Table;                         // テーブル情報
  onPress: (table: Table) => void;      // タップ時コールバック
  elapsedMinutes?: number;              // 経過時間（分）
  guestCount?: number;                  // 現在の人数
  totalAmount?: number;                 // 現在の売上合計
  style?: ViewStyle;                    // 外部スタイル
}

/**
 * 経過時間を「HH:mm」形式の文字列に変換する
 */
const formatElapsedTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) {
    return `${h}時間${m.toString().padStart(2, '0')}分`;
  }
  return `${m}分`;
};

/**
 * テーブルカードコンポーネント
 */
const TableCard: React.FC<TableCardProps> = ({
  table,
  onPress,
  elapsedMinutes,
  guestCount,
  totalAmount,
  style,
}) => {
  const colors = STATUS_COLORS[table.status];

  // ステータスラベル（日本語）
  const statusLabels: Record<Table['status'], string> = {
    empty: '空席',
    occupied: '使用中',
    reserved: '予約',
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
        style,
      ]}
      onPress={() => onPress(table)}
      activeOpacity={0.75}
    >
      {/* テーブル名 */}
      <Text style={[styles.tableName, { color: colors.titleText }]}>
        {table.name}
      </Text>

      {/* ステータスバッジ */}
      <View style={[styles.statusBadge, { backgroundColor: colors.badgeBg }]}>
        <Text style={[styles.statusText, { color: colors.badgeText }]}>
          {statusLabels[table.status]}
        </Text>
      </View>

      {/* 使用中テーブルの情報 */}
      {table.status === 'occupied' && (
        <View style={styles.occupiedInfo}>
          {/* 人数 */}
          {guestCount !== undefined && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoIcon, { color: colors.infoText }]}>👥</Text>
              <Text style={[styles.infoText, { color: colors.infoText }]}>
                {guestCount}名
              </Text>
            </View>
          )}

          {/* 経過時間 */}
          {elapsedMinutes !== undefined && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoIcon, { color: colors.infoText }]}>⏱</Text>
              <Text style={[styles.infoText, { color: colors.infoText }]}>
                {formatElapsedTime(elapsedMinutes)}
              </Text>
            </View>
          )}

          {/* 現在の合計金額 */}
          {totalAmount !== undefined && totalAmount > 0 && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoIcon, { color: colors.infoText }]}>💴</Text>
              <Text style={[styles.amountText, { color: colors.infoText }]}>
                ¥{totalAmount.toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 空席テーブルの定員表示 */}
      {table.status === 'empty' && (
        <Text style={[styles.capacityText, { color: colors.infoText }]}>
          定員 {table.capacity}名
        </Text>
      )}

      {/* 予約テーブルの表示 */}
      {table.status === 'reserved' && (
        <Text style={[styles.reservedText, { color: colors.infoText }]}>
          予約あり
        </Text>
      )}

      {/* ステータスインジケーター（下部のライン） */}
      <View style={[styles.statusLine, { backgroundColor: colors.border }]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
    minHeight: 130,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    position: 'relative',
    overflow: 'hidden',
  },
  tableName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  occupiedInfo: {
    gap: 4,
    width: '100%',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoIcon: {
    fontSize: 13,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '500',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '700',
  },
  capacityText: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.8,
  },
  reservedText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  // カード下部のカラーライン（ステータス表示の視覚的強調）
  statusLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
});

export default TableCard;
