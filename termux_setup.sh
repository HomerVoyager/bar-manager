#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# バー管理システム Termux 環境構築スクリプト
# 使用方法: bash termux_setup.sh
# 所要時間: 約10〜15分（通信環境による）
# ============================================================

set -euo pipefail

# ===== カラー出力ユーティリティ =====
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ===== ステップ表示 =====
step() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

# ============================================================
# メイン処理
# ============================================================

echo ""
echo -e "${CYAN}🍺 バー管理システム セットアップ開始${NC}"
echo ""

# ===== STEP 1: パッケージ更新 =====
step "STEP 1: パッケージ更新"
info "Termux パッケージを更新します..."
pkg update -y && pkg upgrade -y
success "パッケージ更新完了"

# ===== STEP 2: 必要パッケージインストール =====
step "STEP 2: 必要パッケージのインストール"
info "Python, PostgreSQL, Node.js, その他をインストールします..."
pkg install -y python postgresql nodejs-lts git openssh rclone cronie curl wget
success "パッケージインストール完了"

# ===== STEP 3: PostgreSQL セットアップ =====
step "STEP 3: PostgreSQL データベースのセットアップ"

# PostgreSQL データディレクトリの初期化
if [ ! -d "$PREFIX/var/lib/postgresql" ]; then
    info "PostgreSQL を初期化します..."
    initdb "$PREFIX/var/lib/postgresql"
    success "PostgreSQL 初期化完了"
else
    info "PostgreSQL は既に初期化されています"
fi

# PostgreSQL 起動
info "PostgreSQL を起動します..."
pg_ctl -D "$PREFIX/var/lib/postgresql" start -l "$PREFIX/var/lib/postgresql/pg.log" || true
sleep 3

# データベースとユーザーの作成
info "データベースとユーザーを作成します..."
createdb bar_manager 2>/dev/null || warn "データベース bar_manager は既に存在します"
psql -d postgres -c "CREATE USER bar_user WITH PASSWORD 'barpass123';" 2>/dev/null || warn "ユーザー bar_user は既に存在します"
psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE bar_manager TO bar_user;" 2>/dev/null || true
psql -d bar_manager -c "GRANT ALL ON SCHEMA public TO bar_user;" 2>/dev/null || true
success "PostgreSQL セットアップ完了"

# ===== STEP 4: Python 依存関係インストール =====
step "STEP 4: Python パッケージのインストール"
info "FastAPI と関連パッケージをインストールします..."
pip install \
    fastapi==0.111.0 \
    "uvicorn[standard]==0.29.0" \
    sqlalchemy==2.0.30 \
    psycopg2-binary==2.9.9 \
    "python-jose[cryptography]==3.3.0" \
    "passlib[bcrypt]==1.7.4" \
    python-multipart==0.0.9 \
    reportlab==4.2.0 \
    python-dotenv==1.0.1 \
    alembic==1.13.1 \
    websockets==12.0 \
    aiofiles==23.2.1 \
    "pydantic-settings==2.2.1"
success "Python パッケージインストール完了"

# ===== STEP 5: Node.js / フロントエンド依存関係 =====
step "STEP 5: フロントエンド依存関係のインストール"
FRONTEND_DIR="$HOME/bar-manager/frontend"
if [ -d "$FRONTEND_DIR" ]; then
    info "フロントエンド依存関係をインストールします..."
    cd "$FRONTEND_DIR"
    npm install
    success "フロントエンドインストール完了"
else
    warn "フロントエンドディレクトリが見つかりません: $FRONTEND_DIR"
fi

# ===== STEP 6: IPAex フォント（PDF日本語対応）=====
step "STEP 6: 日本語フォントのセットアップ"
FONTS_DIR="$HOME/.fonts"
mkdir -p "$FONTS_DIR"

info "IPAex ゴシックフォントをダウンロードします..."
FONT_URL="https://moji.or.jp/wp-content/ipafont/IPAexfont/ipaexg00401.zip"
FONT_TMP="/tmp/ipaex.zip"

if curl -L --retry 3 --connect-timeout 30 "$FONT_URL" -o "$FONT_TMP" 2>/dev/null; then
    cd /tmp
    unzip -o "$FONT_TMP" -d /tmp/ipaex/ 2>/dev/null
    if [ -f "/tmp/ipaex/ipaexg00401/ipaexg.ttf" ]; then
        cp "/tmp/ipaex/ipaexg00401/ipaexg.ttf" "$FONTS_DIR/ipaexg.ttf"
        success "IPAex フォントのインストール完了: $FONTS_DIR/ipaexg.ttf"
    else
        warn "フォントファイルが見つかりませんでした（PDF出力時はフォールバックを使用）"
    fi
    rm -rf "$FONT_TMP" /tmp/ipaex/
else
    warn "フォントのダウンロードに失敗しました（PDF出力時はフォールバックを使用）"
fi

