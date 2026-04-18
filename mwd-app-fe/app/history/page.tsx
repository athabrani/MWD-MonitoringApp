import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RealTimeChart } from '@/components/contents/charts/real-time-chart';
import { generateMockChartData } from '@/data/mock-data';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const HistoryPage: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const historicalData = generateMockChartData(24); // 24 hours of data

  const chartParameters = [
    { key: 'rop', label: 'ROP', color: '#10b981', unit: 'm/hr' },
    { key: 'wob', label: 'WOB', color: '#3b82f6', unit: 'klbs' },
    { key: 'rpm', label: 'RPM', color: '#8b5cf6', unit: 'rpm' },
    { key: 'gamma', label: 'Gamma', color: '#84cc16', unit: 'API' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Historical Data</h1>
        <p className="text-muted-foreground">
          View and analyze past drilling operations
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(!startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 size-4" />
                  {startDate ? format(startDate, "PPP") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
              </PopoverContent>
            </Popover>
          </div>

          <span className="text-muted-foreground">to</span>

          <div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(!endDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 size-4" />
                  {endDate ? format(endDate, "PPP") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
              </PopoverContent>
            </Popover>
          </div>

          <Button className="ml-auto" onClick={() => toast.success('Data loaded')}>
            Load Data
          </Button>
          <Button variant="outline">
            <Download className="size-4 mr-2" />
            Export
          </Button>
        </div>

        <RealTimeChart
          data={historicalData}
          title="Historical Data - Last 24 Hours"
          availableParameters={chartParameters}
          defaultParameters={['rop', 'wob']}
        />
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Alarms</div>
          <div className="text-3xl font-bold">47</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Avg Latency</div>
          <div className="text-3xl font-bold">52ms</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Data Gaps</div>
          <div className="text-3xl font-bold">2</div>
        </Card>
      </div>
    </div>
  );
};

export default HistoryPage;