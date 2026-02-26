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
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface EventStreamProps {
  events: Event[];
  maxHeight?: number;
}

export const EventStream: React.FC<EventStreamProps> = ({ 
  events, 
  maxHeight = 400 
}) => {
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all');

  const getEventIcon = (event: Event) => {
    switch (event.type) {
      case 'alarm':
        return event.severity === 'critical' 
          ? <AlertCircle className="size-4" />
          : <AlertTriangle className="size-4" />;
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

  const filteredEvents = events.filter(event => {
    if (severityFilter !== 'all' && event.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && event.type !== typeFilter) return false;
    return true;
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Event Stream</h3>
        <div className="flex items-center gap-2">
          <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
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
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
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
        <div className="space-y-2">
          {filteredEvents.map(event => (
            <div
              key={event.id}
              className={cn(
                "p-3 rounded-lg border-l-4",
                getSeverityColor(event.severity)
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <span className={cn(
                    event.severity === 'critical' && 'text-red-500',
                    event.severity === 'warning' && 'text-yellow-500',
                    event.severity === 'info' && 'text-blue-500'
                  )}>
                    {getEventIcon(event)}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{event.message}</p>
                    {event.parameter && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {event.parameter}: {event.value} {event.threshold && `(threshold: ${event.threshold})`}
                      </p>
                    )}
                    {event.acknowledgedBy && (
                      <p className="text-xs text-green-500 mt-1">
                        ✓ Acknowledged by {event.acknowledgedBy}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={cn("text-xs", getSeverityBadgeColor(event.severity))}>
                    {event.severity}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(event.timestamp, 'HH:mm:ss')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};
