'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  const [depthMin, setDepthMin] = useState('');
  const [depthMax, setDepthMax] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [exporting, setExporting] = useState(false);
  const canExport = user?.role === 'admin' || user?.role === 'engineer';

  const readDepthFilter = (value: string, label: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${label} must be a valid number.`);
    }
    return parsed;
  };

  const buildHistoricalExportPayload = () => {
    if (startDate && endDate && endDate < startDate) {
      throw new Error('Start date must be before or equal to end date.');
    }

    const parsedDepthMin = readDepthFilter(depthMin, 'Depth min');
    const parsedDepthMax = readDepthFilter(depthMax, 'Depth max');

    if (
      typeof parsedDepthMin === 'number' &&
      typeof parsedDepthMax === 'number' &&
      parsedDepthMin > parsedDepthMax
    ) {
      throw new Error('Depth min must be less than or equal to depth max.');
    }

    const payload: {
      sessionId: string;
      format: ExportFormat;
      measuredFrom?: string;
      measuredTo?: string;
      depthMin?: number;
      depthMax?: number;
    } = {
      sessionId: activeMwdSessionId,
      format: exportFormat,
    };

    if (startDate) {
      payload.measuredFrom = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        0,
        0,
        0,
        0
      ).toISOString();
    }

    if (endDate) {
      payload.measuredTo = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
        23,
        59,
        59,
        999
      ).toISOString();
    }

    if (typeof parsedDepthMin === 'number') payload.depthMin = parsedDepthMin;
    if (typeof parsedDepthMax === 'number') payload.depthMax = parsedDepthMax;

    return payload;
  };

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
      const blob = await exportHistorical(token, buildHistoricalExportPayload());
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
              <div className="flex items-center justify-between gap-2">
                <Label>Measured From</Label>
                {startDate ? (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setStartDate(undefined)}>
                    Clear
                  </Button>
                ) : null}
              </div>
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
              <div className="flex items-center justify-between gap-2">
                <Label>Measured To</Label>
                {endDate ? (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEndDate(undefined)}>
                    Clear
                  </Button>
                ) : null}
              </div>
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

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="export-depth-min">Depth Min</Label>
              <Input
                id="export-depth-min"
                type="number"
                inputMode="decimal"
                value={depthMin}
                onChange={(event) => setDepthMin(event.target.value)}
                placeholder="Optional start depth"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-depth-max">Depth Max</Label>
              <Input
                id="export-depth-max"
                type="number"
                inputMode="decimal"
                value={depthMax}
                onChange={(event) => setDepthMax(event.target.value)}
                placeholder="Optional end depth"
              />
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
          <li>Date range and depth range are sent to /api/exports/historical when filled.</li>
          <li>If both filter types are filled, backend should apply AND filtering.</li>
          <li>CSV format is best for data analysis in spreadsheets</li>
          <li>JSON format is ideal for programmatic access</li>
          <li>Empty filter fields are omitted from the export payload.</li>
        </ul>
      </Card>
    </div>
  );
};

export default ExportPage;
