// バー管理システム タブレットアプリ - エントリーポイント
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      {/* ステータスバー（ダークテーマに合わせてライト） */}
      <StatusBar style="light" backgroundColor="#111827" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
