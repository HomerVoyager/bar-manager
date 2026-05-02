// ============================================================
// AppNavigator - アプリのナビゲーション設定
// スタックナビゲーターとボトムタブナビゲーターを組み合わせる
// ============================================================

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// スクリーン
import LoginScreen from '../screens/LoginScreen';
import TableMapScreen from '../screens/TableMapScreen';
import OrderScreen from '../screens/OrderScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import MenuScreen from '../screens/MenuScreen';

// 型
import { RootStackParamList } from '../types';

// APIクライアント
import { setNavigationRef, initializeApiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// ==============================
// テーマカラー定数
// ==============================
const COLORS = {
  background: '#0f0f1a',
  surface: '#1a1a2e',
  border: '#2a2a4e',
  accent: '#f59e0b',
  textPrimary: '#f1f5f9',
  textSecondary: '#64748b',
  tabActive: '#f59e0b',
  tabInactive: '#64748b',
};

// ==============================
// ボトムタブナビゲーター
// テーブルマップ、打刻、メニューの3タブ
// ==============================
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          // ルートに応じたアイコンを設定
          let iconName: keyof typeof Ionicons.glyphMap = 'grid';

          if (route.name === 'TableMap') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Attendance') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Menu') {
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {/* テーブル管理タブ */}
      <Tab.Screen
        name="TableMap"
        component={TableMapScreen}
        options={{ tabBarLabel: '卓管理' }}
      />
      {/* 勤怠打刻タブ */}
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{ tabBarLabel: '打刻' }}
      />
      {/* メニュー管理タブ */}
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{ tabBarLabel: 'メニュー' }}
      />
    </Tab.Navigator>
  );
};

// ==============================
// ローディングスクリーン
// ==============================
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={COLORS.accent} />
    <Text style={styles.loadingText}>読み込み中...</Text>
  </View>
);

// ==============================
// メインナビゲーター
// ==============================
const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // APIクライアントの初期化とナビゲーション参照の設定
  useEffect(() => {
    initializeApiClient();
  }, []);

  // ナビゲーション参照をAPIクライアントに渡す
  useEffect(() => {
    if (navigationRef.current) {
      setNavigationRef({
        navigate: (screen: string) => {
          navigationRef.current?.navigate(screen as keyof RootStackParamList);
        },
      });
    }
  }, [navigationRef.current]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: true,
        colors: {
          primary: COLORS.accent,
          background: COLORS.background,
          card: COLORS.surface,
          text: COLORS.textPrimary,
          border: COLORS.border,
          notification: COLORS.accent,
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          // ランドスケープ（横向き）固定
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'slide_from_right',
        }}
        // 認証状態に応じて初期スクリーンを変える
        initialRouteName={isAuthenticated ? 'TableMap' : 'Login'}
      >
        {!isAuthenticated ? (
          // 未認証: ログインスクリーンのみ
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ animation: 'fade' }}
          />
        ) : (
          // 認証済み: メインコンテンツ
          <>
            {/* ボトムタブナビゲーター（メイン画面） */}
            <Stack.Screen
              name="TableMap"
              component={MainTabNavigator}
            />
            {/* オーダー画面（フルスクリーン） */}
            <Stack.Screen
              name="Order"
              component={OrderScreen}
              options={{
                animation: 'slide_from_bottom',
                presentation: 'modal',
              }}
            />
            {/* 会計画面（フルスクリーン） */}
            <Stack.Screen
              name="Checkout"
              component={CheckoutScreen}
              options={{
                animation: 'slide_from_right',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  // ボトムタブバー
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 6,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  // ローディング
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});

export default AppNavigator;
