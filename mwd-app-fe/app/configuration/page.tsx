"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpFromLine,
  Binary,
  FileSpreadsheet,
  Mail,
  Plus,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  mockPolarisContacts,
  mockPolarisDecoderConfiguration,
  mockPolarisSurveyConfiguration,
  mockPolarisSystemInfo,
  mockPolarisWellInformation,
  mockPolarisWitsIds,
} from "@/data/polaris-config";
import {
  PolarisAccessLevel,
  PolarisContact,
  PolarisDataSourceMode,
  PolarisDecoderConfiguration,
  PolarisSurveyConfiguration,
  PolarisSystemInfo,
  PolarisToolType,
  PolarisWellInformation,
  PolarisWitsId,
} from "@/types/polaris";
import {
  AppLayout,
  AppPage,
  getAppPagePath,
} from "@/components/layouts/app-layout";
import { PlaceholderNote, WorkspaceSection } from "@/components/layouts/workspace-section";

const accessLevels: PolarisAccessLevel[] = ["MWD", "Guest", "None"];
const toolTypes: PolarisToolType[] = ["Mud Pulse", "EM", "Simulator", "Memory"];
const dataSourceModes: PolarisDataSourceMode[] = [
  "decoder",
  "manual",
  "simulated",
  "derived",
];

const emptyContact: PolarisContact = {
  id: "",
  name: "",
  email: "",
  company: "",
  accessLevel: "Guest",
  active: true,
};

function normalizeWellInfo(
  value?: Partial<PolarisWellInformation> | null
): PolarisWellInformation {
  return {
    ...mockPolarisWellInformation,
    ...value,
  };
}

function normalizeContact(value?: Partial<PolarisContact> | null): PolarisContact {
  return {
    ...emptyContact,
    ...value,
  };
}

function normalizeSurveyConfig(
  value?: Partial<PolarisSurveyConfiguration> | null
): PolarisSurveyConfiguration {
  return {
    ...mockPolarisSurveyConfiguration,
    ...value,
  };
}

function normalizeDecoderConfig(
  value?: Partial<PolarisDecoderConfiguration> | null
): PolarisDecoderConfiguration {
  return {
    ...mockPolarisDecoderConfiguration,
    ...value,
  };
}

function normalizeSystemInfo(
  value?: Partial<PolarisSystemInfo> | null
): PolarisSystemInfo {
  return {
    ...mockPolarisSystemInfo,
    ...value,
  };
}

function normalizeWitsRecord(
  value?: Partial<PolarisWitsId> | null
): PolarisWitsId {
  return {
    ...mockPolarisWitsIds[0],
    ...value,
  };
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SummaryValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 overflow-hidden text-sm font-semibold leading-snug break-words [overflow-wrap:anywhere]">
      {children}
    </div>
  );
}

