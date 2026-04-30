'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Calendar as CalendarIcon, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const ExportPage: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [exportFormat, setExportFormat] = useState('csv');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeAlarms, setIncludeAlarms] = useState(true);

  const handleExport = () => {
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    toast.success(`Exporting data as ${exportFormat.toUpperCase()}...`);
    
    setTimeout(() => {
      toast.success('Export completed successfully');
    }, 2000);
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
            <div className="grid grid-cols-3 gap-4">
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

              <Card 
                className={cn(
                  "p-4 cursor-pointer transition-colors",
                  exportFormat === 'pdf' && "border-primary bg-primary/5"
                )}
                onClick={() => setExportFormat('pdf')}
              >
                <FileText className="size-8 mb-2" />
                <div className="font-medium">PDF</div>
                <div className="text-xs text-muted-foreground">Report document</div>
              </Card>
            </div>
          </div>

          {/* Additional Options */}
          <div className="space-y-3">
            <Label>Include in Export</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="include-charts"
                  checked={includeCharts}
                  onCheckedChange={(checked) => setIncludeCharts(checked as boolean)}
                />
                <Label htmlFor="include-charts" className="cursor-pointer">
                  Include charts and visualizations (PDF only)
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  id="include-alarms"
                  checked={includeAlarms}
                  onCheckedChange={(checked) => setIncludeAlarms(checked as boolean)}
                />
                <Label htmlFor="include-alarms" className="cursor-pointer">
                  Include alarm events and acknowledgments
                </Label>
              </div>
            </div>
          </div>

          <Button onClick={handleExport} className="w-full" size="lg">
            <Download className="size-4 mr-2" />
            Export Data
          </Button>
        </div>
      </Card>

      <Card className="p-6 bg-muted">
        <h4 className="font-medium mb-2">Export Guidelines</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Large date ranges may take longer to process</li>
          <li>CSV format is best for data analysis in spreadsheets</li>
          <li>JSON format is ideal for programmatic access</li>
          <li>PDF format provides a comprehensive report with visualizations</li>
          <li>Maximum export range is 30 days for performance reasons</li>
        </ul>
      </Card>
    </div>
  );
};

export default ExportPage;