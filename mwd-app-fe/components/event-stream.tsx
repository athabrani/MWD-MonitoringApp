import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Event, EventSeverity, EventType } from '../types';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Wifi,
  User,
  Settings,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface EventStreamProps {
  events: Event[];
  maxHeight?: number;
  title?: string;
  emptyMessage?: string;
}

export const EventStream: React.FC<EventStreamProps> = ({
  events,
  maxHeight = 400,
  title = 'Event Stream',
  emptyMessage = 'No matching events in this stream.',
}) => {
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all');

  const getEventIcon = (event: Event) => {
    switch (event.type) {
      case 'alarm':
        return event.severity === 'critical' ? (
          <AlertCircle className="size-4" />
        ) : (
          <AlertTriangle className="size-4" />
        );
      case 'connection':
      case 'failover':
        return <Wifi className="size-4" />;
      case 'user_action':
        return <User className="size-4" />;
      case 'system':
        return <Settings className="size-4" />;
      default:
        return <Info className="size-4" />;
    }
  };

  const getSeverityColor = (severity: EventSeverity) => {
    switch (severity) {
      case 'critical':
        return 'border-l-red-500 bg-red-500/5';
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-500/5';
      case 'info':
        return 'border-l-blue-500 bg-blue-500/5';
    }
  };

  const getSeverityBadgeColor = (severity: EventSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'info':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const filteredEvents = events.filter((event) => {
    if (severityFilter !== 'all' && event.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && event.type !== typeFilter) return false;
    return true;
  });

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as EventSeverity | 'all')}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as EventType | 'all')}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="alarm">Alarm</SelectItem>
              <SelectItem value="connection">Connection</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="user_action">User Action</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="pr-4" style={{ height: maxHeight }}>
        {filteredEvents.length ? (
          <div className="space-y-2">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className={cn('rounded-lg border-l-4 p-3', getSeverityColor(event.severity))}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        event.severity === 'critical' && 'text-red-500',
                        event.severity === 'warning' && 'text-yellow-500',
                        event.severity === 'info' && 'text-blue-500'
                      )}
                    >
                      {getEventIcon(event)}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{event.message}</p>
                      {event.parameter && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {event.parameter}: {event.value}{' '}
                          {event.threshold && `(threshold: ${event.threshold})`}
                        </p>
                      )}
                      {event.acknowledgedBy && (
                        <p className="mt-1 text-xs text-green-500">
                          ✓ Acknowledged by {event.acknowledgedBy}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className={cn('text-xs', getSeverityBadgeColor(event.severity))}
                    >
                      {event.severity}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(event.timestamp, 'HH:mm:ss')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};
