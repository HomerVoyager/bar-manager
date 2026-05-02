// ============================================================
// OrderScreen - 注文管理画面
// 横向きスプリットレイアウト: 左=注文明細 / 右=商品グリッド
// WebSocketでリアルタイム注文同期
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Session, Product, OrderItem, WebSocketMessage, RootStackParamList } from '../types';
import {
  getSession,
  getProducts,
  getCategories,
  addOrderItem,
  updateOrderItemQty,
  deleteOrderItem,
} from '../api/endpoints';
import { useWebSocket } from '../hooks/useWebSocket';
import OrderItemRow from '../components/OrderItemRow';
import ProductGrid from '../components/ProductGrid';

type OrderRouteProp = RouteProp<RootStackParamList, 'Order'>;
type OrderNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Order'>;

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
  danger: '#dc2626',
  checkoutGold: '#d97706',
};

const OrderScreen: React.FC = () => {
  const navigation = useNavigation<OrderNavigationProp>();
  const route = useRoute<OrderRouteProp>();
  const { sessionId, tableId, tableName } = route.params;

  const [session, setSession] = useState<Session | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  // 経過時間タイマー
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ==============================
  // WebSocket: リアルタイム注文同期
  // ==============================
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    // このセッションへの注文更新が来た場合のみ更新
    if (
      message.type === 'order_update' &&
      message.session_id === sessionId
    ) {
      console.log('注文更新受信: セッションをリロード');
      fetchSession();
    }
  }, [sessionId]);

  const { sendMessage } = useWebSocket(handleWebSocketMessage);

  // ==============================
  // データ取得
  // ==============================
  const fetchSession = useCallback(async () => {
    try {
      const data = await getSession(sessionId);
      setSession(data);

      // 経過時間の計算
      const start = new Date(data.start_time);
      const elapsed = Math.floor((Date.now() - start.getTime()) / 60000);
      setElapsedMinutes(elapsed);
    } catch (err) {
      console.error('セッション取得エラー:', err);
      Alert.alert('エラー', 'セッション情報の取得に失敗しました');
    }
  }, [sessionId]);

  const fetchProducts = useCallback(async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      // 最初のカテゴリを選択
      if (categoriesData.length > 0 && !selectedCategory) {
        setSelectedCategory(categoriesData[0]);
      }
    } catch (err) {
      console.error('商品取得エラー:', err);
    }
  }, [selectedCategory]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchSession(), fetchProducts()]);
      setIsLoading(false);
    };
    init();

    // 経過時間を1分ごとに更新
    elapsedTimer.current = setInterval(() => {
      setElapsedMinutes((prev) => prev + 1);
    }, 60000);

    return () => {
      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    };
  }, []);

  // ==============================
  // 商品を注文に追加
  // ==============================
  const handleAddProduct = useCallback(async (product: Product) => {
    if (isAddingItem) return;

    try {
      setIsAddingItem(true);

      // すでに同じ商品がある場合は数量を増やす
      const existingItem = session?.order_items.find(
        (item) => item.product_id === product.id
      );

      if (existingItem) {
        // 既存アイテムの数量を更新
        await updateOrderItemQty(existingItem.id, existingItem.quantity + 1);
      } else {
        // 新規アイテムを追加
        await addOrderItem({
          session_id: sessionId,
          product_id: product.id,
          quantity: 1,
        });
      }

      // セッションデータを更新
      await fetchSession();

      // WebSocketで注文更新を配信
      sendMessage({
        type: 'order_update',
        session_id: sessionId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('注文追加エラー:', err);
      Alert.alert('エラー', '注文の追加に失敗しました');
    } finally {
      setIsAddingItem(false);
    }
  }, [session, sessionId, isAddingItem, fetchSession, sendMessage]);

  // ==============================
  // 注文明細の数量を増やす
  // ==============================
  const handleIncreaseItem = useCallback(async (item: OrderItem) => {
    try {
      await updateOrderItemQty(item.id, item.quantity + 1);
      await fetchSession();
    } catch (err) {
      console.error('数量更新エラー:', err);
    }
  }, [fetchSession]);

  // ==============================
  // 注文明細の数量を減らす
  // ==============================
  const handleDecreaseItem = useCallback(async (item: OrderItem) => {
    try {
      if (item.quantity <= 1) {
        await deleteOrderItem(item.id);
      } else {
        await updateOrderItemQty(item.id, item.quantity - 1);
      }
      await fetchSession();
    } catch (err) {
      console.error('数量更新エラー:', err);
    }
  }, [fetchSession]);

  // ==============================
  // 注文明細を削除
  // ==============================
  const handleDeleteItem = useCallback(async (item: OrderItem) => {
    Alert.alert(
      '削除確認',
      `「${item.product_name}」を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOrderItem(item.id);
              await fetchSession();
            } catch (err) {
              console.error('注文削除エラー:', err);
            }
          },
        },
      ]
    );
  }, [fetchSession]);

  // ==============================
  // 会計画面へ遷移
  // ==============================
  const handleCheckout = useCallback(() => {
    if (!session || session.order_items.length === 0) {
      Alert.alert('注文がありません', '会計する前に商品を注文してください');
      return;
    }
    navigation.navigate('Checkout', {
      sessionId,
      tableId,
      tableName,
    });
  }, [session, sessionId, tableId, tableName, navigation]);

  // ==============================
  // 経過時間のフォーマット
  // ==============================
  const formatElapsed = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}分`;
  };

  // ==============================
  // レンダリング
  // ==============================
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>注文データを読み込み中...</Text>
      </View>
    );
  }

  const orderItems = session?.order_items || [];
  const totalAmount = session?.total_amount || 0;

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
          {tableName} - オーダー
        </Text>
        <View style={styles.headerRight}>
          <Text style={styles.elapsedTime}>
            ⏱ {formatElapsed(elapsedMinutes)}
          </Text>
          <Text style={styles.guestCount}>
            👥 {session?.guest_count || 0}名
          </Text>
        </View>
      </View>

      {/* メインコンテンツ（横向きスプリットレイアウト） */}
      <View style={styles.mainContent}>

        {/* 左パネル: 注文明細 */}
        <View style={styles.leftPanel}>
          {/* テーブル情報 */}
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionInfoText}>
              セッション #{sessionId}
            </Text>
            <Text style={styles.sessionInfoText}>
              開始: {session ? new Date(session.start_time).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
              }) : '--:--'}
            </Text>
          </View>

          {/* 注文明細リスト */}
          <FlatList
            style={styles.orderList}
            data={orderItems}
            renderItem={({ item }) => (
              <OrderItemRow
                item={item}
                onIncrease={handleIncreaseItem}
                onDecrease={handleDecreaseItem}
                onDelete={handleDeleteItem}
              />
            )}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={
              <View style={styles.emptyOrderContainer}>
                <Text style={styles.emptyOrderText}>
                  注文がありません
                </Text>
                <Text style={styles.emptyOrderSubtext}>
                  右側から商品を選択してください
                </Text>
              </View>
            }
          />

          {/* 小計と会計ボタン */}
          <View style={styles.orderFooter}>
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>小計（税込）</Text>
              <Text style={styles.subtotalAmount}>
                ¥{totalAmount.toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.checkoutButton,
                orderItems.length === 0 && styles.checkoutButtonDisabled,
              ]}
              onPress={handleCheckout}
              disabled={orderItems.length === 0}
            >
              <Text style={styles.checkoutButtonText}>会計 💴</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 右パネル: 商品グリッド */}
        <View style={styles.rightPanel}>
          {/* カテゴリフィルタータブ */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {/* 全商品タブ */}
            <TouchableOpacity
              style={[
                styles.categoryTab,
                !selectedCategory && styles.categoryTabActive,
              ]}
              onPress={() => setSelectedCategory(undefined)}
            >
              <Text style={[
                styles.categoryTabText,
                !selectedCategory && styles.categoryTabTextActive,
              ]}>
                すべて
              </Text>
            </TouchableOpacity>

            {/* カテゴリタブ */}
            {categories.map((cat) => (
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

          {/* 商品グリッド */}
          {isAddingItem && (
            <View style={styles.addingOverlay}>
              <ActivityIndicator color={COLORS.accent} size="small" />
            </View>
          )}
          <ProductGrid
            products={products}
            onSelect={handleAddProduct}
            category={selectedCategory}
            style={styles.productGrid}
          />
        </View>
      </View>
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
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  elapsedTime: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  guestCount: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  // メインコンテンツ（横2分割）
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  // 左パネル（注文明細）
  leftPanel: {
    width: '38%',
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    flexDirection: 'column',
  },
  sessionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sessionInfoText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  orderList: {
    flex: 1,
  },
  emptyOrderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyOrderText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyOrderSubtext: {
    color: COLORS.textSecondary,
    fontSize: 13,
    opacity: 0.7,
  },
  // 注文フッター
  orderFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 12,
    gap: 10,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtotalLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  subtotalAmount: {
    color: COLORS.accent,
    fontSize: 22,
    fontWeight: '800',
  },
  checkoutButton: {
    backgroundColor: COLORS.checkoutGold,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    backgroundColor: '#4a3000',
    opacity: 0.5,
  },
  checkoutButtonText: {
    color: '#1a1a2e',
    fontSize: 17,
    fontWeight: '800',
  },
  // 右パネル（商品グリッド）
  rightPanel: {
    flex: 1,
    flexDirection: 'column',
  },
  // カテゴリタブ
  categoryTabs: {
    maxHeight: 48,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryTabsContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e1e3e',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryTabActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  categoryTabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTabTextActive: {
    color: '#1a1a2e',
  },
  productGrid: {
    flex: 1,
  },
  addingOverlay: {
    position: 'absolute',
    top: 48,
    right: 10,
    zIndex: 10,
    backgroundColor: 'rgba(15,15,26,0.8)',
    borderRadius: 8,
    padding: 6,
  },
});

export default OrderScreen;
