import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Bell, Eye, Gauge } from 'lucide-react';
import { toast } from 'sonner';
import { mockKPIData } from '@/data/mock-data';

export const SettingsScreen: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const [thresholds, setThresholds] = useState<any>({
    rop: { warning: 10, critical: 5 },
    wob: { warning: 25, critical: 30 },
    flowrate: { warning: 850, critical: 800 }
  });

  const handleSaveThresholds = () => {
    toast.success('Thresholds updated successfully');
  };

  const handleSaveDisplay = () => {
    toast.success('Display settings updated');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure thresholds, display preferences, and system behavior
        </p>
      </div>

      <Tabs defaultValue="thresholds">
        <TabsList>
          <TabsTrigger value="thresholds">
            <Gauge className="size-4 mr-2" />
            Thresholds
          </TabsTrigger>
          <TabsTrigger value="display">
            <Eye className="size-4 mr-2" />
            Display
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="size-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="thresholds" className="mt-6 space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Parameter Thresholds</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Set warning and critical thresholds for alarm generation
            </p>

            <div className="space-y-6">
              {Object.entries(mockKPIData).map(([key, param]) => (
                <div key={key}>
                  <Label className="text-base">{param.name}</Label>
                  <div className="grid md:grid-cols-2 gap-4 mt-2">
                    <div className="space-y-2">
                      <Label htmlFor={`${key}-warning`} className="text-sm text-muted-foreground">
                        Warning Threshold ({param.unit})
                      </Label>
                      <Input
                        id={`${key}-warning`}
                        type="number"
                        defaultValue={param.warningThreshold || ''}
                        placeholder="Enter warning value"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${key}-critical`} className="text-sm text-muted-foreground">
                        Critical Threshold ({param.unit})
                      </Label>
                      <Input
                        id={`${key}-critical`}
                        type="number"
                        defaultValue={param.criticalThreshold || ''}
                        placeholder="Enter critical value"
                      />
                    </div>
                  </div>
                  {key !== 'temperature' && <Separator className="mt-6" />}
                </div>
              ))}
            </div>

            <Button onClick={handleSaveThresholds} className="mt-6">
              Save Thresholds
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Units</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Unit System</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose between metric and imperial units
                  </p>
                </div>
                <Select 
                  value={settings.units} 
                  onValueChange={(value) => updateSettings({ units: value as any })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric">Metric</SelectItem>
                    <SelectItem value="imperial">Imperial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="display" className="mt-6 space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Display Preferences</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Density</Label>
                  <p className="text-sm text-muted-foreground">
                    Control spacing and information density
                  </p>
                </div>
                <Select 
                  value={settings.display.density} 
                  onValueChange={(value) => updateSettings({ 
                    display: { ...settings.display, density: value as any }
                  })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-refresh</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically update data at intervals
                  </p>
                </div>
                <Switch 
                  checked={settings.display.autoRefresh}
                  onCheckedChange={(checked) => updateSettings({ 
                    display: { ...settings.display, autoRefresh: checked }
                  })}
                />
              </div>

              {settings.display.autoRefresh && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Refresh Interval</Label>
                      <p className="text-sm text-muted-foreground">
                        How often to update the data (seconds)
                      </p>
                    </div>
                    <Select 
                      value={settings.display.refreshInterval.toString()} 
                      onValueChange={(value) => updateSettings({ 
                        display: { ...settings.display, refreshInterval: parseInt(value) }
                      })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 sec</SelectItem>
                        <SelectItem value="5">5 sec</SelectItem>
                        <SelectItem value="10">10 sec</SelectItem>
                        <SelectItem value="30">30 sec</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <Button onClick={handleSaveDisplay} className="mt-6">
              Save Display Settings
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Notification Settings</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive browser notifications for critical alarms
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Sound Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Play sound when critical alarm occurs
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email for critical events
                  </p>
                </div>
                <Switch />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
