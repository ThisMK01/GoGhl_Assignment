import { useEffect, useRef, useState } from 'react';
import type { SocketStatus, WsEvent } from '../types/inbox';

export function useWorkspaceSocket(
  workspace: string,
  onEvent: (event: WsEvent) => void
) {
  const [status, setStatus] = useState<SocketStatus>('disconnected');
  const lastSeqRef = useRef<number | undefined>(undefined);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    lastSeqRef.current = undefined;
    if (!workspace) {
      setStatus('disconnected');
      return;
    }

    let closedByCleanup = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closedByCleanup) return;
      setStatus('connecting');

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const afterQuery =
        lastSeqRef.current !== undefined ? `&after=${lastSeqRef.current}` : '';
      const url = `${proto}//${window.location.host}/ws?workspace=${encodeURIComponent(workspace)}${afterQuery}`;

      ws = new WebSocket(url);

      ws.onopen = () => {
        if (!closedByCleanup) setStatus('connected');
      };

      ws.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data) as WsEvent;
          if (typeof evt.seq === 'number') {
            lastSeqRef.current = Math.max(lastSeqRef.current ?? -1, evt.seq);
          }
          onEventRef.current(evt);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (closedByCleanup) return;
        setStatus('disconnected');
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [workspace]);

  return { socketStatus: status };
}