# ===== STEP 7: .env ファイル生成 =====
step "STEP 7: 環境設定ファイルの作成"
ENV_FILE="$HOME/bar-manager/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    info ".env ファイルを作成します..."
    # ランダムな秘密鍵を生成
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    cat > "$ENV_FILE" << EOF
# バー管理システム 環境変数設定
DATABASE_URL=postgresql://bar_user:barpass123@localhost/bar_manager
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
BACKUP_DIR=/data/data/com.termux/files/home/backups
EOF
    success ".env ファイルを作成しました: $ENV_FILE"
else
    warn ".env ファイルは既に存在します: $ENV_FILE"
fi

# ===== STEP 8: バックアップディレクトリ =====
step "STEP 8: バックアップディレクトリの作成"
mkdir -p "$HOME/backups"
chmod 700 "$HOME/backups"
success "バックアップディレクトリ作成完了: $HOME/backups"

# ===== STEP 9: DB テーブル作成 & シードデータ =====
step "STEP 9: データベースの初期化とサンプルデータの投入"
BACKEND_DIR="$HOME/bar-manager/backend"
if [ -d "$BACKEND_DIR" ]; then
    cd "$BACKEND_DIR"
    info "データベーステーブルを作成します..."
    python3 -c "
from app.core.database import Base, engine
from app.models import staff, product, table, session, order_item, stock_log, attendance
Base.metadata.create_all(bind=engine)
print('テーブル作成完了')
"
    info "サンプルデータを投入します..."
    python3 app/seed.py
    success "データベース初期化完了"
else
    warn "バックエンドディレクトリが見つかりません: $BACKEND_DIR"
fi

# ===== STEP 10: cron セットアップ =====
step "STEP 10: 自動バックアップ (cron) の設定"
info "cron デーモンを起動します..."
crond 2>/dev/null || warn "cron は既に起動しています"

BACKUP_SCRIPT="$HOME/bar-manager/backup.sh"
chmod +x "$BACKUP_SCRIPT" 2>/dev/null || true

info "crontab にバックアップジョブを追加します..."
# 既存のcrontabに追加（重複チェック）
if ! crontab -l 2>/dev/null | grep -q "backup.sh"; then
    (crontab -l 2>/dev/null; echo "0 3 * * * $BACKUP_SCRIPT >> $HOME/backups/cron.log 2>&1") | crontab -
    success "crontab にバックアップジョブを追加しました（毎日3:00）"
else
    info "バックアップジョブは既に crontab に存在します"
fi

# ===== STEP 11: 起動スクリプト作成 =====
step "STEP 11: 起動スクリプトの作成"
cat > "$HOME/start_bar_manager.sh" << 'STARTEOF'
#!/data/data/com.termux/files/usr/bin/bash
# バー管理システム 一発起動スクリプト

echo "🍺 バー管理システムを起動します..."

# PostgreSQL 起動
if ! pg_ctl -D $PREFIX/var/lib/postgresql status > /dev/null 2>&1; then
    pg_ctl -D $PREFIX/var/lib/postgresql start -l $PREFIX/var/lib/postgresql/pg.log
    sleep 2
    echo "✅ PostgreSQL 起動完了"
else
    echo "ℹ️  PostgreSQL は既に起動しています"
fi

# バックエンド起動（ポート8000）
cd ~/bar-manager/backend
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > ~/logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ バックエンド起動完了 (PID: $BACKEND_PID, port: 8000)"

# フロントエンド起動（ポート3000）
cd ~/bar-manager/frontend
nohup npm run dev -- --host 0.0.0.0 --port 3000 > ~/logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ フロントエンド起動完了 (PID: $FRONTEND_PID, port: 3000)"

echo ""
echo "========================================="
echo "  🍺 バー管理システム 起動完了"
echo "========================================="
echo "  管理画面:   http://localhost:3000"
echo "  API:        http://localhost:8000"
echo "  API ドキュメント: http://localhost:8000/docs"
echo ""
echo "  初期ログイン:"
echo "    ユーザー名: 田中"
echo "    パスワード: admin123"
echo "========================================="
STARTEOF
chmod +x "$HOME/start_bar_manager.sh"

# ログディレクトリ作成
mkdir -p "$HOME/logs"

success "起動スクリプト作成完了: $HOME/start_bar_manager.sh"

# ===== 完了メッセージ =====
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  🎉 セットアップ完了！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "  システム起動コマンド:"
echo -e "    ${CYAN}bash ~/start_bar_manager.sh${NC}"
echo ""
echo "  初期ログイン:"
echo -e "    ユーザー名: ${CYAN}田中${NC}"
echo -e "    パスワード: ${CYAN}admin123${NC}"
echo ""
echo "  次のステップ:"
echo "    1. Tailscale のインストールと設定（README.md 参照）"
echo "    2. rclone の Google ドライブ認証（README.md 参照）"
echo "    3. バックアップスクリプトのテスト実行"
echo -e "       ${CYAN}bash ~/bar-manager/backup.sh${NC}"
echo ""
