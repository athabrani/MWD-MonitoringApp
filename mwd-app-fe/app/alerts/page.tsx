'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Event } from '@/types';
import { AlertCircle, AlertTriangle, Check, Search, FileText, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const AlertsPage: React.FC = () => {
  const {
    events,
    acknowledgeAlarm,
    resolveAlarm,
    witsAlarmsLoading,
    witsAlarmsError,
    refreshWitsAlarms,
  } = useApp();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [note, setNote] = useState('');
  const canResolveAlarms = user?.role === 'engineer' || user?.role === 'admin';

  const activeAlarms = events.filter(e => 
    e.type === 'alarm' && !e.acknowledgedBy && !e.resolved
  );
  
  const acknowledgedAlarms = events.filter(e => 
    e.type === 'alarm' && e.acknowledgedBy && !e.resolved
  );
  
  const resolvedAlarms = events.filter(e => 
    e.type === 'alarm' && e.resolved
  );
  const notificationEvents = events.filter(e => e.type !== 'alarm');

  const filteredActive = activeAlarms.filter(e =>
    e.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.parameter?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredNotifications = notificationEvents.filter(e =>
    e.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.parameter?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAcknowledge = (eventId: string, eventNote?: string) => {
    acknowledgeAlarm(eventId, eventNote);
    toast.success('Alarm acknowledged');
    setSelectedEvent(null);
    setNote('');
  };

  const handleResolve = (eventId: string) => {
    resolveAlarm(eventId);
    toast.success('Alarm resolved');
  };

  const AlarmCard = ({ event, showAcknowledge = true }: { event: Event; showAcknowledge?: boolean }) => (
    <Card 
      className={cn(
        "border-l-4 p-3 sm:p-4",
        event.severity === 'critical' && "border-l-red-500 bg-red-500/5",
        event.severity === 'warning' && "border-l-yellow-500 bg-yellow-500/5"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 items-start gap-2 sm:gap-3">
          {event.severity === 'critical' ? (
            <AlertCircle className="mt-0.5 size-4 text-red-500 sm:size-5" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 text-yellow-500 sm:size-5" />
          )}
          
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h3 className="text-sm font-semibold leading-snug sm:text-base">{event.message}</h3>
              <Badge variant="outline" className={cn(
                "h-5 px-1.5 text-[10px] sm:h-6 sm:px-2 sm:text-xs",
                event.severity === 'critical' && "bg-red-500/10 text-red-500 border-red-500/20",
                event.severity === 'warning' && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
              )}>
                {event.severity}
              </Badge>
            </div>
            
            <div className="space-y-0.5 text-xs leading-snug text-muted-foreground sm:space-y-1 sm:text-sm">
              <div>Time: {format(event.timestamp, 'PPpp')}</div>
              {event.parameter && (
                <div>Parameter: <Badge variant="secondary">{event.parameter}</Badge></div>
              )}
              {event.value !== undefined && event.threshold !== undefined && (
                <div>
                  Value: <span className="font-mono">{event.value.toFixed(2)}</span> / 
                  Threshold: <span className="font-mono">{event.threshold}</span>
                </div>
              )}
              {event.source && (
                <div>Source: <Badge variant="secondary">{event.source}</Badge></div>
              )}
            </div>

            {event.acknowledgedBy && (
              <div className="mt-2 rounded border bg-background p-2 sm:mt-3 sm:p-3">
                <div className="text-xs sm:text-sm">
                  <span className="text-muted-foreground">Acknowledged by:</span>{' '}
                  <span className="font-medium">{event.acknowledgedBy}</span>
                  <span className="text-muted-foreground ml-2">
                    at {format(event.acknowledgedAt!, 'HH:mm:ss')}
                  </span>
                </div>
                {event.note && (
                  <div className="mt-1 text-xs sm:mt-2 sm:text-sm">
                    <span className="text-muted-foreground">Note:</span> {event.note}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {showAcknowledge && !event.acknowledgedBy && (
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSelectedEvent(event)}
                >
                  <Check className="size-4 mr-2" />
                  Acknowledge
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Acknowledge Alarm</DialogTitle>
                  <DialogDescription>
                    Confirm that you have reviewed this alarm and taken appropriate action.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium">{event.message}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {format(event.timestamp, 'PPpp')}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">Add Note (optional)</Label>
                    <Textarea
                      id="note"
                      placeholder="Describe action taken or observations..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setNote('')}>
                    Cancel
                  </Button>
                  <Button onClick={() => handleAcknowledge(event.id, note)}>
                    Acknowledge Alarm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {canResolveAlarms && !event.resolved ? (
            <Button size="sm" variant="outline" onClick={() => handleResolve(event.id)}>
              Resolve
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );

  const NotificationCard = ({ event }: { event: Event }) => (
    <Card
      className={cn(
        "border-l-4 p-3 sm:p-4",
        event.severity === 'critical' && "border-l-red-500 bg-red-500/5",
        event.severity === 'warning' && "border-l-yellow-500 bg-yellow-500/5",
        event.severity === 'info' && "border-l-blue-500 bg-blue-500/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h3 className="text-sm font-semibold leading-snug sm:text-base">{event.message}</h3>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] sm:h-6 sm:px-2 sm:text-xs">{event.type}</Badge>
            <Badge
              variant="outline"
              className={cn(
                "h-5 px-1.5 text-[10px] sm:h-6 sm:px-2 sm:text-xs",
                event.severity === 'critical' && "bg-red-500/10 text-red-500 border-red-500/20",
                event.severity === 'warning' && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                event.severity === 'info' && "bg-blue-500/10 text-blue-500 border-blue-500/20"
              )}
            >
              {event.severity}
            </Badge>
          </div>
          <div className="mt-1.5 space-y-0.5 text-xs leading-snug text-muted-foreground sm:mt-2 sm:space-y-1 sm:text-sm">
            <div>Time: {format(event.timestamp, 'PPpp')}</div>
            {event.parameter ? <div>Parameter: <Badge variant="secondary">{event.parameter}</Badge></div> : null}
            {event.source ? <div>Source: <Badge variant="secondary">{event.source}</Badge></div> : null}
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 sm:mb-2 sm:gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Alerts & Events</h1>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshWitsAlarms()}
            disabled={witsAlarmsLoading}
            aria-label="Refresh WITS alarms"
            className="h-9 px-2.5 sm:px-3"
          >
            <RefreshCw className={cn("size-4 sm:mr-2", witsAlarmsLoading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh WITS Alarms</span>
          </Button>
        </div>
        <p className="text-sm leading-snug text-muted-foreground sm:text-base">
          Monitor and manage system alarms and notifications
        </p>
        {witsAlarmsError ? (
          <p className="mt-1.5 text-xs text-destructive sm:mt-2 sm:text-sm">Gagal memuat data dari backend.</p>
        ) : null}
      </div>

      {/* Summary Stats */}
      <div className="grid gap-2 min-[420px]:grid-cols-2 sm:gap-3 md:grid-cols-4">
        <Card className="border-l-4 border-l-red-500 p-3 sm:p-4">
          <div className="mb-0.5 text-xs text-muted-foreground sm:mb-1 sm:text-sm">Active Alarms</div>
          <div className="text-2xl font-bold leading-tight sm:text-3xl">{activeAlarms.length}</div>
        </Card>
        <Card className="border-l-4 border-l-yellow-500 p-3 sm:p-4">
          <div className="mb-0.5 text-xs text-muted-foreground sm:mb-1 sm:text-sm">Acknowledged</div>
          <div className="text-2xl font-bold leading-tight sm:text-3xl">{acknowledgedAlarms.length}</div>
        </Card>
        <Card className="border-l-4 border-l-green-500 p-3 sm:p-4">
          <div className="mb-0.5 text-xs text-muted-foreground sm:mb-1 sm:text-sm">Resolved (24h)</div>
          <div className="text-2xl font-bold leading-tight sm:text-3xl">{resolvedAlarms.length}</div>
        </Card>
        <Card className="border-l-4 border-l-blue-500 p-3 sm:p-4">
          <div className="mb-0.5 text-xs text-muted-foreground sm:mb-1 sm:text-sm">Notifications</div>
          <div className="text-2xl font-bold leading-tight sm:text-3xl">{notificationEvents.length}</div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search alarms by message or parameter..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-9 pl-9 text-sm sm:h-10 sm:pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="active" className="min-h-8 text-[11px] sm:text-sm">
            Active ({activeAlarms.length})
          </TabsTrigger>
          <TabsTrigger value="acknowledged" className="min-h-8 text-[11px] sm:text-sm">
            Acknowledged ({acknowledgedAlarms.length})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="min-h-8 text-[11px] sm:text-sm">
            Resolved ({resolvedAlarms.length})
          </TabsTrigger>
          <TabsTrigger value="notifications" className="min-h-8 text-[11px] sm:text-sm">
            Notifications ({notificationEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
          {filteredActive.length === 0 ? (
            <Card className="p-6 text-center sm:p-12">
              <Check className="mx-auto mb-2 size-8 text-green-500 sm:mb-4 sm:size-12" />
              <h3 className="mb-1 text-sm font-semibold sm:mb-2 sm:text-base">Belum ada alarm.</h3>
              <p className="text-sm text-muted-foreground sm:text-base">
                All systems operating normally
              </p>
            </Card>
          ) : (
            filteredActive.map(event => (
              <AlarmCard key={event.id} event={event} />
            ))
          )}
        </TabsContent>

        <TabsContent value="acknowledged" className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
          {acknowledgedAlarms.length === 0 ? (
            <Card className="p-6 text-center sm:p-12">
              <FileText className="mx-auto mb-2 size-8 text-muted-foreground sm:mb-4 sm:size-12" />
              <h3 className="mb-1 text-sm font-semibold sm:mb-2 sm:text-base">Belum ada alarm.</h3>
              <p className="text-sm text-muted-foreground sm:text-base">
                Acknowledged alarms will appear here
              </p>
            </Card>
          ) : (
            acknowledgedAlarms.map(event => (
              <AlarmCard key={event.id} event={event} showAcknowledge={false} />
            ))
          )}
        </TabsContent>

        <TabsContent value="resolved" className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
          {resolvedAlarms.length === 0 ? (
            <Card className="p-6 text-center sm:p-12">
              <FileText className="mx-auto mb-2 size-8 text-muted-foreground sm:mb-4 sm:size-12" />
              <h3 className="mb-1 text-sm font-semibold sm:mb-2 sm:text-base">Belum ada alarm.</h3>
              <p className="text-sm text-muted-foreground sm:text-base">
                Resolved alarms from the last 24 hours will appear here
              </p>
            </Card>
          ) : (
            resolvedAlarms.map(event => (
              <AlarmCard key={event.id} event={event} showAcknowledge={false} />
            ))
          )}
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
          {filteredNotifications.length === 0 ? (
            <Card className="p-6 text-center sm:p-12">
              <FileText className="mx-auto mb-2 size-8 text-muted-foreground sm:mb-4 sm:size-12" />
              <h3 className="mb-1 text-sm font-semibold sm:mb-2 sm:text-base">Belum ada notification.</h3>
              <p className="text-sm text-muted-foreground sm:text-base">
                Connection, failover, health, and system notifications will appear here.
              </p>
            </Card>
          ) : (
            filteredNotifications.map(event => (
              <NotificationCard key={event.id} event={event} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};


export default AlertsPage;
