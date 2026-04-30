'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Event } from '@/types';
import { AlertCircle, AlertTriangle, Check, Search, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const AlertsPage: React.FC = () => {
  const { events, acknowledgeAlarm } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [note, setNote] = useState('');

  const activeAlarms = events.filter(e => 
    e.type === 'alarm' && !e.acknowledgedBy && !e.resolved
  );
  
  const acknowledgedAlarms = events.filter(e => 
    e.type === 'alarm' && e.acknowledgedBy && !e.resolved
  );
  
  const resolvedAlarms = events.filter(e => 
    e.type === 'alarm' && e.resolved
  );

  const filteredActive = activeAlarms.filter(e =>
    e.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.parameter?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAcknowledge = (eventId: string, eventNote?: string) => {
    acknowledgeAlarm(eventId, eventNote);
    toast.success('Alarm acknowledged');
    setSelectedEvent(null);
    setNote('');
  };

  const AlarmCard = ({ event, showAcknowledge = true }: { event: Event; showAcknowledge?: boolean }) => (
    <Card 
      className={cn(
        "p-4 border-l-4",
        event.severity === 'critical' && "border-l-red-500 bg-red-500/5",
        event.severity === 'warning' && "border-l-yellow-500 bg-yellow-500/5"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          {event.severity === 'critical' ? (
            <AlertCircle className="size-5 text-red-500 mt-0.5" />
          ) : (
            <AlertTriangle className="size-5 text-yellow-500 mt-0.5" />
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{event.message}</h3>
              <Badge variant="outline" className={cn(
                event.severity === 'critical' && "bg-red-500/10 text-red-500 border-red-500/20",
                event.severity === 'warning' && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
              )}>
                {event.severity}
              </Badge>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
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
              <div className="mt-3 p-3 bg-background rounded border">
                <div className="text-sm">
                  <span className="text-muted-foreground">Acknowledged by:</span>{' '}
                  <span className="font-medium">{event.acknowledgedBy}</span>
                  <span className="text-muted-foreground ml-2">
                    at {format(event.acknowledgedAt!, 'HH:mm:ss')}
                  </span>
                </div>
                {event.note && (
                  <div className="text-sm mt-2">
                    <span className="text-muted-foreground">Note:</span> {event.note}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Alerts & Events</h1>
        <p className="text-muted-foreground">
          Monitor and manage system alarms and notifications
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="text-sm text-muted-foreground mb-1">Active Alarms</div>
          <div className="text-3xl font-bold">{activeAlarms.length}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-yellow-500">
          <div className="text-sm text-muted-foreground mb-1">Acknowledged</div>
          <div className="text-3xl font-bold">{acknowledgedAlarms.length}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-green-500">
          <div className="text-sm text-muted-foreground mb-1">Resolved (24h)</div>
          <div className="text-3xl font-bold">{resolvedAlarms.length}</div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search alarms by message or parameter..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">
            Active ({activeAlarms.length})
          </TabsTrigger>
          <TabsTrigger value="acknowledged">
            Acknowledged ({acknowledgedAlarms.length})
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved ({resolvedAlarms.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6 space-y-4">
          {filteredActive.length === 0 ? (
            <Card className="p-12 text-center">
              <Check className="size-12 mx-auto mb-4 text-green-500" />
              <h3 className="font-semibold mb-2">No Active Alarms</h3>
              <p className="text-muted-foreground">
                All systems operating normally
              </p>
            </Card>
          ) : (
            filteredActive.map(event => (
              <AlarmCard key={event.id} event={event} />
            ))
          )}
        </TabsContent>

        <TabsContent value="acknowledged" className="mt-6 space-y-4">
          {acknowledgedAlarms.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="size-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Acknowledged Alarms</h3>
              <p className="text-muted-foreground">
                Acknowledged alarms will appear here
              </p>
            </Card>
          ) : (
            acknowledgedAlarms.map(event => (
              <AlarmCard key={event.id} event={event} showAcknowledge={false} />
            ))
          )}
        </TabsContent>

        <TabsContent value="resolved" className="mt-6 space-y-4">
          {resolvedAlarms.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="size-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Resolved Alarms</h3>
              <p className="text-muted-foreground">
                Resolved alarms from the last 24 hours will appear here
              </p>
            </Card>
          ) : (
            resolvedAlarms.map(event => (
              <AlarmCard key={event.id} event={event} showAcknowledge={false} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};


export default AlertsPage;