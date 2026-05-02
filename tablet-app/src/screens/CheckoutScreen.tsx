// ============================================================
// CheckoutScreen - 会計画面
// セッション合計の確認、現金受取・お釣り計算、割り勘計算
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Session, OrderItem, RootStackParamList } from '../types';
import { getSession, closeSession } from '../api/endpoints';
import NumericKeypad from '../components/NumericKeypad';

type CheckoutRouteProp = RouteProp<RootStackParamList, 'Checkout'>;
type CheckoutNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Checkout'>;

// テーマカラー
const COLORS = {
  background: '#0f0f1a',
  surface: '#1a1a2e',
  surfaceAlt: '#16213e',
  border: '#2a2a4e',
  accent: '#f59e0b',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  success: '#16a34a',
  successBg: '#052e16',
  danger: '#dc2626',
  gold: '#fcd34d',
  changePositive: '#4ade80',
};

// お会計モード
type PaymentMode = 'full' | 'split';

const CheckoutScreen: React.FC = () => {
  const navigation = useNavigation<CheckoutNavigationProp>();
  const route = useRoute<CheckoutRouteProp>();
  const { sessionId, tableId, tableName } = route.params;

  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  // 支払い関連のstate
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full');
  const [cashReceived, setCashReceived] = useState('');
  const [splitCount, setSplitCount] = useState('');
  const [showCashKeypad, setShowCashKeypad] = useState(false);
  const [showSplitKeypad, setShowSplitKeypad] = useState(false);

  // 会計完了後のレシートプレビュー
  const [showReceipt, setShowReceipt] = useState(false);
  const [closedSession, setClosedSession] = useState<Session | null>(null);

  // ==============================
  // データ取得
  // ==============================
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await getSession(sessionId);
        setSession(data);
      } catch (err) {
        console.error('セッション取得エラー:', err);
        Alert.alert('エラー', 'セッション情報の取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [sessionId]);

  // ==============================
  // 計算ロジック
  // ==============================
  const totalAmount = session?.total_amount || 0;

  // お釣り計算
  const cashAmount = parseFloat(cashReceived) || 0;
  const changeAmount = cashAmount - totalAmount;

  // 割り勘の1人分
  const splitNumber = parseInt(splitCount, 10) || 1;
  const perPersonAmount = Math.ceil(totalAmount / splitNumber);

  // ==============================
  // 会計を閉じる処理
  // ==============================
  const handleCloseSession = useCallback(async () => {
    if (!session) return;

    // 現金支払いの場合、受取金額の確認
    if (cashReceived && cashAmount < totalAmount) {
      Alert.alert(
        '金額不足',
        `受取金額が合計金額より少ないです。\n合計: ¥${totalAmount.toLocaleString()}\n受取: ¥${cashAmount.toLocaleString()}`
      );
      return;
    }

    Alert.alert(
      '会計を閉じますか？',
      `${tableName}の会計を完了します。\n合計: ¥${totalAmount.toLocaleString()}`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '会計確定',
          onPress: async () => {
            try {
              setIsClosing(true);
              const closed = await closeSession(sessionId, {
                payment_method: 'cash',
                cash_received: cashAmount || undefined,
              });
              setClosedSession(closed);
              setShowReceipt(true);
            } catch (err) {
              console.error('会計クローズエラー:', err);
              Alert.alert('エラー', '会計の処理に失敗しました');
            } finally {
              setIsClosing(false);
            }
          },
        },
      ]
    );
  }, [session, sessionId, tableName, totalAmount, cashReceived, cashAmount]);

  // 会計完了後にテーブルマップに戻る
  const handleReceiptClose = useCallback(() => {
    setShowReceipt(false);
    navigation.navigate('TableMap');
  }, [navigation]);

  // ==============================
  // レシートプレビュー（テキスト形式）
  // ==============================
  const renderReceipt = () => {
    const s = closedSession || session;
    if (!s) return null;

    const receiptDate = new Date().toLocaleString('ja-JP');
    const items = s.order_items;

    return (
      <Modal
        visible={showReceipt}
        transparent={true}
        animationType="slide"
        onRequestClose={handleReceiptClose}
      >
        <View style={styles.receiptOverlay}>
          <View style={styles.receiptContainer}>
            <ScrollView>
              {/* レシートヘッダー */}
              <Text style={styles.receiptStoreName}>🍺 Bar Manager</Text>
              <Text style={styles.receiptDivider}>{'─'.repeat(28)}</Text>
              <Text style={styles.receiptLine}>{tableName}  {s.guest_count}名様</Text>
              <Text style={styles.receiptLine}>{receiptDate}</Text>
              <Text style={styles.receiptDivider}>{'─'.repeat(28)}</Text>

              {/* 注文明細 */}
              {items.map((item) => (
                <View key={item.id} style={styles.receiptItemRow}>
                  <Text style={styles.receiptItemName} numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <Text style={styles.receiptItemRight}>
                    {item.quantity} × ¥{item.unit_price.toLocaleString()}
                  </Text>
                  <Text style={styles.receiptItemSubtotal}>
                    ¥{item.subtotal.toLocaleString()}
                  </Text>
                </View>
              ))}

              <Text style={styles.receiptDivider}>{'─'.repeat(28)}</Text>

              {/* 合計 */}
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptTotalLabel}>合計（税込）</Text>
                <Text style={styles.receiptTotalAmount}>
                  ¥{totalAmount.toLocaleString()}
                </Text>
              </View>

              {/* お釣り */}
              {cashReceived && changeAmount >= 0 && (
                <>
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptSubLabel}>お預かり</Text>
                    <Text style={styles.receiptSubAmount}>
                      ¥{cashAmount.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptSubLabel}>お釣り</Text>
                    <Text style={styles.receiptChangeAmount}>
                      ¥{changeAmount.toLocaleString()}
                    </Text>
                  </View>
                </>
              )}

              <Text style={styles.receiptDivider}>{'─'.repeat(28)}</Text>
              <Text style={styles.receiptFooter}>
                ありがとうございました
              </Text>
              <Text style={styles.receiptFooterSmall}>
                またのご来店をお待ちしております
              </Text>
            </ScrollView>

            {/* 閉じるボタン */}
            <TouchableOpacity
              style={styles.receiptCloseButton}
              onPress={handleReceiptClose}
            >
              <Text style={styles.receiptCloseButtonText}>
                テーブルマップへ戻る
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ==============================
  // ローディング
  // ==============================
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>会計情報を読み込み中...</Text>
      </View>
    );
  }

  const items = session?.order_items || [];

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textSecondary} />
          <Text style={styles.backButtonText}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          💴 {tableName} - 会計
        </Text>
        <Text style={styles.headerSubtitle}>
          {session?.guest_count}名 / セッション #{sessionId}
        </Text>
      </View>

      {/* メインコンテンツ（横向き2分割） */}
      <View style={styles.mainContent}>

        {/* 左側: 注文明細サマリー */}
        <View style={styles.leftPanel}>
          <Text style={styles.panelTitle}>注文明細</Text>
          <ScrollView style={styles.itemList}>
            {items.map((item) => (
              <View key={item.id} style={styles.summaryItemRow}>
                <Text style={styles.summaryItemQty}>×{item.quantity}</Text>
                <Text style={styles.summaryItemName} numberOfLines={1}>
                  {item.product_name}
                </Text>
                <Text style={styles.summaryItemSubtotal}>
                  ¥{item.subtotal.toLocaleString()}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* 合計金額 */}
          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>合計（税込）</Text>
              <Text style={styles.totalAmount}>
                ¥{totalAmount.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* 右側: 支払い処理 */}
        <View style={styles.rightPanel}>
          {/* 支払いモード切替 */}
          <View style={styles.paymentModeSelector}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                paymentMode === 'full' && styles.modeButtonActive,
              ]}
              onPress={() => setPaymentMode('full')}
            >
              <Text style={[
                styles.modeButtonText,
                paymentMode === 'full' && styles.modeButtonTextActive,
              ]}>
                一括支払い
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                paymentMode === 'split' && styles.modeButtonActive,
              ]}
              onPress={() => setPaymentMode('split')}
            >
              <Text style={[
                styles.modeButtonText,
                paymentMode === 'split' && styles.modeButtonTextActive,
              ]}>
                割り勘
              </Text>
            </TouchableOpacity>
          </View>

          {/* 割り勘モードの場合 */}
          {paymentMode === 'split' && (
            <View style={styles.splitSection}>
              <Text style={styles.sectionLabel}>分割人数</Text>
              <TouchableOpacity
                style={styles.amountInput}
                onPress={() => {
                  setShowSplitKeypad(true);
                  setShowCashKeypad(false);
                }}
              >
                <Text style={styles.amountInputText}>
                  {splitCount ? `${splitCount}人` : '人数を入力'}
                </Text>
              </TouchableOpacity>
              {splitCount && (
                <View style={styles.splitResultBox}>
                  <Text style={styles.splitResultLabel}>1人あたり</Text>
                  <Text style={styles.splitResultAmount}>
                    ¥{perPersonAmount.toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* 現金受取入力 */}
          <View style={styles.cashSection}>
            <Text style={styles.sectionLabel}>
              お預かり金額
            </Text>
            <TouchableOpacity
              style={[
                styles.amountInput,
                showCashKeypad && styles.amountInputFocused,
              ]}
              onPress={() => {
                setShowCashKeypad(true);
                setShowSplitKeypad(false);
              }}
            >
              <Text style={[
                styles.amountInputText,
                cashReceived ? styles.amountInputValueText : styles.amountInputPlaceholder,
              ]}>
                {cashReceived ? `¥${parseFloat(cashReceived).toLocaleString()}` : '¥ 金額を入力'}
              </Text>
            </TouchableOpacity>

            {/* お釣り表示 */}
            {cashReceived && (
              <View style={[
                styles.changeDisplay,
                changeAmount < 0 ? styles.changeInsufficient : styles.changeSufficient,
              ]}>
                <Text style={styles.changeLabel}>
                  {changeAmount < 0 ? '不足金額' : 'お釣り'}
                </Text>
                <Text style={[
                  styles.changeAmount,
                  changeAmount < 0 ? styles.changeNegative : styles.changePositive,
                ]}>
                  ¥{Math.abs(changeAmount).toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          {/* テンキー（展開式） */}
          {(showCashKeypad || showSplitKeypad) && (
            <View style={styles.keypadContainer}>
              <TouchableOpacity
                style={styles.keypadCloseRow}
                onPress={() => {
                  setShowCashKeypad(false);
                  setShowSplitKeypad(false);
                }}
              >
                <Text style={styles.keypadCloseText}>▲ テンキーを閉じる</Text>
              </TouchableOpacity>
              <NumericKeypad
                value={showCashKeypad ? cashReceived : splitCount}
                onValueChange={showCashKeypad ? setCashReceived : setSplitCount}
                maxLength={showCashKeypad ? 7 : 2}
                showConfirm={false}
              />
            </View>
          )}

          {/* 会計確定ボタン */}
          <View style={styles.closeButtonSection}>
            <TouchableOpacity
              style={[
                styles.closeButton,
                isClosing && styles.closeButtonDisabled,
              ]}
              onPress={handleCloseSession}
              disabled={isClosing}
            >
              {isClosing ? (
                <ActivityIndicator color="#1a1a2e" size="small" />
              ) : (
                <Text style={styles.closeButtonText}>
                  会計を閉じる ✓
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* レシートプレビューモーダル */}
      {renderReceipt()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  // ヘッダー
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
  },
  backButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.accent,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  // メインコンテンツ（2分割）
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  // 左パネル（注文明細）
  leftPanel: {
    width: '42%',
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    flexDirection: 'column',
  },
  panelTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  itemList: {
    flex: 1,
  },
  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  summaryItemQty: {
    color: COLORS.textSecondary,
    fontSize: 14,
    width: 36,
  },
  summaryItemName: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  summaryItemSubtotal: {
    color: COLORS.gold,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 80,
    textAlign: 'right',
  },
  totalSection: {
    padding: 14,
    borderTopWidth: 2,
    borderTopColor: COLORS.accent,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  totalAmount: {
    color: COLORS.accent,
    fontSize: 28,
    fontWeight: '800',
  },
  // 右パネル（支払い処理）
  rightPanel: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  // 支払いモード選択
  paymentModeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e1e3e',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  modeButtonText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#1a1a2e',
  },
  // 割り勘
  splitSection: {
    gap: 8,
  },
  splitResultBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#052e16',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  splitResultLabel: {
    color: '#86efac',
    fontSize: 14,
    fontWeight: '600',
  },
  splitResultAmount: {
    color: '#4ade80',
    fontSize: 22,
    fontWeight: '800',
  },
  // 現金入力
  cashSection: {
    gap: 8,
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 2,
  },
  amountInput: {
    backgroundColor: '#0f0f1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  amountInputFocused: {
    borderColor: COLORS.accent,
  },
  amountInputText: {
    fontSize: 18,
    fontWeight: '700',
  },
  amountInputValueText: {
    color: COLORS.textPrimary,
  },
  amountInputPlaceholder: {
    color: COLORS.textSecondary,
    fontWeight: '400',
    fontSize: 15,
  },
  // お釣り表示
  changeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  changeSufficient: {
    backgroundColor: '#052e16',
    borderColor: '#16a34a',
  },
  changeInsufficient: {
    backgroundColor: '#450a0a',
    borderColor: '#dc2626',
  },
  changeLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  changeAmount: {
    fontSize: 22,
    fontWeight: '800',
  },
  changePositive: {
    color: COLORS.changePositive,
  },
  changeNegative: {
    color: '#f87171',
  },
  // テンキーコンテナ
  keypadContainer: {
    gap: 6,
  },
  keypadCloseRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  keypadCloseText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  // 会計確定ボタン
  closeButtonSection: {
    marginTop: 'auto',
  },
  closeButton: {
    backgroundColor: '#166534',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  closeButtonDisabled: {
    opacity: 0.5,
  },
  closeButtonText: {
    color: '#4ade80',
    fontSize: 18,
    fontWeight: '800',
  },
  // レシートモーダル
  receiptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptContainer: {
    backgroundColor: '#fefce8',
    borderRadius: 12,
    padding: 20,
    width: 340,
    maxHeight: '85%',
  },
  receiptStoreName: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  receiptDivider: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginVertical: 6,
  },
  receiptLine: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
    marginVertical: 2,
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 6,
  },
  receiptItemName: {
    flex: 1,
    fontSize: 13,
    color: '#1f2937',
  },
  receiptItemRight: {
    fontSize: 12,
    color: '#6b7280',
    minWidth: 80,
    textAlign: 'right',
  },
  receiptItemSubtotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    minWidth: 70,
    textAlign: 'right',
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  receiptTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2937',
  },
  receiptTotalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2937',
  },
  receiptSubLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  receiptSubAmount: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  receiptChangeAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
  },
  receiptFooter: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginTop: 8,
  },
  receiptFooterSmall: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 8,
  },
  receiptCloseButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  receiptCloseButtonText: {
    color: '#1a1a2e',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default CheckoutScreen;
