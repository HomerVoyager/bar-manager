// ============================================================
// AttendanceScreen - 勤怠打刻画面
// 出勤/退勤打刻、スタッフ選択、顔認証Androidアプリ連携
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 顔認証Androidアプリ連携用
// expo-intent-launcher を使って外部顔認証アプリを起動する
import * as IntentLauncher from 'expo-intent-launcher';

import { Staff, Attendance } from '../types';
import {
  recordAttendance,
  getTodayAttendance,
  getStaffList,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';

// テーマカラー
const COLORS = {
  background: '#0f0f1a',
  surface: '#1a1a2e',
  border: '#2a2a4e',
  accent: '#f59e0b',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  clockInGreen: '#16a34a',
  clockInBg: '#052e16',
  clockInBorder: '#22c55e',
  clockOutRed: '#dc2626',
  clockOutBg: '#450a0a',
  clockOutBorder: '#f87171',
  flashGreen: 'rgba(74,222,128,0.3)',
};

// 顔認証アプリのIntent定数
// Android外部アプリとの連携インターフェース
const FACE_AUTH_ACTION = 'com.barmanager.FACE_AUTH';
const FACE_AUTH_EXTRA_STAFF_ID = 'staff_id';
const FACE_AUTH_EXTRA_ACTION = 'action';
const FACE_AUTH_RESULT_SUCCESS = 'success';
const FACE_AUTH_RESULT_STAFF_ID = 'staff_id';

const AttendanceScreen: React.FC = () => {
  const { staff: currentStaff } = useAuth();

  const [todayAttendances, setTodayAttendances] = useState<Attendance[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClocking, setIsClocking] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [faceAuthLoading, setFaceAuthLoading] = useState(false);

  // 打刻成功時のフラッシュアニメーション
  const flashAnim = useRef(new Animated.Value(0)).current;

  // 時計タイマー
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // 自動更新タイマー（30秒ごと）
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ==============================
  // データ取得
  // ==============================
  const fetchData = useCallback(async () => {
    try {
      const [attendances, staff] = await Promise.all([
        getTodayAttendance(),
        getStaffList(),
      ]);
      setTodayAttendances(attendances);
      setStaffList(staff);

      // デフォルトで自分自身を選択
      if (currentStaff && !selectedStaff) {
        const self = staff.find((s) => s.id === currentStaff.id);
        if (self) setSelectedStaff(self);
      }
    } catch (err) {
      console.error('勤怠データ取得エラー:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentStaff, selectedStaff]);

  useEffect(() => {
    fetchData();

    // 時計の更新（1秒ごと）
    clockTimer.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // 自動リフレッシュ（30秒ごと）
    refreshTimer.current = setInterval(fetchData, 30000);

    return () => {
      if (clockTimer.current) clearInterval(clockTimer.current);
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, []);

  // ==============================
  // フラッシュアニメーション
  // 打刻成功時に緑色のフラッシュを表示する
  // ==============================
  const playFlashAnimation = useCallback(() => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 1200,
      useNativeDriver: true,
    }).start();
  }, [flashAnim]);

  // ==============================
  // 打刻処理（通常）
  // ==============================
  const handleClock = useCallback(async (action: 'clock_in' | 'clock_out') => {
    if (!selectedStaff) {
      Alert.alert('スタッフ未選択', '打刻するスタッフを選択してください');
      return;
    }

    const actionLabel = action === 'clock_in' ? '出勤' : '退勤';

    Alert.alert(
      `${actionLabel}打刻`,
      `${selectedStaff.full_name} の${actionLabel}を記録します`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: `${actionLabel}する`,
          onPress: async () => {
            try {
              setIsClocking(true);
              await recordAttendance({
                staff_id: selectedStaff.id,
                action,
                face_verified: false,
              });

              playFlashAnimation();
              Alert.alert(
                `${actionLabel}完了`,
                `${selectedStaff.full_name} の${actionLabel}を記録しました\n${currentTime.toLocaleTimeString('ja-JP')}`
              );
              await fetchData();
            } catch (err) {
              console.error('打刻エラー:', err);
              Alert.alert('エラー', '打刻に失敗しました');
            } finally {
              setIsClocking(false);
            }
          },
        },
      ]
    );
  }, [selectedStaff, currentTime, fetchData, playFlashAnimation]);

  // ==============================
  // 顔認証Androidアプリ連携
  // ==============================
  // 顔認証アプリのIntent仕様:
  //   Action: com.barmanager.FACE_AUTH
  //   Extra (送信): staff_id (int), action (String: "clock_in" | "clock_out")
  //   Extra (受信): success (boolean), staff_id (int)
  //
  // 使い方:
  //   1. 顔認証アプリがインストールされていること
  //   2. launchFaceAuth() を呼び出すと顔認証画面が起動する
  //   3. 認証成功時、staff_id が返ってきて自動打刻される
  //   4. Android以外のプラットフォームでは無効化される
  // ==============================
  const launchFaceAuth = useCallback(async (action: 'clock_in' | 'clock_out') => {
    // Androidのみ対応
    if (Platform.OS !== 'android') {
      Alert.alert(
        '未対応',
        '顔認証はAndroid端末でのみ利用できます'
      );
      return;
    }

    try {
      setFaceAuthLoading(true);
      console.log(`顔認証アプリ起動: action=${action}`);

      // expo-intent-launcherで外部顔認証アプリを起動する
      // IntentLauncher.startActivityAsync でIntentを送信し、結果を受け取る
      const result = await IntentLauncher.startActivityAsync(FACE_AUTH_ACTION, {
        extra: {
          // 打刻アクション（"clock_in" または "clock_out"）
          [FACE_AUTH_EXTRA_ACTION]: action,
          // スタッフIDが選択されていれば送信（特定スタッフの顔認証）
          ...(selectedStaff ? { [FACE_AUTH_EXTRA_STAFF_ID]: selectedStaff.id } : {}),
        },
      });

      console.log('顔認証アプリ結果:', result);

      // 結果の処理
      // result.extra に success と staff_id が含まれる
      const extra = result.extra as Record<string, unknown> | undefined;
      const success = extra?.[FACE_AUTH_RESULT_SUCCESS] as boolean | undefined;
      const staffId = extra?.[FACE_AUTH_RESULT_STAFF_ID] as number | undefined;

      if (result.resultCode === IntentLauncher.ResultCode.Success && success && staffId) {
        // 顔認証成功: 取得したstaff_idで打刻処理
        await recordAttendance({
          staff_id: staffId,
          action,
          face_verified: true,  // 顔認証済みフラグ
        });

        playFlashAnimation();

        // 打刻したスタッフ名を表示
        const verifiedStaff = staffList.find((s) => s.id === staffId);
        const actionLabel = action === 'clock_in' ? '出勤' : '退勤';
        Alert.alert(
          `顔認証 ${actionLabel}完了`,
          `${verifiedStaff?.full_name || `スタッフID: ${staffId}`} の${actionLabel}を記録しました（顔認証）\n${new Date().toLocaleTimeString('ja-JP')}`
        );

        await fetchData();
      } else if (result.resultCode === IntentLauncher.ResultCode.Canceled) {
        // キャンセル
        console.log('顔認証がキャンセルされました');
      } else {
        // 認証失敗
        Alert.alert(
          '顔認証失敗',
          '顔の認証に失敗しました。もう一度試すか、通常打刻を使用してください'
        );
      }
    } catch (err: unknown) {
      console.error('顔認証アプリ起動エラー:', err);

      // ActivityNotFoundException: 顔認証アプリが未インストール
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorMessage.includes('ActivityNotFoundException') || errorMessage.includes('No Activity')) {
        Alert.alert(
          '顔認証アプリが見つかりません',
          '顔認証アプリがインストールされていません。\n通常打刻を使用してください。'
        );
      } else {
        Alert.alert('エラー', '顔認証アプリの起動に失敗しました');
      }
    } finally {
      setFaceAuthLoading(false);
    }
  }, [selectedStaff, staffList, fetchData, playFlashAnimation]);

  // ==============================
  // 今日の勤怠から現在の状態を取得
  // ==============================
  const getStaffStatus = (staffId: number): 'clocked_in' | 'clocked_out' | 'not_clocked' => {
    const attendance = todayAttendances.find((a) => a.staff_id === staffId);
    if (!attendance) return 'not_clocked';
    if (attendance.clock_out) return 'clocked_out';
    return 'clocked_in';
  };

  // 勤務時間の表示
  const formatWorkHours = (hours?: number): string => {
    if (!hours) return '--';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}時間${m}分`;
  };

  // ==============================
  // レンダリング
  // ==============================
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>勤怠データを読み込み中...</Text>
      </View>
    );
  }

  const selectedStatus = selectedStaff ? getStaffStatus(selectedStaff.id) : 'not_clocked';

  return (
    <View style={styles.container}>
      {/* フラッシュアニメーションオーバーレイ（打刻成功時） */}
      <Animated.View
        style={[
          styles.flashOverlay,
          { opacity: flashAnim },
        ]}
        pointerEvents="none"
      />

      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⏱ 勤怠打刻</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchData}
        >
          <Ionicons name="refresh" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* メインコンテンツ */}
      <View style={styles.mainContent}>

        {/* 左パネル: 打刻エリア */}
        <View style={styles.leftPanel}>
          {/* 現在時刻（大きく表示） */}
          <View style={styles.clockDisplay}>
            <Text style={styles.clockTime}>
              {currentTime.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </Text>
            <Text style={styles.clockDate}>
              {currentTime.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </Text>
          </View>

          {/* スタッフ選択 */}
          <TouchableOpacity
            style={styles.staffSelector}
            onPress={() => setShowStaffPicker(true)}
          >
            <Ionicons name="person" size={18} color={COLORS.accent} />
            <Text style={styles.staffSelectorText}>
              {selectedStaff ? selectedStaff.full_name : 'スタッフを選択'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          {/* 現在の状態表示 */}
          {selectedStaff && (
            <View style={[
              styles.statusBadge,
              selectedStatus === 'clocked_in' ? styles.statusBadgeClockedIn :
              selectedStatus === 'clocked_out' ? styles.statusBadgeClockedOut :
              styles.statusBadgeNotClocked,
            ]}>
              <Text style={styles.statusBadgeText}>
                {selectedStatus === 'clocked_in' ? '⚡ 出勤中' :
                 selectedStatus === 'clocked_out' ? '✓ 退勤済み' :
                 '— 未打刻'}
              </Text>
            </View>
          )}

          {/* 出勤 / 退勤 ボタン */}
          <View style={styles.clockButtons}>
            {/* 出勤ボタン */}
            <TouchableOpacity
              style={[
                styles.clockInButton,
                (isClocking || selectedStatus === 'clocked_in') && styles.buttonDisabled,
              ]}
              onPress={() => handleClock('clock_in')}
              disabled={isClocking || selectedStatus === 'clocked_in'}
            >
              {isClocking ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="log-in" size={28} color="#fff" />
                  <Text style={styles.clockButtonText}>出勤</Text>
                </>
              )}
            </TouchableOpacity>

            {/* 退勤ボタン */}
            <TouchableOpacity
              style={[
                styles.clockOutButton,
                (isClocking || selectedStatus !== 'clocked_in') && styles.buttonDisabled,
              ]}
              onPress={() => handleClock('clock_out')}
              disabled={isClocking || selectedStatus !== 'clocked_in'}
            >
              {isClocking ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="log-out" size={28} color="#fff" />
                  <Text style={styles.clockButtonText}>退勤</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* 顔認証ボタン（Androidのみ有効） */}
          <View style={styles.faceAuthSection}>
            <Text style={styles.faceAuthTitle}>顔認証打刻</Text>
            <Text style={styles.faceAuthSubtitle}>
              顔認証アプリと連携して打刻（Android専用）
            </Text>
            <View style={styles.faceAuthButtons}>
              <TouchableOpacity
                style={[
                  styles.faceAuthButton,
                  styles.faceAuthClockIn,
                  (faceAuthLoading || Platform.OS !== 'android') && styles.buttonDisabled,
                ]}
                onPress={() => launchFaceAuth('clock_in')}
                disabled={faceAuthLoading || Platform.OS !== 'android'}
              >
                {faceAuthLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.faceAuthIcon}>🪪</Text>
                    <Text style={styles.faceAuthButtonText}>顔認証 出勤</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.faceAuthButton,
                  styles.faceAuthClockOut,
                  (faceAuthLoading || Platform.OS !== 'android') && styles.buttonDisabled,
                ]}
                onPress={() => launchFaceAuth('clock_out')}
                disabled={faceAuthLoading || Platform.OS !== 'android'}
              >
                {faceAuthLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.faceAuthIcon}>🪪</Text>
                    <Text style={styles.faceAuthButtonText}>顔認証 退勤</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {Platform.OS !== 'android' && (
              <Text style={styles.faceAuthNote}>
                ※ 顔認証はAndroid端末でのみ利用できます
              </Text>
            )}
          </View>
        </View>

        {/* 右パネル: 本日の勤怠一覧 */}
        <View style={styles.rightPanel}>
          <Text style={styles.panelTitle}>
            本日の勤怠状況
          </Text>
          <FlatList
            data={staffList}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item: staff }) => {
              const attendance = todayAttendances.find((a) => a.staff_id === staff.id);
              const status = getStaffStatus(staff.id);
              return (
                <View style={styles.staffAttendanceRow}>
                  <View style={styles.staffAttendanceInfo}>
                    {/* スタッフ名 */}
                    <Text style={styles.staffAttendanceName}>
                      {staff.full_name}
                    </Text>
                    {/* 役職 */}
                    <Text style={styles.staffAttendanceRole}>
                      {staff.role === 'admin' ? '管理者' :
                       staff.role === 'manager' ? 'マネージャー' : 'スタッフ'}
                    </Text>
                  </View>
                  {/* 出勤/退勤時刻 */}
                  <View style={styles.staffAttendanceTimes}>
                    {attendance ? (
                      <>
                        <Text style={styles.clockInTime}>
                          出: {new Date(attendance.clock_in).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                        {attendance.clock_out && (
                          <Text style={styles.clockOutTime}>
                            退: {new Date(attendance.clock_out).toLocaleTimeString('ja-JP', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        )}
                        {attendance.work_hours && (
                          <Text style={styles.workHoursText}>
                            {formatWorkHours(attendance.work_hours)}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.notClockedText}>未打刻</Text>
                    )}
                  </View>
                  {/* ステータスインジケーター */}
                  <View style={[
                    styles.staffStatusDot,
                    status === 'clocked_in' ? styles.dotClockedIn :
                    status === 'clocked_out' ? styles.dotClockedOut :
                    styles.dotNotClocked,
                  ]} />
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>スタッフ情報がありません</Text>
            }
          />
        </View>
      </View>

      {/* スタッフ選択モーダル */}
      <Modal
        visible={showStaffPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStaffPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>スタッフを選択</Text>
              <TouchableOpacity onPress={() => setShowStaffPicker(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={staffList}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    selectedStaff?.id === item.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedStaff(item);
                    setShowStaffPicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    selectedStaff?.id === item.id && styles.pickerItemTextSelected,
                  ]}>
                    {item.full_name}
                  </Text>
                  {selectedStaff?.id === item.id && (
                    <Ionicons name="checkmark" size={18} color={COLORS.accent} />
                  )}
                </TouchableOpacity>
              )}
            />
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
  flashOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.flashGreen,
    zIndex: 100,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.accent,
  },
  refreshButton: {
    padding: 6,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  // 左パネル（打刻エリア）
  leftPanel: {
    width: '48%',
    padding: 20,
    gap: 16,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  // 時計表示
  clockDisplay: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clockTime: {
    fontSize: 42,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  clockDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  // スタッフ選択
  staffSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  staffSelectorText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  // ステータスバッジ
  statusBadge: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  statusBadgeClockedIn: {
    backgroundColor: '#052e16',
    borderColor: '#22c55e',
  },
  statusBadgeClockedOut: {
    backgroundColor: '#1e1b4b',
    borderColor: '#6366f1',
  },
  statusBadgeNotClocked: {
    backgroundColor: '#1a1a2e',
    borderColor: '#374151',
  },
  statusBadgeText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  // 打刻ボタン
  clockButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  clockInButton: {
    flex: 1,
    backgroundColor: COLORS.clockInGreen,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.clockInBorder,
  },
  clockOutButton: {
    flex: 1,
    backgroundColor: COLORS.clockOutRed,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.clockOutBorder,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  clockButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  // 顔認証セクション
  faceAuthSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  faceAuthTitle: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  faceAuthSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  faceAuthButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  faceAuthButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
  },
  faceAuthClockIn: {
    backgroundColor: '#0a2e1a',
    borderColor: '#22c55e',
  },
  faceAuthClockOut: {
    backgroundColor: '#2e0a0a',
    borderColor: '#f87171',
  },
  faceAuthIcon: {
    fontSize: 16,
  },
  faceAuthButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  faceAuthNote: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
  },
  // 右パネル（勤怠一覧）
  rightPanel: {
    flex: 1,
    flexDirection: 'column',
  },
  panelTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    textTransform: 'uppercase',
    letterSpacing: 1,
    backgroundColor: COLORS.surface,
  },
  // スタッフ勤怠行
  staffAttendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  staffAttendanceInfo: {
    flex: 1,
    gap: 2,
  },
  staffAttendanceName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  staffAttendanceRole: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  staffAttendanceTimes: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 100,
  },
  clockInTime: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
  },
  clockOutTime: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '600',
  },
  workHoursText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  notClockedText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  staffStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotClockedIn: {
    backgroundColor: '#22c55e',
  },
  dotClockedOut: {
    backgroundColor: '#6366f1',
  },
  dotNotClocked: {
    backgroundColor: '#374151',
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    padding: 24,
    fontSize: 14,
  },
  // スタッフ選択モーダル
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    width: 320,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerTitle: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerItemSelected: {
    backgroundColor: '#1e1e3e',
  },
  pickerItemText: {
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  pickerItemTextSelected: {
    color: COLORS.accent,
    fontWeight: '700',
  },
});

export default AttendanceScreen;
