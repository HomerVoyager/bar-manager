// ============================================================
// TableMapScreen - テーブルマップ画面
// 全テーブルをグリッド表示、リアルタイム更新
// WebSocket接続でテーブル状態を自動更新
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Table, Session, WebSocketMessage, RootStackParamList } from '../types';
import { getTables, createSession, getActiveSessions } from '../api/endpoints';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';
import TableCard from '../components/TableCard';
import NumericKeypad from '../components/NumericKeypad';

type TableMapNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TableMap'>;

// テーマカラー
const COLORS = {
  background: '#0f0f1a',
  surface: '#1a1a2e',
  border: '#2a2a4e',
  accent: '#f59e0b',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  danger: '#dc2626',
  success: '#16a34a',
};

// テーブルカードのサイズ（横向き4列）
const NUM_COLUMNS = 4;

// セッション情報のキャッシュ型
interface SessionMap {
  [tableId: number]: Session;
}

const TableMapScreen: React.FC = () => {
  const navigation = useNavigation<TableMapNavigationProp>();
  const { staff, logout } = useAuth();

  const [tables, setTables] = useState<Table[]>([]);
  const [sessions, setSessions] = useState<SessionMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 新規セッション開始ダイアログ用state
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [guestCountInput, setGuestCountInput] = useState('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // 時計の更新タイマー
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // 自動更新タイマー（10秒ごと）
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ==============================
  // WebSocket: リアルタイム更新
  // ==============================
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'table_update' || message.type === 'session_update') {
      // テーブル/セッション変更時は全データをリフレッシュ
      console.log('WebSocket更新受信: テーブルデータをリロード');
      fetchAllData();
    }
  }, []);

  const { status: wsStatus, reconnect: wsReconnect } = useWebSocket(handleWebSocketMessage);

  // ==============================
  // データ取得
  // ==============================
  const fetchAllData = useCallback(async () => {
    try {
      const [tablesData, sessionsData] = await Promise.all([
        getTables(),
        getActiveSessions(),
      ]);

      setTables(tablesData);

      // アクティブなセッションをテーブルIDでマッピング
      const sessionMap: SessionMap = {};
      sessionsData.forEach((session) => {
        sessionMap[session.table_id] = session;
      });
      setSessions(sessionMap);
    } catch (err) {
      console.error('テーブルデータ取得エラー:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // 初回ロード
  useEffect(() => {
    fetchAllData();

    // 時計の更新（1秒ごと）
    clockTimer.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // 自動リフレッシュ（10秒ごと）
    autoRefreshTimer.current = setInterval(() => {
      fetchAllData();
    }, 10000);

    return () => {
      if (clockTimer.current) clearInterval(clockTimer.current);
      if (autoRefreshTimer.current) clearInterval(autoRefreshTimer.current);
    };
  }, [fetchAllData]);

  // プルダウンリフレッシュ
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAllData();
  }, [fetchAllData]);

  // ==============================
  // テーブルタップ処理
  // ==============================
  const handleTablePress = useCallback((table: Table) => {
    if (table.status === 'occupied' && table.session_id) {
      // 使用中テーブル: オーダー画面へ
      navigation.navigate('Order', {
        sessionId: table.session_id,
        tableId: table.id,
        tableName: table.name,
      });
    } else if (table.status === 'empty') {
      // 空席: 新規セッション開始ダイアログを表示
      setSelectedTable(table);
      setGuestCountInput('');
      setShowNewSessionModal(true);
    } else if (table.status === 'reserved') {
      Alert.alert(
        '予約テーブル',
        `${table.name}は予約中です。チェックインしますか？`,
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: 'チェックイン',
            onPress: () => {
              setSelectedTable(table);
              setGuestCountInput('');
              setShowNewSessionModal(true);
            },
          },
        ]
      );
    }
  }, [navigation]);

  // ==============================
  // 新規セッション作成
  // ==============================
  const handleCreateSession = useCallback(async () => {
    if (!selectedTable) return;

    const guestCount = parseInt(guestCountInput, 10);
    if (!guestCountInput || isNaN(guestCount) || guestCount < 1) {
      Alert.alert('入力エラー', '人数を1名以上で入力してください');
      return;
    }

    try {
      setIsCreatingSession(true);
      const session = await createSession({
        table_id: selectedTable.id,
        guest_count: guestCount,
      });

      setShowNewSessionModal(false);
      setSelectedTable(null);
      setGuestCountInput('');

      // データ更新
      await fetchAllData();

      // オーダー画面へ遷移
      navigation.navigate('Order', {
        sessionId: session.id,
        tableId: selectedTable.id,
        tableName: selectedTable.name,
      });
    } catch (err) {
      Alert.alert('エラー', 'セッションの開始に失敗しました');
      console.error('セッション作成エラー:', err);
    } finally {
      setIsCreatingSession(false);
    }
  }, [selectedTable, guestCountInput, fetchAllData, navigation]);

  // ==============================
  // 経過時間の計算
  // ==============================
  const getElapsedMinutes = useCallback((session: Session): number => {
    const start = new Date(session.start_time);
    return Math.floor((currentTime.getTime() - start.getTime()) / 60000);
  }, [currentTime]);

  // ==============================
  // ログアウト確認
  // ==============================
  const handleLogout = () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしてよろしいですか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  // ==============================
  // テーブルカードのレンダリング
  // ==============================
  const renderTable = ({ item }: { item: Table }) => {
    const session = sessions[item.id];
    return (
      <TableCard
        table={item}
        onPress={handleTablePress}
        elapsedMinutes={session ? getElapsedMinutes(session) : undefined}
        guestCount={session?.guest_count}
        totalAmount={session?.total_amount}
        style={styles.tableCard}
      />
    );
  };

  // ==============================
  // UI レンダリング
  // ==============================
  return (
    <View style={styles.container}>

      {/* トップバー */}
      <View style={styles.topBar}>
        {/* 左: タイトル */}
        <View style={styles.topBarLeft}>
          <Text style={styles.topBarTitle}>🍺 バー管理</Text>
          {/* WebSocket接続状態インジケーター */}
          <View style={[
            styles.wsIndicator,
            wsStatus === 'connected' ? styles.wsConnected : styles.wsDisconnected,
          ]}>
            <Text style={styles.wsIndicatorText}>
              {wsStatus === 'connected' ? 'LIVE' : wsStatus === 'connecting' ? '接続中...' : 'オフライン'}
            </Text>
          </View>
        </View>

        {/* 中央: 現在時刻 */}
        <Text style={styles.currentTime}>
          {currentTime.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </Text>

        {/* 右: スタッフ名、更新ボタン、ログアウト */}
        <View style={styles.topBarRight}>
          <Text style={styles.staffName}>
            {staff?.full_name || staff?.username || 'スタッフ'}
          </Text>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>ログアウト</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* テーブルグリッド */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>テーブル情報を読み込み中...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.grid}
          contentContainerStyle={styles.gridContent}
          data={tables}
          renderItem={renderTable}
          keyExtractor={(item) => item.id.toString()}
          numColumns={NUM_COLUMNS}
          key={`tables-${NUM_COLUMNS}`}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>テーブルが登録されていません</Text>
            </View>
          }
        />
      )}

      {/* ステータスバー（下部） */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          稼働中: {tables.filter(t => t.status === 'occupied').length} /
          総テーブル: {tables.length}
        </Text>
        <Text style={styles.statusText}>
          日付: {currentTime.toLocaleDateString('ja-JP')}
        </Text>
        {wsStatus !== 'connected' && (
          <TouchableOpacity onPress={wsReconnect}>
            <Text style={styles.reconnectText}>再接続する</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 新規セッション開始モーダル */}
      <Modal
        visible={showNewSessionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNewSessionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* モーダルヘッダー */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedTable?.name} - 新規来客
              </Text>
              <TouchableOpacity
                onPress={() => setShowNewSessionModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 人数入力 */}
            <View style={styles.modalContent}>
              {/* 入力値表示 */}
              <View style={styles.guestCountDisplay}>
                <Text style={styles.guestCountLabel}>人数</Text>
                <Text style={styles.guestCountValue}>
                  {guestCountInput || '0'} 名
                </Text>
              </View>

              {/* テンキー */}
              <NumericKeypad
                value={guestCountInput}
                onValueChange={setGuestCountInput}
                maxLength={2}
                showConfirm={false}
              />

              {/* 確定ボタン */}
              <TouchableOpacity
                style={[
                  styles.startButton,
                  (!guestCountInput || isCreatingSession) && styles.startButtonDisabled,
                ]}
                onPress={handleCreateSession}
                disabled={!guestCountInput || isCreatingSession}
              >
                {isCreatingSession ? (
                  <ActivityIndicator color="#1a1a2e" size="small" />
                ) : (
                  <Text style={styles.startButtonText}>
                    入店 / オーダー開始
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // トップバー
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 1,
  },
  wsIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  wsConnected: {
    backgroundColor: '#052e16',
  },
  wsDisconnected: {
    backgroundColor: '#450a0a',
  },
  wsIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  currentTime: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
    flex: 1,
    textAlign: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    justifyContent: 'flex-end',
  },
  staffName: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  iconButton: {
    padding: 6,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoutButtonText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  // グリッド
  grid: {
    flex: 1,
  },
  gridContent: {
    padding: 12,
    gap: 0,
  },
  tableCard: {
    flex: 1,
    margin: 6,
  },
  // ローディング
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  // 空状態
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  // ステータスバー（下部）
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  reconnectText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  // 新規セッションモーダル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    width: 380,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.accent,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
    gap: 16,
  },
  guestCountDisplay: {
    backgroundColor: '#0f0f1a',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  guestCountLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 4,
  },
  guestCountValue: {
    color: COLORS.accent,
    fontSize: 40,
    fontWeight: '800',
  },
  startButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#78350f',
    opacity: 0.6,
  },
  startButtonText: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: '800',
  },
});

export default TableMapScreen;
