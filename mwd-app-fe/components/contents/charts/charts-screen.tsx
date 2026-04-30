'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RealTimeChart } from '@/components/contents/charts/real-time-chart';
import { LineChart, Download, Star, TrendingUp, Droplets, Navigation, Mountain, Wrench } from 'lucide-react';
import { toast } from 'sonner';

const parameterLibrary = {
  drilling: [
    { key: 'rop', label: 'Rate of Penetration', color: '#10b981', unit: 'm/hr' },
    { key: 'wob', label: 'Weight on Bit', color: '#3b82f6', unit: 'klbs' },
    { key: 'rpm', label: 'Rotary Speed', color: '#8b5cf6', unit: 'rpm' },
  ],
  mud: [
    { key: 'spp', label: 'Standpipe Pressure', color: '#f59e0b', unit: 'psi' },
    { key: 'flowrate', label: 'Flow Rate', color: '#06b6d4', unit: 'gpm' },
  ],
  directional: [
    { key: 'inc', label: 'Inclination', color: '#ec4899', unit: '°' },
    { key: 'azi', label: 'Azimuth', color: '#14b8a6', unit: '°' },
  ],
  formation: [
    { key: 'gamma', label: 'Gamma Ray', color: '#84cc16', unit: 'API' },
  ]
};

export const ChartsScreen: React.FC = () => {
  const { chartData } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('drilling');
  const [pinnedCharts, setPinnedCharts] = useState<string[]>(['rop', 'wob']);

  const togglePinChart = (paramKey: string) => {
    setPinnedCharts(prev => 
      prev.includes(paramKey) 
        ? prev.filter(p => p !== paramKey)
        : [...prev, paramKey]
    );
  };

  const allParameters = Object.values(parameterLibrary).flat();
  const pinnedParams = allParameters.filter(p => pinnedCharts.includes(p.key));

  const handleExportChart = () => {
    toast.success('Chart exported as PNG');
  };

  const CategoryIcon = ({ category }: { category: string }) => {
    switch (category) {
      case 'drilling': return <TrendingUp className="size-4" />;
      case 'mud': return <Droplets className="size-4" />;
      case 'directional': return <Navigation className="size-4" />;
      case 'formation': return <Mountain className="size-4" />;
      case 'tool': return <Wrench className="size-4" />;
      default: return <LineChart className="size-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Charts & Analytics</h1>
        <p className="text-muted-foreground">
          Detailed parameter analysis and historical trends
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Parameter Library Sidebar */}
        <Card className="lg:col-span-1 p-4">
          <h3 className="font-semibold mb-4">Parameter Library</h3>
          
          <div className="space-y-4">
            {Object.entries(parameterLibrary).map(([category, params]) => (
              <div key={category}>
                <Button
                  variant={selectedCategory === category ? 'secondary' : 'ghost'}
                  className="w-full justify-start mb-2"
                  onClick={() => setSelectedCategory(category)}
                >
                  <CategoryIcon category={category} />
                  <span className="ml-2 capitalize">{category}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {params.length}
                  </Badge>
                </Button>

                {selectedCategory === category && (
                  <div className="ml-4 space-y-2">
                    {params.map(param => (
                      <div key={param.key} className="flex items-center gap-2">
                        <Checkbox
                          id={`pin-${param.key}`}
                          checked={pinnedCharts.includes(param.key)}
                          onCheckedChange={() => togglePinChart(param.key)}
                        />
                        <Label htmlFor={`pin-${param.key}`} className="text-sm cursor-pointer flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: param.color }} />
                          {param.label}
                          {pinnedCharts.includes(param.key) && (
                            <Star className="size-3 fill-yellow-500 text-yellow-500" />
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Charts Display */}
        <div className="lg:col-span-3 space-y-6">
          {pinnedCharts.length === 0 ? (
            <Card className="p-12 text-center">
              <Star className="size-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Charts Pinned</h3>
              <p className="text-muted-foreground">
                Select parameters from the library to display charts
              </p>
            </Card>
          ) : (
            pinnedParams.map(param => (
              <Card key={param.key} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{param.label}</h3>
                    <p className="text-sm text-muted-foreground">Unit: {param.unit}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => togglePinChart(param.key)}>
                      <Star className="size-4 mr-2 fill-yellow-500 text-yellow-500" />
                      Unpin
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportChart}>
                      <Download className="size-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
                
                <RealTimeChart
                  data={chartData}
                  title=""
                  availableParameters={[param]}
                  defaultParameters={[param.key]}
                />
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
