#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# バー管理システム 自動バックアップスクリプト
# 毎日午前3時にcronから実行される
#
# crontab 設定方法:
#   crontab -e
#   以下の行を追加:
#   0 3 * * * /data/data/com.termux/files/home/bar-manager/backup.sh >> /data/data/com.termux/files/home/backups/cron.log 2>&1
# ============================================================

set -euo pipefail

# ===== 設定 =====
BACKUP_DIR="/data/data/com.termux/files/home/backups"
DB_NAME="bar_manager"
DB_USER="bar_user"
RETAIN_DAYS=7
RCLONE_REMOTE="gdrive:bar-manager-backups"
LOG_FILE="$BACKUP_DIR/backup.log"
DATE=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/bar_manager_${DATE}.sql.gz"

# ===== ユーティリティ =====
log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# ===== メイン処理 =====
main() {
    log "INFO" "=== バックアップ開始 ==="

    # バックアップディレクトリ作成（存在しない場合）
    mkdir -p "$BACKUP_DIR"

    # 1. PostgreSQL ダンプ（gzip圧縮）
    log "INFO" "データベースダンプを開始します: $DB_NAME"
    if pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
        local size
        size=$(du -sh "$BACKUP_FILE" | cut -f1)
        log "INFO" "ダンプ完了: $BACKUP_FILE (サイズ: $size)"
    else
        log "ERROR" "pg_dump に失敗しました"
        exit 1
    fi

    # 2. rclone で Google ドライブに同期
    log "INFO" "Google ドライブへのアップロードを開始します..."
    if command -v rclone &> /dev/null; then
        if rclone copy "$BACKUP_FILE" "$RCLONE_REMOTE/" --log-level INFO 2>> "$LOG_FILE"; then
            log "INFO" "Google ドライブへのアップロード完了"
        else
            log "WARN" "rclone アップロードに失敗しました（ローカルバックアップは保持されます）"
        fi
    else
        log "WARN" "rclone がインストールされていません。ローカルバックアップのみ保持します"
    fi

    # 3. 古いローカルバックアップを削除（7日以上前のファイル）
    log "INFO" "${RETAIN_DAYS}日以上前のバックアップを削除します..."
    local deleted_count=0
    while IFS= read -r old_file; do
        rm -f "$old_file"
        log "INFO" "削除: $old_file"
        ((deleted_count++)) || true
    done < <(find "$BACKUP_DIR" -name "bar_manager_*.sql.gz" -mtime "+${RETAIN_DAYS}" 2>/dev/null)
    log "INFO" "${deleted_count}件の古いバックアップを削除しました"

    # 4. Google ドライブの古いバックアップも削除（オプション）
    if command -v rclone &> /dev/null; then
        log "INFO" "Google ドライブの古いバックアップを削除します..."
        rclone delete "$RCLONE_REMOTE/" \
            --min-age "${RETAIN_DAYS}d" \
            --include "bar_manager_*.sql.gz" 2>> "$LOG_FILE" || true
    fi

    # 5. バックアップ一覧をログに記録
    log "INFO" "現在のローカルバックアップ一覧:"
    find "$BACKUP_DIR" -name "bar_manager_*.sql.gz" | sort | while read -r f; do
        local fsize
        fsize=$(du -sh "$f" | cut -f1)
        log "INFO" "  $f ($fsize)"
    done

    log "INFO" "=== バックアップ完了 ==="
}

# エラーハンドリング
trap 'log "ERROR" "バックアップ中にエラーが発生しました (line $LINENO)"' ERR

main "$@"
