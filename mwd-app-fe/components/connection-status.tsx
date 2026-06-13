'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  RefreshCw,
  Database,
  Clock,
  Activity
} from 'lucide-react';
import { ConnectionState } from '../types';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  onReconnect?: () => void;
  compact?: boolean;
  showMetricsInCompact?: boolean;
  showReconnectAction?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  connectionState, 
  onReconnect,
  compact = false,
  showMetricsInCompact = false,
  showReconnectAction = true,
}) => {
  const { status, latency, latencySource, packetLoss, lastReceived, dataSource, reconnecting } = connectionState;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <Wifi className="size-4" />;
      case 'degraded':
        return <AlertTriangle className="size-4" />;
      case 'offline':
        return <WifiOff className="size-4" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'degraded':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'offline':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
  };

  const timeSinceLastData =
    lastReceived instanceof Date && !Number.isNaN(lastReceived.getTime())
      ? Math.floor((now - lastReceived.getTime()) / 1000)
      : null;
  const formatLatency = (value?: number) =>
    typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(0)} ms` : '- ms';
  const formatPacketLoss = (value?: number) =>
    typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : '- %';
  const latencyLabel =
    latencySource === 'api-probe' ? 'API' : latencySource === 'connection-status' ? 'Conn' : 'Latency';
  const latencyTitle =
    latencySource === 'api-probe'
      ? 'Backend API probe latency via /api/mwd-sessions.'
      : latencySource === 'connection-status'
        ? 'Connection status latency from /api/connection-status.'
        : 'Latency metric unavailable.';

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge
          variant="outline"
          data-testid="connection-status"
          className={cn("gap-1.5", getStatusColor())}
        >
          {getStatusIcon()}
          <span className="capitalize">{status}</span>
        </Badge>
        {showMetricsInCompact && (
          <>
            <div
              className="flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground"
              title={latencyTitle}
              aria-label={`${latencyLabel} latency ${formatLatency(latency)}`}
            >
              <Activity className="size-3" />
              <span className="font-medium">{latencyLabel}</span>
              <span>{formatLatency(latency)}</span>
            </div>
            <div className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
              Loss {formatPacketLoss(packetLoss)}
            </div>
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <span>{timeSinceLastData === null ? 'No data' : `${timeSinceLastData}s`}</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {dataSource === 'primary' ? 'Primary' : 'Backup'}
            </Badge>
          </>
        )}
        {showReconnectAction && onReconnect && status !== 'connected' && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onReconnect}
            disabled={reconnecting}
          >
            {reconnecting ? (
              <>
                <RefreshCw className="size-3 mr-1 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <RefreshCw className="size-3 mr-1" />
                Reconnect
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 bg-card border rounded-lg p-3">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          data-testid="connection-status"
          className={cn("gap-1.5", getStatusColor())}
        >
          {getStatusIcon()}
          <span className="capitalize">{status}</span>
        </Badge>
      </div>

      <div
        className="flex items-center gap-1 text-sm text-muted-foreground"
        title={latencyTitle}
        aria-label={`${latencyLabel} latency ${formatLatency(latency)}`}
      >
        <Activity className="size-3" />
        <span>{latencyLabel}:</span>
        <span>{formatLatency(latency)}</span>
      </div>

      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span>Loss: {formatPacketLoss(packetLoss)}</span>
      </div>

      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Clock className="size-3" />
        <span>{timeSinceLastData === null ? 'No backend data yet' : `${timeSinceLastData}s ago`}</span>
      </div>

      <div className="flex items-center gap-1 text-sm">
        <Database className="size-3" />
        <Badge variant="secondary" className="text-xs">
          {dataSource === 'primary' ? 'Primary' : 'Backup'}
        </Badge>
      </div>

      {showReconnectAction && onReconnect && status !== 'connected' && (
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onReconnect}
          disabled={reconnecting}
        >
          {reconnecting ? (
            <>
              <RefreshCw className="size-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <RefreshCw className="size-4 mr-2" />
              Reconnect
            </>
          )}
        </Button>
      )}
    </div>
  );
};
