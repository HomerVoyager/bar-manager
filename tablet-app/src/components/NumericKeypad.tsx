// ============================================================
// NumericKeypad コンポーネント
// テンキー入力コンポーネント（現金入力・人数入力用）
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';

// テーマカラー定数
const COLORS = {
  background: '#1a1a2e',
  surface: '#2a2a3e',
  key: '#2e2e4e',
  keyText: '#ffffff',
  deleteKey: '#4a2a2a',
  confirmKey: '#2a4a2a',
  confirmText: '#4ade80',
  deleteText: '#f87171',
  accent: '#f59e0b',
  border: '#3a3a5e',
};

interface NumericKeypadProps {
  value: string;                          // 現在の入力値（文字列）
  onValueChange: (value: string) => void; // 値変更コールバック
  maxLength?: number;                     // 最大入力桁数
  style?: ViewStyle;                      // 外部スタイル
  onConfirm?: (value: string) => void;    // 確定ボタンコールバック
  showConfirm?: boolean;                  // 確定ボタンを表示するか
}

/**
 * テンキーコンポーネント
 * 数字0-9、バックスペース（✗）、確定（✓）ボタンで構成
 */
const NumericKeypad: React.FC<NumericKeypadProps> = ({
  value,
  onValueChange,
  maxLength = 8,
  style,
  onConfirm,
  showConfirm = true,
}) => {
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  /**
   * 数字キーを押したときの処理
   */
  const handleNumberPress = (num: string) => {
    // 最大桁数チェック
    if (value.length >= maxLength) return;
    // 先頭の0を防ぐ（"0" + 数字の場合は数字だけにする）
    if (value === '0' && num !== '.') {
      onValueChange(num);
    } else {
      onValueChange(value + num);
    }
  };

  /**
   * バックスペース処理
   */
  const handleDelete = () => {
    if (value.length > 0) {
      onValueChange(value.slice(0, -1));
    }
  };

  /**
   * 全クリア処理
   */
  const handleClear = () => {
    onValueChange('');
  };

  /**
   * 確定処理
   */
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(value);
    }
  };

  /**
   * キーを押したときのフラッシュ演出
   */
  const handleKeyPressIn = (key: string) => {
    setPressedKey(key);
  };

  const handleKeyPressOut = () => {
    setPressedKey(null);
  };

  /**
   * 個別キーボタンのレンダリング
   */
  const renderKey = (
    label: string,
    onPress: () => void,
    keyStyle?: object,
    textStyle?: object
  ) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.key,
        keyStyle,
        pressedKey === label && styles.keyPressed,
      ]}
      onPress={onPress}
      onPressIn={() => handleKeyPressIn(label)}
      onPressOut={handleKeyPressOut}
      activeOpacity={0.7}
    >
      <Text style={[styles.keyText, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      {/* 行1: 7, 8, 9 */}
      <View style={styles.row}>
        {renderKey('7', () => handleNumberPress('7'))}
        {renderKey('8', () => handleNumberPress('8'))}
        {renderKey('9', () => handleNumberPress('9'))}
      </View>

      {/* 行2: 4, 5, 6 */}
      <View style={styles.row}>
        {renderKey('4', () => handleNumberPress('4'))}
        {renderKey('5', () => handleNumberPress('5'))}
        {renderKey('6', () => handleNumberPress('6'))}
      </View>

      {/* 行3: 1, 2, 3 */}
      <View style={styles.row}>
        {renderKey('1', () => handleNumberPress('1'))}
        {renderKey('2', () => handleNumberPress('2'))}
        {renderKey('3', () => handleNumberPress('3'))}
      </View>

      {/* 行4: C(クリア), 0, ⌫(バックスペース) */}
      <View style={styles.row}>
        {renderKey(
          'C',
          handleClear,
          styles.deleteKey,
          { color: COLORS.deleteText }
        )}
        {renderKey('0', () => handleNumberPress('0'))}
        {renderKey(
          '⌫',
          handleDelete,
          styles.deleteKey,
          { color: COLORS.deleteText }
        )}
      </View>

      {/* 確定ボタン（showConfirmがtrueの場合） */}
      {showConfirm && (
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>確定 ✓</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    padding: 8,
    borderRadius: 12,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  key: {
    flex: 1,
    aspectRatio: 1.4,
    backgroundColor: COLORS.key,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    // 最小高さを設定してタッチしやすくする
    minHeight: 52,
  },
  keyPressed: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  keyText: {
    color: COLORS.keyText,
    fontSize: 22,
    fontWeight: '600',
  },
  deleteKey: {
    backgroundColor: COLORS.deleteKey,
    borderColor: '#6a3a3a',
  },
  confirmButton: {
    backgroundColor: '#166534',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#16a34a',
    marginTop: 4,
  },
  confirmButtonText: {
    color: COLORS.confirmText,
    fontSize: 18,
    fontWeight: '700',
  },
});

export default NumericKeypad;
