// ============================================================
// LoginScreen - ログイン画面
// バーのテーマに合わせたダークテーマ＋アンバーアクセント
// ランドスケープレイアウト
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useAuth } from '../hooks/useAuth';
import { setBaseUrl } from '../api/client';

type LoginNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

// テーマカラー
const COLORS = {
  background: '#0f0f1a',
  surface: '#1a1a2e',
  surfaceAlt: '#16213e',
  border: '#2a2a4e',
  accent: '#f59e0b',
  accentDark: '#b45309',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  inputBg: '#0d0d1a',
  inputBorder: '#2a2a4e',
  inputFocusBorder: '#f59e0b',
  error: '#f87171',
  placeholder: '#475569',
};

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginNavigationProp>();
  const { login, isLoading, error } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  /**
   * ログインボタン処理
   */
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('入力エラー', 'ユーザー名とパスワードを入力してください');
      return;
    }

    // カスタムサーバーURLが設定されていれば更新
    if (serverUrl.trim()) {
      await setBaseUrl(serverUrl.trim());
    }

    const success = await login({ username: username.trim(), password });

    if (success) {
      // ログイン成功: AppNavigatorが自動的にTableMapへ遷移する
      navigation.replace('TableMap');
    } else {
      Alert.alert(
        'ログイン失敗',
        error || 'ユーザー名またはパスワードが正しくありません',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 背景装飾 */}
      <View style={styles.bgDecoration1} />
      <View style={styles.bgDecoration2} />

      {/* メインコンテンツ（横向きレイアウト） */}
      <View style={styles.content}>

        {/* 左側: ロゴエリア */}
        <View style={styles.logoSection}>
          {/* バーロゴのプレースホルダー */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🍺</Text>
          </View>
          <Text style={styles.appTitle}>バー管理</Text>
          <Text style={styles.appSubtitle}>Bar Manager System</Text>
          <Text style={styles.appVersion}>v1.0.0</Text>

          {/* 装飾ライン */}
          <View style={styles.decorLine} />
          <Text style={styles.welcomeText}>
            スタッフの方はログインしてください
          </Text>
        </View>

        {/* 右側: フォームエリア */}
        <View style={styles.formSection}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>ログイン</Text>

            {/* エラーメッセージ */}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* ユーザー名入力 */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ユーザー名</Text>
              <TextInput
                style={[
                  styles.input,
                  usernameFocused && styles.inputFocused,
                ]}
                value={username}
                onChangeText={setUsername}
                placeholder="ユーザー名を入力"
                placeholderTextColor={COLORS.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
              />
            </View>

            {/* パスワード入力 */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>パスワード</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    passwordFocused && styles.inputFocused,
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="パスワードを入力"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                {/* パスワード表示/非表示トグル */}
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? '隠す' : '表示'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ログインボタン */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                isLoading && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#1a1a2e" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>ログイン</Text>
              )}
            </TouchableOpacity>

            {/* サーバー設定トグル */}
            <TouchableOpacity
              style={styles.settingsToggle}
              onPress={() => setShowSettings(!showSettings)}
            >
              <Text style={styles.settingsToggleText}>
                {showSettings ? '▲ サーバー設定を閉じる' : '▼ サーバーURLを変更'}
              </Text>
            </TouchableOpacity>

            {/* サーバーURL設定（折りたたみ） */}
            {showSettings && (
              <View style={styles.serverSettings}>
                <Text style={styles.inputLabel}>
                  サーバーURL（Tailscale IP など）
                </Text>
                <TextInput
                  style={styles.input}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  placeholder="http://100.x.x.x:8000/api/v1"
                  placeholderTextColor={COLORS.placeholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <Text style={styles.settingsHint}>
                  デフォルト: http://localhost:8000/api/v1
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // 背景装飾（グラデーション代わりの円形デコレーション）
  bgDecoration1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#1a1208',
    top: -100,
    left: -100,
    opacity: 0.8,
  },
  bgDecoration2: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#0d0820',
    bottom: -150,
    right: -150,
    opacity: 0.5,
  },
  // ランドスケープ横並びレイアウト
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    paddingVertical: 24,
    gap: 48,
  },
  // 左側ロゴエリア
  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 3,
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 48,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 4,
  },
  appSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
  appVersion: {
    fontSize: 12,
    color: COLORS.placeholder,
  },
  decorLine: {
    width: 60,
    height: 2,
    backgroundColor: COLORS.accent,
    marginVertical: 8,
    opacity: 0.6,
  },
  welcomeText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  // 右側フォームエリア
  formSection: {
    flex: 1.2,
    justifyContent: 'center',
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  errorBanner: {
    backgroundColor: '#450a0a',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 2,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: COLORS.inputFocusBorder,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  passwordToggle: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: COLORS.inputBorder,
  },
  passwordToggleText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  loginButtonDisabled: {
    backgroundColor: COLORS.accentDark,
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#1a1a2e',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  settingsToggle: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  settingsToggleText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  serverSettings: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  settingsHint: {
    color: COLORS.placeholder,
    fontSize: 11,
    marginLeft: 2,
  },
});

export default LoginScreen;
