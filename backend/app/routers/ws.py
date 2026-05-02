# WebSocketルーター
# テーブル状態変更のリアルタイム配信

import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """
    WebSocket接続を管理するクラス
    全クライアントへのブロードキャストを担当
    """

    def __init__(self):
        # アクティブな接続リスト
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """新しいWebSocket接続を受け入れてリストに追加"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket接続: 接続数={len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """切断されたWebSocket接続をリストから削除"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket切断: 接続数={len(self.active_connections)}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """特定のクライアントにメッセージを送信"""
        try:
            await websocket.send_text(json.dumps(message, ensure_ascii=False))
        except Exception as e:
            logger.error(f"個別メッセージ送信エラー: {e}")

    async def broadcast(self, message: dict):
        """
        全接続中クライアントにメッセージをブロードキャスト
        テーブルの状態変更時（セッション開始・終了）に呼ばれる
        """
        if not self.active_connections:
            return

        message_text = json.dumps(message, ensure_ascii=False, default=str)
        # 切断された接続を後でクリーンアップするためのリスト
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_text(message_text)
            except Exception as e:
                logger.error(f"ブロードキャストエラー: {e}")
                disconnected.append(connection)

        # 切断された接続をクリーンアップ
        for conn in disconnected:
            self.disconnect(conn)


# グローバルな接続マネージャーインスタンス
manager = ConnectionManager()


@router.websocket("/tables")
async def websocket_endpoint(websocket: WebSocket):
    """
    テーブル状態更新用WebSocketエンドポイント
    フロントエンドはこのエンドポイントに接続してリアルタイム更新を受信する

    メッセージフォーマット:
    {
        "type": "table_update",
        "data": {
            "id": テーブルID,
            "name": テーブル名,
            "status": "empty" | "occupied" | "reserved",
            "capacity": 定員
        }
    }
    """
    await manager.connect(websocket)

    # 接続成功メッセージを送信
    await manager.send_personal_message(
        {
            "type": "connected",
            "message": "バー管理システムに接続しました",
            "active_connections": len(manager.active_connections),
        },
        websocket
    )

    try:
        while True:
            # クライアントからのメッセージを受信
            # ping/pong または特定のコマンドを処理
            data = await websocket.receive_text()

            try:
                message = json.loads(data)

                # pingメッセージへのpong応答（接続維持）
                if message.get("type") == "ping":
                    await manager.send_personal_message(
                        {"type": "pong", "timestamp": message.get("timestamp")},
                        websocket
                    )
            except json.JSONDecodeError:
                # JSONデコードエラーは無視
                pass

    except WebSocketDisconnect:
        # 正常な切断
        manager.disconnect(websocket)
        logger.info("クライアントが切断しました")
    except Exception as e:
        # 予期しないエラー
        logger.error(f"WebSocketエラー: {e}")
        manager.disconnect(websocket)
