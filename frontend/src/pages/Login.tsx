// バー管理システム - ログインページ
// ダークテーマのバー雰囲気に合わせたログインフォームです

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { LoginCredentials } from '../types';

const Login: React.FC = () => {
  const { login, isLoading, error, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // 既にログイン済みの場合はダッシュボードへリダイレクト
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>();

  // ログインフォームの送信処理
  const onSubmit = async (data: LoginCredentials) => {
    try {
      await login(data);
    } catch {
      // エラーはuseAuthフック内で処理済み
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* 背景の装飾 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-amber-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      {/* ログインカード */}
      <div className="relative w-full max-w-sm">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-8">
          {/* バーロゴとタイトル */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4" aria-hidden="true">🍺</div>
            <h1 className="text-2xl font-bold text-amber-400 mb-1">
              Bar Manager
            </h1>
            <p className="text-gray-400 text-sm">バー管理システム</p>
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div className="mb-5 flex items-start gap-3 p-3 bg-red-900/30 border border-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* ログインフォーム */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* ユーザー名フィールド */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                ユーザー名
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                className={`
                  w-full px-4 py-2.5 rounded-lg
                  bg-gray-800 border text-white
                  placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                  transition-colors
                  ${errors.username
                    ? 'border-red-500'
                    : 'border-gray-600 hover:border-gray-500'
                  }
                `}
                placeholder="例: admin"
                {...register('username', {
                  required: 'ユーザー名を入力してください',
                })}
              />
              {errors.username && (
                <p className="mt-1 text-xs text-red-400">{errors.username.message}</p>
              )}
            </div>

            {/* パスワードフィールド */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                パスワード
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={`
                  w-full px-4 py-2.5 rounded-lg
                  bg-gray-800 border text-white
                  placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                  transition-colors
                  ${errors.password
                    ? 'border-red-500'
                    : 'border-gray-600 hover:border-gray-500'
                  }
                `}
                placeholder="••••••••"
                {...register('password', {
                  required: 'パスワードを入力してください',
                  minLength: {
                    value: 4,
                    message: 'パスワードは4文字以上で入力してください',
                  },
                })}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* ログインボタン */}
            <button
              type="submit"
              disabled={isLoading}
              className="
                w-full py-2.5 px-4 rounded-lg
                bg-amber-500 hover:bg-amber-400
                disabled:bg-amber-800 disabled:cursor-not-allowed
                text-gray-900 font-semibold
                transition-colors
                flex items-center justify-center gap-2
              "
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  ログイン中...
                </>
              ) : (
                'ログイン'
              )}
            </button>
          </form>

          {/* フッター */}
          <p className="text-center text-gray-600 text-xs mt-8">
            © 2024 Bar Management System
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
