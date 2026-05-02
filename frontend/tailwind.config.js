/** @type {import('tailwindcss').Config} */
// バー管理システム - Tailwind CSS設定
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // バーのテーマに合わせたカラーパレット
      colors: {
        'bar-dark': '#0f0f0f',
        'bar-card': '#1a1a2e',
        'bar-amber': '#f59e0b',
        'bar-gold': '#d97706',
      },
      fontFamily: {
        // 日本語フォントの優先設定
        sans: ['Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
