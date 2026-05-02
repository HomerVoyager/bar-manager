// バー管理システム - WebSocketフック
// リアルタイム更新のためのWebSocket接続を管理します
// テーブルステータスの変更をリアルタイムで受信します

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage } from '../types';

// WebSocketフックの返り値の型定義
interface UseWebSocketReturn {
  lastMessage: WebSocketMessage | null;
  sendMessage: (data: unknown) => void;
  isConnected: boolean;
}

// WebSocket接続のURL
const WS_URL = 'ws://localhost:8000/ws/tables';

// 再接続の遅延時間（ミリ秒）
const RECONNECT_DELAY = 3000;

export const useWebSocket = (): UseWebSocketReturn => {
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // アンマウント後の再接続を防ぐフラグ
  const isMountedRef = useRef(true);

  // WebSocket接続を確立する関数
  const connect = useCallback(() => {
    // 既存の接続がある場合はクローズ
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }

    try {
      // 認証トークンをクエリパラメータで渡す
      const token = localStorage.getItem('auth_token');
      const url = token ? `${WS_URL}?token=${token}` : WS_URL;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      // 接続確立時の処理
      ws.onopen = () => {
        if (isMountedRef.current) {
          setIsConnected(true);
          console.log('WebSocket接続確立');
        }
      };

      // メッセージ受信時の処理
      ws.onmessage = (event) => {
        if (isMountedRef.current) {
          try {
            // JSONメッセージをパース
            const data = JSON.parse(event.data) as WebSocketMessage;
            setLastMessage(data);
          } catch (error) {
            console.warn('WebSocketメッセージのパースに失敗しました:', error);
          }
        }
      };

      // 接続切断時の処理（自動再接続）
      ws.onclose = () => {
        if (isMountedRef.current) {
          setIsConnected(false);
          console.log(`WebSocket切断。${RECONNECT_DELAY / 1000}秒後に再接続します...`);
          // 指定遅延後に再接続
          reconnectTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, RECONNECT_DELAY);
        }
      };

      // エラー発生時の処理
      ws.onerror = (error) => {
        console.error('WebSocketエラー:', error);
        // エラー後はoncloseが呼ばれて自動再接続される
      };
    } catch (error) {
      console.error('WebSocket接続の作成に失敗しました:', error);
      // 接続失敗時も再接続を試みる
      reconnectTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          connect();
        }
      }, RECONNECT_DELAY);
    }
  }, []);

  // コンポーネントマウント時に接続を開始
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    // クリーンアップ: アンマウント時に接続を閉じる
    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // メッセージ送信関数
  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket未接続のため、メッセージを送信できません');
    }
  }, []);

  return { lastMessage, sendMessage, isConnected };
};

export default useWebSocket;
