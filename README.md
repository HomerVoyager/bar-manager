# 🍺 バー管理システム

Androidタブレット（Termux）上で動作するバー店舗管理システムです。

## システム概要

| コンポーネント | 技術 |
|---|---|
| バックエンド | FastAPI (Python 3.11) |
| データベース | PostgreSQL 15 |
| Web管理画面 | React 18 + TypeScript + Tailwind CSS |
| タブレットアプリ | React Native + Expo |
| 外部アクセス | Tailscale (VPN) |
| バックアップ | rclone + Google ドライブ |

## 必要環境

- Android タブレット（Android 10以上推奨）
- Termux アプリ（F-Droid版推奨）
- Wi-Fi 接続
- Google アカウント（バックアップ用）

---

## 初回セットアップ手順

### 1. Termux のインストール

[F-Droid](https://f-droid.org/) から Termux をインストールしてください。  
（Google Play 版は非推奨）

### 2. プロジェクトのクローン

```bash
pkg install git -y
git clone <your-repo-url> ~/bar-manager
```

または手動でファイルを転送してください（`scp` や USB など）。

### 3. セットアップスクリプトの実行

```bash
bash ~/bar-manager/termux_setup.sh
```

このスクリプトが以下をすべて自動で行います：
- パッケージのインストール
- PostgreSQL の初期化・起動
- Python/Node.js 依存関係のインストール
- データベースのテーブル作成
- サンプルデータの投入
- 自動バックアップの cron 設定
- 起動スクリプトの作成

所要時間: **約10〜15分**（通信環境による）

### 4. システムの起動

```bash
bash ~/start_bar_manager.sh
```

### 5. 初期ログイン

ブラウザで `http://localhost:3000` を開き、以下でログインしてください：

| ユーザー名 | パスワード | 権限 |
|---|---|---|
| 田中 | admin123 | マネージャー |
| 鈴木 | pass123 | スタッフ |
| 佐藤 | pass123 | スタッフ |

---

## Tailscale 設定手順（外部アクセス）

Tailscale を使うと、自宅のWi-Fi外からもスマホやPCで管理画面にアクセスできます。

### 1. Tailscale のインストール

Androidタブレットに [Tailscale](https://tailscale.com/download/android) をインストールし、Google/Microsoftアカウントでサインインします。

### 2. Tailscale の IP アドレスを確認

Tailscale アプリを開き、このデバイスの IP アドレスを確認します（例: `100.x.x.x`）。

```bash
# Termux からも確認できます
ip addr show tailscale0 | grep "inet " | awk '{print $2}'
```

### 3. バックエンドの起動コマンドを変更

`~/start_bar_manager.sh` のバックエンド起動部分を確認してください。  
`--host 0.0.0.0` を指定しているため、Tailscale ネットワーク経由でのアクセスが可能です。

### 4. 他のデバイスからアクセス

同じ Tailscale ネットワークに参加した別のデバイスから以下のURLでアクセスできます：

```
管理画面: http://100.x.x.x:3000
API:      http://100.x.x.x:8000
```

### 5. CORS 設定の確認

`backend/main.py` の CORS 設定は `100.x.x.x` のIPレンジを許可しています。  
アクセスできない場合は、具体的なIPを追加してください：

```python
# backend/main.py の allow_origin_regex を確認
allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|100\.\d+\.\d+\.\d+)(:\d+)?$"
```

---

## Cloudflare Tunnel への切り替え（将来対応）

インターネットから直接アクセスしたい場合は Cloudflare Tunnel を使います。

### 1. cloudflared のインストール

```bash
# Termux での ARM64 版インストール
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 \
  -O $PREFIX/bin/cloudflared
chmod +x $PREFIX/bin/cloudflared
```

### 2. 認証とトンネル作成

```bash
cloudflared tunnel login
cloudflared tunnel create bar-manager
```

### 3. トンネル設定ファイルの作成

```yaml
# ~/.cloudflared/config.yml
tunnel: <TUNNEL-ID>
credentials-file: ~/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: bar.yourdomain.com
    service: http://localhost:3000
  - hostname: api.bar.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
```

### 4. DNS レコードの追加

```bash
cloudflared tunnel route dns bar-manager bar.yourdomain.com
```

### 5. トンネルの起動

```bash
cloudflared tunnel run bar-manager &
```

---

## バックアップ設定（Google ドライブ）

### 1. rclone の Google ドライブ認証

```bash
rclone config
```

対話形式で以下を設定：
1. `n` → 新規設定
2. Name: `gdrive`
3. Storage: `drive` (Google Drive)
4. Client ID / Secret: 空欄でOK（デフォルト使用）
5. Scope: `1` (full access)
6. ブラウザ認証が開く → Google アカウントでログイン

### 2. バックアップのテスト実行

```bash
bash ~/bar-manager/backup.sh
```

### 3. 自動バックアップの確認

```bash
# crontab の設定を確認
crontab -l

# バックアップログを確認
tail -f ~/backups/backup.log
```

---

## 日常運用

### システムの起動

```bash
bash ~/start_bar_manager.sh
```

### システムの停止

```bash
# バックエンドとフロントエンドの停止
pkill -f uvicorn
pkill -f "vite"

# PostgreSQL の停止
pg_ctl -D $PREFIX/var/lib/postgresql stop
```

### ログの確認

```bash
# バックエンドログ
tail -f ~/logs/backend.log

# フロントエンドログ
tail -f ~/logs/frontend.log

# バックアップログ
tail -f ~/backups/backup.log

# PostgreSQL ログ
tail -f $PREFIX/var/lib/postgresql/pg.log
```

### データベースの直接操作

```bash
psql -U bar_user bar_manager
```

### バックアップの手動実行

```bash
bash ~/bar-manager/backup.sh
```

---

## トラブルシューティング

### PostgreSQL が起動しない

```bash
# ステータス確認
pg_ctl -D $PREFIX/var/lib/postgresql status

# ログを確認
tail -20 $PREFIX/var/lib/postgresql/pg.log

# 強制再起動
pg_ctl -D $PREFIX/var/lib/postgresql stop -m fast
sleep 2
pg_ctl -D $PREFIX/var/lib/postgresql start
```

### ポートが既に使用されている

```bash
# 使用中のプロセスを確認
lsof -i :8000
lsof -i :3000

# プロセスを終了
pkill -f uvicorn
pkill -f vite
```

### `pip install` が失敗する

```bash
# ビルドツールを追加してリトライ
pkg install build-essential libffi openssl-dev python-dev -y
pip install --upgrade pip setuptools wheel
pip install psycopg2-binary --no-cache-dir
```

### フロントエンドが `npm install` で失敗する

```bash
# キャッシュをクリアしてリトライ
npm cache clean --force
cd ~/bar-manager/frontend && npm install
```

### PDF出力で文字化けする

IPAex フォントが必要です：

```bash
mkdir -p ~/.fonts
curl -L "https://moji.or.jp/wp-content/ipafont/IPAexfont/ipaexg00401.zip" -o /tmp/ipaex.zip
unzip /tmp/ipaex.zip -d /tmp/ipaex/
cp /tmp/ipaex/ipaexg00401/ipaexg.ttf ~/.fonts/ipaexg.ttf
```

### JWT トークンエラー

`.env` ファイルの `SECRET_KEY` が32文字以上あることを確認してください：

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## 主要 API エンドポイント一覧

APIドキュメント（Swagger UI）: `http://localhost:8000/docs`

| カテゴリ | エンドポイント | 説明 |
|---|---|---|
| 認証 | `POST /api/v1/auth/login` | ログイン・JWT取得 |
| ダッシュボード | `GET /api/v1/dashboard/` | ダッシュボード全データ |
| 卓管理 | `GET /api/v1/tables/` | 卓一覧（セッション情報含む） |
| セッション | `POST /api/v1/sessions/` | セッション開始 |
| セッション | `POST /api/v1/sessions/{id}/close` | 会計・閉店 |
| 注文 | `POST /api/v1/sessions/{id}/items` | 注文追加 |
| 在庫 | `GET /api/v1/stock/alerts` | 在庫アラート一覧 |
| 勤怠 | `POST /api/v1/attendance/clock-in` | 出勤打刻 |
| 勤怠 | `POST /api/v1/attendance/clock-out` | 退勤打刻 |
| 給与 | `POST /api/v1/attendance/payslip/{staff_id}/{year}/{month}/pdf` | 給与明細PDF |
| 売上 | `GET /api/v1/reports/sales/daily` | 日次売上レポート |
| 売上 | `GET /api/v1/reports/sales/export-csv` | CSVエクスポート |
| WebSocket | `WS /ws/tables` | リアルタイム卓状態同期 |

---

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

---

*Built with ❤️ for bar management on Android Termux*