export default function ConfigurationPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const [wellInfo, setWellInfo] = useState<PolarisWellInformation>(() =>
    normalizeWellInfo(mockPolarisWellInformation)
  );
  const [contacts, setContacts] = useState<PolarisContact[]>(mockPolarisContacts);
  const [selectedContactId, setSelectedContactId] = useState<string>(
    mockPolarisContacts[0]?.id ?? ""
  );
  const [draftContact, setDraftContact] = useState<PolarisContact>(() =>
    normalizeContact(mockPolarisContacts[0] ?? emptyContact)
  );
  const [surveyConfig, setSurveyConfig] = useState<PolarisSurveyConfiguration>(() =>
    normalizeSurveyConfig(mockPolarisSurveyConfiguration)
  );
  const [witsIds, setWitsIds] = useState<PolarisWitsId[]>(mockPolarisWitsIds);
  const [selectedWitsId, setSelectedWitsId] = useState<string>(
    mockPolarisWitsIds[0]?.id ?? ""
  );
  const [decoderConfig, setDecoderConfig] = useState<PolarisDecoderConfiguration>(() =>
    normalizeDecoderConfig(mockPolarisDecoderConfiguration)
  );
  const [systemInfo, setSystemInfo] = useState<PolarisSystemInfo>(() =>
    normalizeSystemInfo(mockPolarisSystemInfo)
  );

  const activeWitsRecord = useMemo(
    () => normalizeWitsRecord(witsIds.find((item) => item.id === selectedWitsId) ?? witsIds[0]),
    [selectedWitsId, witsIds]
  );

  const safeWellInfo = normalizeWellInfo(wellInfo);
  const safeDraftContact = normalizeContact(draftContact);
  const safeSurveyConfig = normalizeSurveyConfig(surveyConfig);
  const safeDecoderConfig = normalizeDecoderConfig(decoderConfig);
  const safeSystemInfo = normalizeSystemInfo(systemInfo);

  const saveContactDraft = () => {
    if (!draftContact.name || !draftContact.email) {
      toast.error("Contact name dan email wajib diisi.");
      return;
    }

    const nextContact = {
      ...draftContact,
      id: draftContact.id || `contact-${Date.now()}`,
    };

    setContacts((prev) => {
      const exists = prev.some((item) => item.id === nextContact.id);
      return exists
        ? prev.map((item) => (item.id === nextContact.id ? nextContact : item))
        : [...prev, nextContact];
    });
    setSelectedContactId(nextContact.id);
    setDraftContact(normalizeContact(nextContact));
    toast.success("Contact configuration updated.");
  };

  const deleteSelectedContact = () => {
    if (!selectedContactId) return;

    setContacts((prev) => prev.filter((item) => item.id !== selectedContactId));
    setSelectedContactId("");
    setDraftContact(normalizeContact(emptyContact));
    toast.success("Contact removed from local configuration.");
  };

  const updateActiveWits = (patch: Partial<PolarisWitsId>) => {
    if (!activeWitsRecord) return;
    setWitsIds((prev) =>
      prev.map((item) =>
        item.id === activeWitsRecord.id ? normalizeWitsRecord({ ...item, ...patch }) : item
      )
    );
  };

  const content = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Software Configuration</Badge>
            <Badge variant="outline">Phase 1</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Configuration Workspace</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Scaffold konfigurasi software bergaya Polaris untuk well setup, contact access,
            surveys, WITS IDs, decoder, dan system info.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => toast.message("Mock save queue created.")}>
            <Save className="mr-2 size-4" />
            Save Draft
          </Button>
          <Button onClick={() => toast.message("Configuration audit report is still a placeholder.")}>
            <Settings2 className="mr-2 size-4" />
            Generate Review
          </Button>
        </div>
      </div>

      <Tabs defaultValue="well" className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
          <TabsTrigger value="well">Well Information</TabsTrigger>
          <TabsTrigger value="contacts">Email / Login</TabsTrigger>
          <TabsTrigger value="surveys">Surveys</TabsTrigger>
          <TabsTrigger value="wits">WITS IDs</TabsTrigger>
          <TabsTrigger value="decoder">Decoder</TabsTrigger>
          <TabsTrigger value="system">System Info</TabsTrigger>
        </TabsList>

        <TabsContent value="well" className="space-y-4">
          <WorkspaceSection
            title="Well and Job Information"
            description="Primary job identity, naming convention, drilling status, and dashboard contact placeholders."
            badge="Live local draft"
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="border-dashed p-4">
                <h4 className="font-medium">Well Identification</h4>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField label="Company Name">
                    <Input
                      value={safeWellInfo.companyName}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, companyName: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Survey Company">
                    <Input
                      value={safeWellInfo.surveyCompany}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, surveyCompany: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Well Name">
                    <Input
                      value={safeWellInfo.wellName}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, wellName: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Job Name">
                    <Input
                      value={safeWellInfo.jobName}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, jobName: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Rig ID">
                    <Input
                      value={safeWellInfo.rigId}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, rigId: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Rig Name">
                    <Input
                      value={safeWellInfo.rigName}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, rigName: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="API or UWI">
                    <Input
                      value={safeWellInfo.apiOrUwi}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, apiOrUwi: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="AFE">
                    <Input
                      value={safeWellInfo.afe}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, afe: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Field">
                    <Input
                      value={safeWellInfo.fieldName}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, fieldName: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Location">
                    <Input
                      value={safeWellInfo.location}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, location: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="State / Province">
                    <Input
                      value={safeWellInfo.stateOrProvince}
                      onChange={(e) =>
                        setWellInfo((prev) => ({
                          ...prev,
                          stateOrProvince: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="County / Parish">
                    <Input
                      value={safeWellInfo.countyOrParish}
                      onChange={(e) =>
                        setWellInfo((prev) => ({
                          ...prev,
                          countyOrParish: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="Country">
                    <Input
                      value={safeWellInfo.country}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, country: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Site Name">
                    <Input
                      value={safeWellInfo.siteName}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, siteName: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Operator">
                    <Input
                      value={safeWellInfo.operator}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, operator: e.target.value }))
                      }
                    />
                  </FormField>
                </div>
              </Card>

              <Card className="border-dashed p-4">
                <h4 className="font-medium">Job Details and File Naming</h4>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField label="Job Number">
                    <Input
                      value={safeWellInfo.jobNumber}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, jobNumber: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Start Date">
                    <Input
                      type="date"
                      value={safeWellInfo.startDate}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, startDate: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="End Date">
                    <Input
                      type="date"
                      value={safeWellInfo.endDate}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, endDate: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Start Depth">
                    <Input
                      type="number"
                      value={safeWellInfo.startDepth}
                      onChange={(e) =>
                        setWellInfo((prev) => ({
                          ...prev,
                          startDepth: Number(e.target.value),
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="End Depth">
                    <Input
                      type="number"
                      value={safeWellInfo.endDepth}
                      onChange={(e) =>
                        setWellInfo((prev) => ({
                          ...prev,
                          endDepth: Number(e.target.value),
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="File Name Prefix">
                    <Input
                      value={safeWellInfo.filePrefix}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, filePrefix: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="File Name Suffix">
                    <Input
                      value={safeWellInfo.fileSuffix}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, fileSuffix: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="File Sequence">
                    <Input
                      value={safeWellInfo.fileSequence}
                      onChange={(e) =>
                        setWellInfo((prev) => ({ ...prev, fileSequence: e.target.value }))
                      }
                    />
                  </FormField>
                </div>

                <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  Preview: {safeWellInfo.filePrefix}_{safeWellInfo.wellName}_{safeWellInfo.fileSequence}_{safeWellInfo.fileSuffix}
                </div>
              </Card>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="border-dashed p-4">
                <h4 className="font-medium">Dashboard Drilling Status</h4>
                <div className="mt-4 space-y-4">
                  <FormField label="Rig Status">
                    <Select
                      value={safeWellInfo.drillingStatus}
                      onValueChange={(value) =>
                        setWellInfo((prev) => ({
                          ...prev,
                          drillingStatus: value as PolarisWellInformation["drillingStatus"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Drilling", "Circulating", "Tripping", "Surveying", "Standby"].map(
                          (status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                    <div className="space-y-1">
                      <div className="font-medium">Backup database to dashboard</div>
                      <div className="text-xs text-muted-foreground">
                        Placeholder for automatic push when TD or reporting milestones are selected.
                      </div>
                    </div>
                    <Switch
                      checked={safeWellInfo.backupDatabaseToDashboard}
                      onCheckedChange={(value) =>
                        setWellInfo((prev) => ({
                          ...prev,
                          backupDatabaseToDashboard: value,
                        }))
                      }
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast.message("Database backup trigger is a Phase 2 placeholder.")
                    }
                  >
                    Trigger database backup
                  </Button>
                </div>
              </Card>

              <Card className="border-dashed p-4">
                <h4 className="font-medium">Dashboard Contact Information</h4>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField label="MWD Contact 1">
                    <Input
                      value={safeWellInfo.dashboardContactName}
                      onChange={(e) =>
                        setWellInfo((prev) => ({
                          ...prev,
                          dashboardContactName: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="MWD Contact 2">
                    <Input
                      value={safeWellInfo.dashboardContactSecondary}
                      onChange={(e) =>
                        setWellInfo((prev) => ({
                          ...prev,
                          dashboardContactSecondary: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="Contact Email">
                    <Input
                      value={safeWellInfo.dashboardContactEmail}
                      onChange={(e) =>
                        setWellInfo((prev) => ({
                          ...prev,
                          dashboardContactEmail: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="Contact Phone">
                    <Input
                      value={safeWellInfo.dashboardContactPhone}
                      onChange={(e) =>
                        setWellInfo((prev) => ({
                          ...prev,
                          dashboardContactPhone: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="Coordinator">
                    <Input
                      value={safeWellInfo.dashboardCoordinator}
                      onChange={(e) =>
                        setWellInfo((prev) => ({
                          ...prev,
                          dashboardCoordinator: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                </div>
              </Card>
            </div>

            <div className="mt-5">
              <FormField label="Operator Notes">
                <Textarea
                  rows={4}
                  value={safeWellInfo.notes}
                  onChange={(e) =>
                    setWellInfo((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </FormField>
            </div>
          </WorkspaceSection>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <WorkspaceSection
            title="Email / Login Contacts"
            description="Maintain software-side recipients and access levels for reports and dashboard visibility."
            badge="CSV import placeholder"
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDraftContact({ ...emptyContact, id: "" });
                  setSelectedContactId("");
                }}
              >
                <Plus className="mr-2 size-4" />
                Add Contact
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.message("CSV import is a placeholder until parser wiring is added.")
                }
              >
                <ArrowUpFromLine className="mr-2 size-4" />
                Import CSV
              </Button>
              <Button variant="outline" onClick={deleteSelectedContact} disabled={!selectedContactId}>
                <Trash2 className="mr-2 size-4" />
                Delete Selected
              </Button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-dashed p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow
                        key={contact.id}
                        className={selectedContactId === contact.id ? "bg-muted/60" : ""}
                        onClick={() => {
                          setSelectedContactId(contact.id);
                          setDraftContact(contact);
                        }}
                      >
                        <TableCell>
                          <div className="font-medium">{contact.name}</div>
                          <div className="text-xs text-muted-foreground">{contact.email}</div>
                        </TableCell>
                        <TableCell>{contact.company}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{contact.accessLevel}</Badge>
                        </TableCell>
                        <TableCell>{contact.active ? "Active" : "Disabled"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              <Card className="border-dashed p-4">
                <h4 className="font-medium">Contact Detail</h4>
                <div className="mt-4 space-y-4">
                  <FormField label="Name">
                    <Input
                      value={safeDraftContact.name}
                      onChange={(e) =>
                        setDraftContact((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Email">
                    <Input
                      value={safeDraftContact.email}
                      onChange={(e) =>
                        setDraftContact((prev) => ({ ...prev, email: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Company">
                    <Input
                      value={safeDraftContact.company}
                      onChange={(e) =>
                        setDraftContact((prev) => ({ ...prev, company: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Access Level">
                    <Select
                      value={safeDraftContact.accessLevel}
                      onValueChange={(value) =>
                        setDraftContact((prev) => ({
                          ...prev,
                          accessLevel: value as PolarisAccessLevel,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accessLevels.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-medium">Active Contact</div>
                      <div className="text-xs text-muted-foreground">
                        Controls whether this user appears in the software contact list.
                      </div>
                    </div>
                    <Switch
                      checked={safeDraftContact.active}
                      onCheckedChange={(checked) =>
                        setDraftContact((prev) => ({ ...prev, active: checked }))
                      }
                    />
                  </div>
                  <Button className="w-full" onClick={saveContactDraft}>
                    Save Contact
                  </Button>
                </div>
              </Card>
            </div>
          </WorkspaceSection>
        </TabsContent>

        <TabsContent value="surveys" className="space-y-4">
          <WorkspaceSection
            title="Surveys Configuration"
            description="Configure survey calculations, report columns, rig-port source, and wellplan survey actions."
            badge="Wellplan import placeholder"
          >
            <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_0.9fr]">
              <div className="space-y-4 xl:col-span-2">
                <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                  <div className="space-y-4">
                    <Card className="border-dashed p-4">
                      <h4 className="font-medium">Units and Directional Setup</h4>
                      <div className="mt-4 space-y-4">
                        <FormField label="Units of Measurement">
                          <Select
                            value={safeSurveyConfig.units}
                            onValueChange={(value) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                units: value as PolarisSurveyConfiguration["units"],
                                surveyDoglegUnit:
                                  value === "imperial" ? "Degrees / 100 ft" : "Degrees / 30 m",
                                plotPaperNote:
                                  value === "imperial"
                                    ? "U.S. paper and plot scales active."
                                    : "Metric paper and plot scales active.",
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="imperial">U.S.</SelectItem>
                              <SelectItem value="metric">Metric</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                        <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                          <div>Dogleg: {safeSurveyConfig.surveyDoglegUnit}</div>
                          <div className="mt-1 text-xs">{safeSurveyConfig.plotPaperNote}</div>
                        </div>

                        <FormField label="Proposed Azimuth">
                          <Input
                            type="number"
                            value={safeSurveyConfig.proposedAzimuth}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                proposedAzimuth: Number(e.target.value),
                              }))
                            }
                          />
                        </FormField>
                        <FormField label="Survey Depth">
                          <Input
                            type="number"
                            value={safeSurveyConfig.surveyDepthOffset}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                surveyDepthOffset: Number(e.target.value),
                              }))
                            }
                          />
                        </FormField>
                        <FormField label="North Reference">
                          <Select
                            value={safeSurveyConfig.northReference}
                            onValueChange={(value) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                northReference: value as PolarisSurveyConfiguration["northReference"],
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">True North</SelectItem>
                              <SelectItem value="magnetic">Magnetic North</SelectItem>
                              <SelectItem value="grid">Grid North</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                        <FormField label="Declination">
                          <Input
                            type="number"
                            value={safeSurveyConfig.magneticDeclination}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                magneticDeclination: Number(e.target.value),
                              }))
                            }
                          />
                        </FormField>
                        <div className="text-xs text-muted-foreground">
                          North reference and declination are used for survey header/report display.
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <Card className="border-dashed p-4">
                      <h4 className="font-medium">National Geophysical Data Center</h4>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <FormField label="Latitude">
                          <Input
                            value={safeSurveyConfig.latitude}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({ ...prev, latitude: e.target.value }))
                            }
                          />
                        </FormField>
                        <FormField label="Longitude">
                          <Input
                            value={safeSurveyConfig.longitude}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({ ...prev, longitude: e.target.value }))
                            }
                          />
                        </FormField>
                        <FormField label="Northing">
                          <Input
                            type="number"
                            value={safeSurveyConfig.northing}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                northing: Number(e.target.value),
                              }))
                            }
                          />
                        </FormField>
                        <FormField label="Easting">
                          <Input
                            type="number"
                            value={safeSurveyConfig.easting}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                easting: Number(e.target.value),
                              }))
                            }
                          />
                        </FormField>
                        <FormField label="KB">
                          <Input
                            type="number"
                            value={safeSurveyConfig.kb}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({ ...prev, kb: Number(e.target.value) }))
                            }
                          />
                        </FormField>
                        <FormField label="DF">
                          <Input
                            type="number"
                            value={safeSurveyConfig.df}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({ ...prev, df: Number(e.target.value) }))
                            }
                          />
                        </FormField>
                        <FormField label="GL">
                          <Input
                            type="number"
                            value={safeSurveyConfig.gl}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({ ...prev, gl: Number(e.target.value) }))
                            }
                          />
                        </FormField>
                        <FormField label="Subsea Depth">
                          <Input
                            type="number"
                            value={safeSurveyConfig.subseaDepth}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                subseaDepth: Number(e.target.value),
                              }))
                            }
                          />
                        </FormField>
                      </div>

                      <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                        <div className="rounded-lg border bg-muted/20 px-3 py-2">
                          Northing/Easting support closure calculations when positional math is enabled.
                        </div>
                        <div className="rounded-lg border bg-muted/20 px-3 py-2">
                          Latitude/longitude, KB, DF, GL, and subsea depth feed headers and TVDSS plot output.
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>

                <Card className="border-dashed p-4">
                  <h4 className="font-medium">Current Survey Notes</h4>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="min-w-0 rounded-lg border p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Proposed Azimuth
                      </div>
                      <SummaryValue>{safeSurveyConfig.proposedAzimuth}</SummaryValue>
                    </div>
                    <div className="min-w-0 rounded-lg border p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Survey Depth Offset
                      </div>
                      <SummaryValue>{safeSurveyConfig.surveyDepthOffset}</SummaryValue>
                    </div>
                    <div className="min-w-0 rounded-lg border p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Rig Port Source
                      </div>
                      <SummaryValue>
                        {safeSurveyConfig.surveyRigPortSource === "database"
                          ? "Survey Database"
                          : "Real-time Decoder"}
                      </SummaryValue>
                    </div>
                    <div className="min-w-0 rounded-lg border p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Wellplan File
                      </div>
                      <SummaryValue>{safeSurveyConfig.importWellplanFile}</SummaryValue>
                    </div>
                  </div>
                </Card>

                <Card className="border-dashed p-4">
                  <h4 className="font-medium">Well Plan Surveys</h4>
                  <div className="mt-4 flex flex-col gap-3">
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() =>
                        toast.message("Wellplan CSV import remains a placeholder in Phase 1.")
                      }
                    >
                      <FileSpreadsheet className="mr-2 size-4" />
                      Import Wellplan surveys from CSV file...
                    </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      if (onNavigate) {
                        onNavigate("configuration-wellplan-surveys");
                        return;
                      }
                      router.push(getAppPagePath("configuration-wellplan-surveys"));
                    }}
                  >
                    Edit Wellplan surveys
                  </Button>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="border-dashed p-4">
                  <h4 className="font-medium">Survey Reports and Plot Output</h4>
                  <div className="mt-4 space-y-4">
                    <FormField label="Columns on Survey Reports">
                      <Input
                        value={safeSurveyConfig.surveyReportColumns}
                        onChange={(e) =>
                          setSurveyConfig((prev) => ({
                            ...prev,
                            surveyReportColumns: e.target.value,
                          }))
                        }
                      />
                    </FormField>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() =>
                        toast.message("Survey reports tab configuration remains a placeholder.")
                      }
                    >
                      Open Survey Reports Tab
                    </Button>

                    <div className="rounded-lg border p-3">
                      <div className="mb-3 font-medium">Survey data sent to rig port</div>
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 text-sm leading-snug">
                          <input
                            type="radio"
                            name="surveyRigPortSource"
                            checked={safeSurveyConfig.surveyRigPortSource === "database"}
                            onChange={() =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                surveyRigPortSource: "database",
                              }))
                            }
                          />
                          <span>From Survey Database</span>
                        </label>
                        <label className="flex items-start gap-3 text-sm leading-snug">
                          <input
                            type="radio"
                            name="surveyRigPortSource"
                            checked={safeSurveyConfig.surveyRigPortSource === "realtime"}
                            onChange={() =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                surveyRigPortSource: "realtime",
                              }))
                            }
                          />
                          <span>Real-time MWD Decoder</span>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="mb-3 font-medium">Survey Data on Plots</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {([
                          ["Inclination", safeSurveyConfig.plotInclination, "plotInclination"],
                          ["Azimuth", safeSurveyConfig.plotAzimuth, "plotAzimuth"],
                          ["TVD", safeSurveyConfig.plotTvd, "plotTvd"],
                          ["Vertical Section", safeSurveyConfig.plotVerticalSection, "plotVerticalSection"],
                          ["North/South", safeSurveyConfig.plotNorthSouth, "plotNorthSouth"],
                          ["East/West", safeSurveyConfig.plotEastWest, "plotEastWest"],
                          ["DogLeg Severity", safeSurveyConfig.outputDoglegSeverity, "outputDoglegSeverity"],
                        ] as const).map(([label, checked, key]) => (
                          <label
                            key={label}
                            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-xs sm:gap-3 sm:px-3 sm:py-2.5 sm:text-sm"
                          >
                            <span className="min-w-0 break-words leading-tight sm:leading-snug [overflow-wrap:anywhere]">
                              {label}
                            </span>
                            <Checkbox
                              className="shrink-0 self-center data-[state=checked]:scale-95 sm:data-[state=checked]:scale-100"
                              checked={Boolean(checked)}
                              onCheckedChange={(value) =>
                                setSurveyConfig((prev) => ({
                                  ...prev,
                                  [key]: value === true,
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="mb-3 font-medium">Additional Survey Output</div>
                      <div className="grid gap-3">
                        {([
                          ["Output Coordinates", safeSurveyConfig.outputCoordinates, "outputCoordinates"],
                          ["Output TVDSS", safeSurveyConfig.outputTvdss, "outputTvdss"],
                        ] as const).map(([label, checked, key]) => (
                          <div
                            key={label}
                            className="flex items-center justify-between rounded-lg border px-3 py-2"
                          >
                            <div className="font-medium">{label}</div>
                            <Switch
                              checked={Boolean(checked)}
                              onCheckedChange={(value) =>
                                setSurveyConfig((prev) => ({
                                  ...prev,
                                  [key]: value,
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </WorkspaceSection>
        </TabsContent>

        <TabsContent value="wits" className="space-y-4">
          <WorkspaceSection
            title="WITS ID Configuration"
            description="Manage logging, scaling, alarms, LAS mapping, and plot configuration per WITS record."
            badge="Editor panel with placeholder scripting"
          >
            <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
              <Card className="border-dashed p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Plot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {witsIds.map((item) => (
                      <TableRow
                        key={item.id}
                        className={selectedWitsId === item.id ? "bg-muted/60" : ""}
                        onClick={() => setSelectedWitsId(item.id)}
                      >
                        <TableCell>
                          <div className="font-medium">{item.numericId}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.enabled ? "Enabled" : "Disabled"}
                          </div>
                        </TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.dataSourceMode}</Badge>
                        </TableCell>
                        <TableCell>{item.realTimePlot}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              {activeWitsRecord ? (
                <Card className="border-dashed p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-medium">{activeWitsRecord.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        WITS ID {activeWitsRecord.numericId} configuration editor
                      </p>
                    </div>
                    <Switch
                      checked={activeWitsRecord.enabled}
                      onCheckedChange={(value) => updateActiveWits({ enabled: value })}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Name">
                      <Input
                        value={activeWitsRecord.name}
                        onChange={(e) => updateActiveWits({ name: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Units">
                      <Input
                        value={activeWitsRecord.units}
                        onChange={(e) => updateActiveWits({ units: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Decimal Places">
                      <Input
                        type="number"
                        value={activeWitsRecord.decimalPlaces}
                        onChange={(e) =>
                          updateActiveWits({ decimalPlaces: Number(e.target.value) })
                        }
                      />
                    </FormField>
                    <FormField label="Scale Factor">
                      <Input
                        type="number"
                        value={activeWitsRecord.scaleFactor}
                        onChange={(e) =>
                          updateActiveWits({ scaleFactor: Number(e.target.value) })
                        }
                      />
                    </FormField>
                    <FormField label="Bias Offset">
                      <Input
                        type="number"
                        value={activeWitsRecord.biasOffset}
                        onChange={(e) =>
                          updateActiveWits({ biasOffset: Number(e.target.value) })
                        }
                      />
                    </FormField>
                    <FormField label="Sensor To Bit Spacing">
                      <Input
                        type="number"
                        value={activeWitsRecord.sensorToBitSpacing}
                        onChange={(e) =>
                          updateActiveWits({ sensorToBitSpacing: Number(e.target.value) })
                        }
                      />
                    </FormField>
                    <FormField label="Real-Time Plot">
                      <Input
                        value={activeWitsRecord.realTimePlot}
                        onChange={(e) => updateActiveWits({ realTimePlot: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Depth Tracking">
                      <Input
                        value={activeWitsRecord.depthTracking}
                        onChange={(e) => updateActiveWits({ depthTracking: e.target.value })}
                      />
                    </FormField>
                    <FormField label="LAS Mnemonic">
                      <Input
                        value={activeWitsRecord.lasMnemonic}
                        onChange={(e) => updateActiveWits({ lasMnemonic: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Data Source Mode">
                      <Select
                        value={activeWitsRecord.dataSourceMode}
                        onValueChange={(value) =>
                          updateActiveWits({
                            dataSourceMode: value as PolarisDataSourceMode,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dataSourceModes.map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {mode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Alarm Low">
                      <Input
                        type="number"
                        value={activeWitsRecord.alarmLow}
                        onChange={(e) => updateActiveWits({ alarmLow: Number(e.target.value) })}
                      />
                    </FormField>
                    <FormField label="Alarm High">
                      <Input
                        type="number"
                        value={activeWitsRecord.alarmHigh}
                        onChange={(e) => updateActiveWits({ alarmHigh: Number(e.target.value) })}
                      />
                    </FormField>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {([
                      ["Send to AUX", activeWitsRecord.sendToAux, "sendToAux"],
                      ["Send to Rig WITS", activeWitsRecord.sendToRigWits, "sendToRigWits"],
                      ["Do Not Repeat", activeWitsRecord.doNotRepeat, "doNotRepeat"],
                    ] as const).map(([label, checked, key]) => (
                      <div key={label} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="font-medium">{label}</div>
                        <Switch
                          checked={Boolean(checked)}
                          onCheckedChange={(value) =>
                            updateActiveWits({ [key]: value } as Partial<PolarisWitsId>)
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <FormField label="Scripting / Data Source UI Placeholder">
                      <Textarea
                        rows={5}
                        value={activeWitsRecord.scriptNotes}
                        onChange={(e) => updateActiveWits({ scriptNotes: e.target.value })}
                      />
                    </FormField>
                  </div>
                </Card>
              ) : null}
            </div>
          </WorkspaceSection>
        </TabsContent>

        <TabsContent value="decoder" className="space-y-4">
          <WorkspaceSection
            title="Decoder Configuration"
            description="Tool type, toolface inclination mode, WITS output timer, and GV tag mapping scaffold."
            badge="Decoder mapping placeholder"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Tool Type">
                <Select
                  value={safeDecoderConfig.toolType}
                  onValueChange={(value) =>
                    setDecoderConfig((prev) => ({
                      ...prev,
                      toolType: value as PolarisToolType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toolTypes.map((toolType) => (
                      <SelectItem key={toolType} value={toolType}>
                        {toolType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Toolface Mode Inclination">
                <Input
                  type="number"
                  value={safeDecoderConfig.toolfaceModeInclination}
                  onChange={(e) =>
                    setDecoderConfig((prev) => ({
                      ...prev,
                      toolfaceModeInclination: Number(e.target.value),
                    }))
                  }
                />
              </FormField>
              <FormField label="WITS Output Timer (sec)">
                <Input
                  type="number"
                  value={safeDecoderConfig.witsOutputTimer}
                  onChange={(e) =>
                    setDecoderConfig((prev) => ({
                      ...prev,
                      witsOutputTimer: Number(e.target.value),
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="mt-5">
              <FormField label="GV Tag Mapping">
                <Textarea
                  rows={7}
                  value={safeDecoderConfig.gvTagMapping}
                  onChange={(e) =>
                    setDecoderConfig((prev) => ({ ...prev, gvTagMapping: e.target.value }))
                  }
                />
              </FormField>
            </div>
          </WorkspaceSection>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <WorkspaceSection
            title="System Info"
            description="SMTP profile, email template, signature, and report logo placeholders."
            badge="No external transport wiring"
          >
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <Card className="border-dashed p-4">
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">SMTP Configuration</h4>
                    <p className="text-sm text-muted-foreground">
                      Software-side email profile only. No external driver or OS setup is included.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <FormField label="SMTP Host">
                    <Input
                      value={safeSystemInfo.smtpHost}
                      onChange={(e) =>
                        setSystemInfo((prev) => ({ ...prev, smtpHost: e.target.value }))
                      }
                    />
                  </FormField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="SMTP Port">
                      <Input
                        type="number"
                        value={safeSystemInfo.smtpPort}
                        onChange={(e) =>
                          setSystemInfo((prev) => ({
                            ...prev,
                            smtpPort: Number(e.target.value),
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Username">
                      <Input
                        value={safeSystemInfo.username}
                        onChange={(e) =>
                          setSystemInfo((prev) => ({ ...prev, username: e.target.value }))
                        }
                      />
                    </FormField>
                  </div>
                  <FormField label="Sender Email">
                    <Input
                      value={safeSystemInfo.senderEmail}
                      onChange={(e) =>
                        setSystemInfo((prev) => ({ ...prev, senderEmail: e.target.value }))
                      }
                    />
                  </FormField>
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast.message("SMTP test is a placeholder until backend transport is available.")
                    }
                  >
                    Test SMTP Profile
                  </Button>
                </div>
              </Card>

              <Card className="border-dashed p-4">
                <div className="flex items-start gap-2">
                  <Binary className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">Templates and Branding</h4>
                    <p className="text-sm text-muted-foreground">
                      Subject/body template, signature field, and upload placeholders for report logos.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  <FormField label="Subject Template">
                    <Input
                      value={safeSystemInfo.subjectTemplate}
                      onChange={(e) =>
                        setSystemInfo((prev) => ({
                          ...prev,
                          subjectTemplate: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="Body Template">
                    <Textarea
                      rows={4}
                      value={safeSystemInfo.bodyTemplate}
                      onChange={(e) =>
                        setSystemInfo((prev) => ({ ...prev, bodyTemplate: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Signature">
                    <Textarea
                      rows={3}
                      value={safeSystemInfo.signature}
                      onChange={(e) =>
                        setSystemInfo((prev) => ({ ...prev, signature: e.target.value }))
                      }
                    />
                  </FormField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Report Logo Light">
                      <Input
                        value={safeSystemInfo.reportLogoLight}
                        onChange={(e) =>
                          setSystemInfo((prev) => ({
                            ...prev,
                            reportLogoLight: e.target.value,
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Report Logo Dark">
                      <Input
                        value={safeSystemInfo.reportLogoDark}
                        onChange={(e) =>
                          setSystemInfo((prev) => ({
                            ...prev,
                            reportLogoDark: e.target.value,
                          }))
                        }
                      />
                    </FormField>
                  </div>
                </div>
              </Card>
            </div>

            <PlaceholderNote>
              Placeholder only: SMTP test, CSV import, GV tag auto-discovery, and logo upload do not call any backend yet.
            </PlaceholderNote>
          </WorkspaceSection>
        </TabsContent>
      </Tabs>

      <Card className="border-dashed p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <div className="font-medium">Phase 1 scope marker</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Configuration Workspace is fully scaffolded with local state and mock data. Monitoring,
              Rig WITS runtime views, LAS, Memory Import, Re-Logging, and Troubleshooting remain for the next phases.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );

  if (onNavigate) {
    return content;
  }

  return (
    <AppLayout
      currentPage="configuration"
      onNavigate={(page) => router.push(getAppPagePath(page))}
    >
      {content}
    </AppLayout>
  );
}
