import React from 'react';
import { Card } from '../components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Badge } from '../components/ui/badge';
import { HelpCircle, Book, Video, MessageCircle } from 'lucide-react';

export const HelpPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl page-surface page-help">
      <div>
        <h1 className="text-3xl font-bold mb-2">Help & Support</h1>
        <p className="text-muted-foreground">
          Guides, troubleshooting, and frequently asked questions
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-6 text-center">
          <Book className="size-8 mx-auto mb-3 text-primary" />
          <h3 className="font-semibold mb-2">User Guide</h3>
          <p className="text-sm text-muted-foreground">Complete documentation</p>
        </Card>
        <Card className="p-6 text-center">
          <Video className="size-8 mx-auto mb-3 text-primary" />
          <h3 className="font-semibold mb-2">Video Tutorials</h3>
          <p className="text-sm text-muted-foreground">Step-by-step walkthroughs</p>
        </Card>
        <Card className="p-6 text-center">
          <MessageCircle className="size-8 mx-auto mb-3 text-primary" />
          <h3 className="font-semibold mb-2">Contact Support</h3>
          <p className="text-sm text-muted-foreground">Get help from our team</p>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Frequently Asked Questions</h3>
        
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>What does "Degraded" connection mean?</AccordionTrigger>
            <AccordionContent>
              A degraded connection indicates that data is still being received, but with higher latency 
              or packet loss than normal. This could be due to network issues. The system will continue 
              to operate, but you may experience delays in data updates.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2">
            <AccordionTrigger>How do I acknowledge an alarm?</AccordionTrigger>
            <AccordionContent>
              Navigate to the Alerts page, find the active alarm, and click the "Acknowledge" button. 
              You can add optional notes about what action was taken. Acknowledging an alarm marks it 
              as reviewed but does not resolve it.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3">
            <AccordionTrigger>Can I customize threshold values?</AccordionTrigger>
            <AccordionContent>
              Yes! Engineers and Admins can customize warning and critical thresholds in the Settings page. 
              Navigate to Settings → Thresholds, then adjust the values for each parameter. Changes take 
              effect immediately.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4">
            <AccordionTrigger>How do I export data?</AccordionTrigger>
            <AccordionContent>
              Go to the Export page, select your date range, choose a format (CSV, JSON, or PDF), and 
              click "Export Data". The file will be downloaded to your device. PDF exports include charts 
              and summary information.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5">
            <AccordionTrigger>What's the difference between Primary and Backup data sources?</AccordionTrigger>
            <AccordionContent>
              The Primary source is the main data feed from the rig. The Backup source is a redundant 
              connection that automatically activates if the primary fails. The system will display which 
              source is currently active in the connection status indicator.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      <Card className="p-6 bg-muted">
        <h4 className="font-medium mb-3">Troubleshooting Connection Issues</h4>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Check your network connection and ensure you have internet access</li>
          <li>Verify that the data gateway is online (contact IT support)</li>
          <li>Try the "Reconnect" button in the connection status panel</li>
          <li>Clear your browser cache and reload the application</li>
          <li>If the issue persists, contact system administrator</li>
        </ol>
      </Card>
    </div>
  );
};
