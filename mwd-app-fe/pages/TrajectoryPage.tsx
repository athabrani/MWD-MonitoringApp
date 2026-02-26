import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { VerticalTrajectory } from '../components/VerticalTrajectory';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { mockTrajectoryData } from '../data/mock-data';
import { Download, Camera, Maximize2, Target } from 'lucide-react';
import { toast } from 'sonner';

export const TrajectoryPage: React.FC = () => {
  const [view, setView] = useState<'vertical' | 'plan' | '3d'>('vertical');
  const [depthSlider, setDepthSlider] = useState(100);
  const trajectoryData = mockTrajectoryData;

  const currentDepthIndex = Math.floor((depthSlider / 100) * trajectoryData.actual.length);
  const visiblePlanned = trajectoryData.planned.slice(0, currentDepthIndex + 1);
  const visibleActual = trajectoryData.actual.slice(0, currentDepthIndex + 1);

  const currentActual = trajectoryData.actual[Math.min(currentDepthIndex, trajectoryData.actual.length - 1)];
  const currentPlanned = trajectoryData.planned[Math.min(currentDepthIndex, trajectoryData.planned.length - 1)];
  
  const crossTrackError = Math.sqrt(
    Math.pow(currentActual.northing - currentPlanned.northing, 2) +
    Math.pow(currentActual.easting - currentPlanned.easting, 2)
  );

  const deltaTVD = Math.abs(currentActual.tvd - currentPlanned.tvd);
  const deltaInc = Math.abs(currentActual.inclination - currentPlanned.inclination);
  const deltaAzi = Math.abs(currentActual.azimuth - currentPlanned.azimuth);

  const handleSnapshot = () => {
    toast.success('Snapshot saved for report');
  };

  const handleExport = () => {
    toast.success('Trajectory data exported');
  };

  const planViewData = {
    planned: visiblePlanned.map(p => ({ x: p.easting, y: p.northing, md: p.md })),
    actual: visibleActual.map(a => ({ x: a.easting, y: a.northing, md: a.md }))
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold">Trajectory Analysis</h1>
            <p className="text-muted-foreground">
              Planned vs Actual wellbore trajectory - Vertical rig view
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSnapshot}>
              <Camera className="size-4 mr-2" />
              Snapshot
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="size-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Current MD</div>
          <div className="text-2xl font-mono font-semibold">{currentActual.md.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">m</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Current TVD</div>
          <div className="text-2xl font-mono font-semibold">{currentActual.tvd.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">m</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Inclination</div>
          <div className="text-2xl font-mono font-semibold">{currentActual.inclination.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">°</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Azimuth</div>
          <div className="text-2xl font-mono font-semibold">{currentActual.azimuth.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">°</div>
        </Card>

        <Card className={`p-4 ${crossTrackError > 10 ? 'border-yellow-500/50 bg-yellow-500/5' : ''}`}>
          <div className="text-xs text-muted-foreground mb-1">Cross-track Error</div>
          <div className="text-2xl font-mono font-semibold">{crossTrackError.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">m</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Δ TVD</div>
          <div className="text-2xl font-mono font-semibold">{deltaTVD.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">m</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Δ Inc</div>
          <div className="text-2xl font-mono font-semibold">{deltaInc.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">°</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Δ Azi</div>
          <div className="text-2xl font-mono font-semibold">{deltaAzi.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">°</div>
        </Card>
      </div>

      {/* Depth Slider */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Depth Position</h3>
            <p className="text-sm text-muted-foreground">
              Slide to view trajectory at different depths
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {currentActual.md.toFixed(1)} m MD
          </Badge>
        </div>
        <Slider
          value={[depthSlider]}
          onValueChange={(value) => setDepthSlider(value[0])}
          max={100}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>Surface</span>
          <span>Current: {depthSlider}%</span>
          <span>TD: {trajectoryData.planned[trajectoryData.planned.length - 1].md.toFixed(0)} m</span>
        </div>
      </Card>

      {/* Trajectory Views */}
      <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vertical">Vertical Section</TabsTrigger>
          <TabsTrigger value="plan">Plan View</TabsTrigger>
          <TabsTrigger value="3d">3D View</TabsTrigger>
        </TabsList>

        <TabsContent value="vertical" className="mt-6">
          <div className="grid lg:grid-cols-[350px_1fr] gap-6">
            {/* Vertical Trajectory Display */}
            <VerticalTrajectory
              data={trajectoryData}
              currentDepthPercent={depthSlider}
              height={600}
            />

            {/* Target Waypoints */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Target Waypoints</h3>
              <div className="space-y-4">
                {[
                  { name: 'Kickoff Point (KOP)', md: 1000, tvd: 999.5, status: 'completed' },
                  { name: 'Build Section', md: 2500, tvd: 2470, status: 'completed' },
                  { name: 'Landing Point', md: 3500, tvd: 3385, status: 'current' },
                  { name: 'Target Depth (TD)', md: 4500, tvd: 4270, status: 'upcoming' }
                ].map(target => (
                  <div 
                    key={target.name}
                    className={`p-4 rounded-lg border ${
                      target.status === 'current' 
                        ? 'border-primary bg-primary/5' 
                        : target.status === 'completed'
                        ? 'border-green-500/50 bg-green-500/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{target.name}</h4>
                      <Badge variant={
                        target.status === 'completed' ? 'secondary' :
                        target.status === 'current' ? 'default' : 'outline'
                      }>
                        {target.status === 'completed' && '✓ '}
                        {target.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">MD:</span>
                        <span className="font-mono ml-2">{target.md} m</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">TVD:</span>
                        <span className="font-mono ml-2">{target.tvd} m</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress Summary */}
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Progress Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Drilled</span>
                    <span className="font-mono">{currentActual.md.toFixed(0)} / 4500 m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-mono">{((currentActual.md / 4500) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-mono">{(4500 - currentActual.md).toFixed(0)} m</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plan" className="mt-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Plan View (Top-down)</h3>
                <p className="text-sm text-muted-foreground">
                  Northing vs Easting - Bird's eye view of wellbore path
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm">Planned</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">Actual</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={500}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Easting"
                  label={{ value: 'Easting (m)', position: 'bottom' }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Northing"
                  label={{ value: 'Northing (m)', angle: -90, position: 'left' }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => [value.toFixed(2) + ' m', name]}
                />
                <Legend />
                <Scatter 
                  name="Planned Path" 
                  data={planViewData.planned} 
                  fill="#3b82f6"
                  line={{ stroke: '#3b82f6', strokeWidth: 2 }}
                  shape="circle"
                />
                <Scatter 
                  name="Actual Path" 
                  data={planViewData.actual} 
                  fill="#10b981"
                  line={{ stroke: '#10b981', strokeWidth: 2 }}
                  shape="circle"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="3d" className="mt-6">
          <Card className="p-6">
            <div className="flex flex-col items-center justify-center h-[500px] text-center">
              <Maximize2 className="size-16 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">3D Visualization</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Interactive 3D trajectory visualization would be rendered here using a WebGL library.
                This would show the wellbore path in three dimensions with rotation and zoom controls.
              </p>
              <Button variant="outline" className="mt-4">
                <Target className="size-4 mr-2" />
                Load 3D Viewer
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
