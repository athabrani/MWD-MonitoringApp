'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Download, Calendar as CalendarIcon, FileSpreadsheet, FileJson } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import {
  downloadBlob,
  exportHistorical,
  ExportFormat,
} from '@/lib/exports-api';

export const ExportPage: React.FC = () => {
  const { token, user } = useAuth();
  const { activeMwdSessionId, activeMwdSession } = useApp();
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [exporting, setExporting] = useState(false);
  const canExport = user?.role === 'admin' || user?.role === 'engineer';

  const handleExport = async () => {
    if (!token) {
      toast.error('Please sign in before exporting data');
      return;
    }

    if (!canExport) {
      toast.error('Your role does not have export access');
      return;
    }

    if (!activeMwdSessionId) {
      toast.error('Select an active MWD session before exporting');
      return;
    }

    setExporting(true);

    try {
      const blob = await exportHistorical(token, {
        sessionId: activeMwdSessionId,
        format: exportFormat,
      });
      downloadBlob(blob, `historical-data.${exportFormat}`);

      toast.success('Historical export downloaded', {
        description: activeMwdSession ? activeMwdSession.name : undefined,
      });
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unable to export historical data.',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Export Data</h1>
        <p className="text-muted-foreground">
          Export drilling data, reports, and analysis for offline use
        </p>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-6">Export Configuration</h3>

        <div className="space-y-6">
          {/* Date Range */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <div className="grid grid-cols-2 gap-4">
              <Card 
                className={cn(
                  "p-4 cursor-pointer transition-colors",
                  exportFormat === 'csv' && "border-primary bg-primary/5"
                )}
                onClick={() => setExportFormat('csv')}
              >
                <FileSpreadsheet className="size-8 mb-2" />
                <div className="font-medium">CSV</div>
                <div className="text-xs text-muted-foreground">Raw data table</div>
              </Card>

              <Card 
                className={cn(
                  "p-4 cursor-pointer transition-colors",
                  exportFormat === 'json' && "border-primary bg-primary/5"
                )}
                onClick={() => setExportFormat('json')}
              >
                <FileJson className="size-8 mb-2" />
                <div className="font-medium">JSON</div>
                <div className="text-xs text-muted-foreground">Structured data</div>
              </Card>
            </div>
          </div>

          <Button onClick={() => void handleExport()} className="w-full" size="lg" disabled={exporting || !canExport}>
            <Download className="size-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export Data'}
          </Button>
        </div>
      </Card>

      <Card className="p-6 bg-muted">
        <h4 className="font-medium mb-2">Export Guidelines</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Date range filtering for export is a backend gap until /api/exports/historical supports measuredFrom/measuredTo</li>
          <li>CSV format is best for data analysis in spreadsheets</li>
          <li>JSON format is ideal for programmatic access</li>
          <li>Historical export sends only sessionId, format, depthMin, and depthMax when available</li>
        </ul>
      </Card>
    </div>
  );
};

export default ExportPage;
