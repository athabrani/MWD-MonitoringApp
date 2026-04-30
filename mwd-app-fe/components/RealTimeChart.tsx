'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import { ChartDataPoint } from '../types';
import { Lock, Unlock } from 'lucide-react';
import { format } from 'date-fns';

interface RealTimeChartProps {
  data: ChartDataPoint[];
  title: string;
  availableParameters: Array<{
    key: string;
    label: string;
    color: string;
    unit: string;
  }>;
  defaultParameters?: string[];
  timeWindow?: '5min' | '15min' | '1hr';
  onTimeWindowChange?: (window: '5min' | '15min' | '1hr') => void;
}

export const RealTimeChart: React.FC<RealTimeChartProps> = ({
  data,
  title,
  availableParameters,
  defaultParameters = [],
  timeWindow = '15min',
  onTimeWindowChange
}) => {
  const [selectedParams, setSelectedParams] = useState<string[]>(
    defaultParameters.length > 0 ? defaultParameters : [availableParameters[0]?.key]
  );
  const [scaleLocked, setScaleLocked] = useState(false);

  const toggleParameter = (key: string) => {
    setSelectedParams(prev => 
      prev.includes(key) 
        ? prev.filter(p => p !== key)
        : [...prev, key]
    );
  };

  const getFilteredData = () => {
    const now = Date.now();
    const windowMs = timeWindow === '5min' ? 5 * 60000 : timeWindow === '15min' ? 15 * 60000 : 60 * 60000;
    return data.filter(d => now - d.timestamp.getTime() < windowMs);
  };

  const filteredData = getFilteredData();

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={timeWindow === '5min' ? 'default' : 'outline'}
            onClick={() => onTimeWindowChange?.('5min')}
          >
            5 min
          </Button>
          <Button
            size="sm"
            variant={timeWindow === '15min' ? 'default' : 'outline'}
            onClick={() => onTimeWindowChange?.('15min')}
          >
            15 min
          </Button>
          <Button
            size="sm"
            variant={timeWindow === '1hr' ? 'default' : 'outline'}
            onClick={() => onTimeWindowChange?.('1hr')}
          >
            1 hr
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setScaleLocked(!scaleLocked)}
          >
            {scaleLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        {availableParameters.map(param => (
          <div key={param.key} className="flex items-center gap-2">
            <Checkbox
              id={param.key}
              checked={selectedParams.includes(param.key)}
              onCheckedChange={() => toggleParameter(param.key)}
            />
            <Label 
              htmlFor={param.key} 
              className="text-sm flex items-center gap-1 cursor-pointer"
            >
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: param.color }}
              />
              {param.label}
            </Label>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={filteredData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="timestamp"
            tickFormatter={(value) => format(new Date(value), 'HH:mm')}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
            labelFormatter={(value) => format(new Date(value), 'HH:mm:ss')}
          />
          <Legend />
          {availableParameters
            .filter(p => selectedParams.includes(p.key))
            .map(param => (
              <Line
                key={param.key}
                type="monotone"
                dataKey={param.key}
                name={`${param.label} (${param.unit})`}
                stroke={param.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};
