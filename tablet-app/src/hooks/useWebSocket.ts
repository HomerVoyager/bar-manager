// ============================================================
// useWebSocket カスタムフック
// リアルタイム更新のためのWebSocket接続管理
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebSocketMessage } from '../types';
import { STORAGE_KEYS } from '../api/client';

// WebSocketの接続状態
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// フックの戻り値の型
interface UseWebSocketReturn {
  status: ConnectionStatus;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: WebSocketMessage) => void;
  reconnect: () => void;
}

// デフォルトのWebSocket URL
const DEFAULT_WS_URL = 'ws://localhost:8000/ws';

// 再接続の最大試行回数
const MAX_RECONNECT_ATTEMPTS = 5;
// 再接続の待機時間（ミリ秒）
const RECONNECT_INTERVAL = 3000;

/**
 * WebSocket接続カスタムフック
 * テーブルマップとオーダー画面のリアルタイム更新に使用
 */
export const useWebSocket = (
  onMessage?: (message: WebSocketMessage) => void
): UseWebSocketReturn => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldConnect = useRef<boolean>(true);

  /**
   * WebSocket接続を開始する
   */
  const connect = useCallback(async () => {
    // 接続フラグが落ちている場合は接続しない
    if (!shouldConnect.current) return;

    try {
      // カスタムベースURLからWebSocket URLを生成
      const baseUrl = await AsyncStorage.getItem(STORAGE_KEYS.BASE_URL);
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

      let wsUrl = DEFAULT_WS_URL;
      if (baseUrl) {
        // http:// -> ws://, https:// -> wss:// に変換
        wsUrl = baseUrl
          .replace('/api/v1', '')
          .replace('https://', 'wss://')
          .replace('http://', 'ws://');
        wsUrl += '/ws';
      }

      // トークンをクエリパラメータで渡す
      if (token) {
        wsUrl += `?token=${encodeURIComponent(token)}`;
      }

      console.log('WebSocket接続開始:', wsUrl.split('?')[0]); // トークンはログに出さない
      setStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // 接続成功
      ws.onopen = () => {
        console.log('WebSocket接続確立');
        setStatus('connected');
        reconnectAttempts.current = 0;

        // 定期的なpingを送信してconnectionを維持する（30秒ごと）
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ping',
              timestamp: new Date().toISOString(),
            }));
          } else {
            clearInterval(pingInterval);
          }
        }, 30000);
      };

      // メッセージ受信
      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // pongメッセージは無視（ハートビート応答）
          if (message.type === 'pong') return;

          setLastMessage(message);
          // コールバックが設定されていれば呼び出す
          if (onMessage) {
            onMessage(message);
          }
        } catch (err) {
          console.warn('WebSocketメッセージパースエラー:', err);
        }
      };

      // エラー発生
      ws.onerror = (event) => {
        console.error('WebSocketエラー:', event);
        setStatus('error');
      };

      // 接続切断
      ws.onclose = (event) => {
        console.warn(`WebSocket切断: コード=${event.code}, 理由=${event.reason}`);
        setStatus('disconnected');
        wsRef.current = null;

        // 自動再接続（shouldConnectフラグが立っている場合）
        if (shouldConnect.current && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current += 1;
          console.log(
            `WebSocket再接続試行 ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS}...`
          );
          reconnectTimer.current = setTimeout(connect, RECONNECT_INTERVAL);
        } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          console.error('WebSocket再接続の最大試行回数に達しました');
          setStatus('error');
        }
      };
    } catch (err) {
      console.error('WebSocket接続エラー:', err);
      setStatus('error');
    }
  }, [onMessage]);

  /**
   * WebSocket接続を切断する
   */
  const disconnect = useCallback(() => {
    shouldConnect.current = false;
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, '正常切断');
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  /**
   * 手動で再接続する
   */
  const reconnect = useCallback(() => {
    shouldConnect.current = true;
    reconnectAttempts.current = 0;
    disconnect();
    // 少し待ってから再接続
    setTimeout(() => {
      shouldConnect.current = true;
      connect();
    }, 500);
  }, [connect, disconnect]);

  /**
   * WebSocketメッセージを送信する
   */
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocketが接続されていません。メッセージを送信できません。');
    }
  }, []);

  // マウント時に接続、アンマウント時に切断
  useEffect(() => {
    shouldConnect.current = true;
    connect();

    return () => {
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    lastMessage,
    sendMessage,
    reconnect,
  };
};
