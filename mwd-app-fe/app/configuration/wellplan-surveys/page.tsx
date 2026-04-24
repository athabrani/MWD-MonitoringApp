"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AppLayout,
  AppPage,
  getAppPagePath,
} from "@/components/layouts/app-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockPolarisWellplanSurveys } from "@/data/polaris-config";
import { PolarisWellplanSurvey } from "@/types/polaris";

const emptySurvey: PolarisWellplanSurvey = {
  id: "",
  md: 0,
  inc: 0,
  azm: 0,
  tvd: 0,
  vs: 0,
  ns: 0,
  ew: 0,
  cd: 0,
  ca: 90,
  dl: 0,
};

const surveyColumns: Array<keyof Omit<PolarisWellplanSurvey, "id">> = [
  "md",
  "inc",
  "azm",
  "tvd",
  "vs",
  "ns",
  "ew",
  "cd",
  "ca",
  "dl",
];

export default function WellplanSurveysPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const [draftSurvey, setDraftSurvey] = useState<PolarisWellplanSurvey>(emptySurvey);
  const [surveys, setSurveys] = useState<PolarisWellplanSurvey[]>(
    mockPolarisWellplanSurveys
  );
  const [surveyPendingDelete, setSurveyPendingDelete] =
    useState<PolarisWellplanSurvey | null>(null);

  const totals = useMemo(
    () => ({
      count: surveys.length,
      maxMd: Math.max(...surveys.map((survey) => survey.md), 0),
    }),
    [surveys]
  );

  const updateDraft = (
    field: keyof Omit<PolarisWellplanSurvey, "id">,
    value: string
  ) => {
    setDraftSurvey((prev) => ({
      ...prev,
      [field]: Number(value),
    }));
  };

  const updateRow = (
    id: string,
    field: keyof Omit<PolarisWellplanSurvey, "id">,
    value: string
  ) => {
    setSurveys((prev) =>
      prev.map((survey) =>
        survey.id === id
          ? {
              ...survey,
              [field]: Number(value),
            }
          : survey
      )
    );
  };

  const addSurvey = () => {
    const hasInvalidValue = surveyColumns.some((column) =>
      Number.isNaN(Number(draftSurvey[column]))
    );

    if (hasInvalidValue) {
      toast.error("Gagal menambahkan survey data.", {
        description: "Pastikan semua field numerik berisi nilai yang valid.",
      });
      return;
    }

    setSurveys((prev) => [
      ...prev,
      {
        ...draftSurvey,
        id: `survey-${Date.now()}`,
      },
    ]);
    setDraftSurvey(emptySurvey);
    toast.success("Survey data berhasil ditambahkan.");
  };

  const deleteSurvey = (id: string) => {
    const exists = surveys.some((survey) => survey.id === id);

    if (!exists) {
      toast.error("Gagal menghapus survey data.", {
        description: "Row survey yang dipilih tidak ditemukan.",
      });
      return;
    }

    setSurveys((prev) => prev.filter((survey) => survey.id !== id));
    toast.success("Survey data berhasil dihapus.");
  };

  const content = (
    <div className="min-w-0 max-w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Configuration</Badge>
            <Badge variant="outline">Well Plan Surveys</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Well Plan Surveys Editor</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Inline editor untuk menambah, mengubah, dan menghapus survey rows sebelum dipakai
            oleh modul plotting dan directional configuration.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (onNavigate) {
                onNavigate("configuration");
                return;
              }
              router.push(getAppPagePath("configuration"));
            }}
          >
            Close Window
          </Button>
          <Button
            onClick={() =>
              toast.success("Perubahan wellplan surveys berhasil disimpan.", {
                description: "Penyimpanan saat ini masih bersifat local draft.",
              })
            }
          >
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Survey Rows</div>
          <div className="mt-2 text-2xl font-semibold">{totals.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Max MD</div>
          <div className="mt-2 text-2xl font-semibold">{totals.maxMd.toFixed(2)}</div>
        </Card>
      </div>

      <Card className="max-w-full p-4">
        <h2 className="text-lg font-semibold">Add Survey</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Local editor scaffold. Rows can be added, adjusted, and removed before backend
          persistence is wired.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {surveyColumns.map((column) => (
            <div key={column} className="min-w-0 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {column}
              </div>
              <Input
                type="number"
                className="h-9"
                value={draftSurvey[column]}
                onChange={(e) => updateDraft(column, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={addSurvey}>
            <Plus className="mr-2 size-4" />
            Add Survey
          </Button>
        </div>
      </Card>

      <Card className="max-w-full overflow-hidden p-0">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {surveyColumns.map((column) => (
                  <TableHead key={column} className="uppercase text-center">
                    {column}
                  </TableHead>
                ))}
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((survey) => (
                <TableRow key={survey.id} className="border-b border-slate-300 dark:border-slate-700">
                  {surveyColumns.map((column) => (
                    <TableCell key={`${survey.id}-${column}`} className="min-w-[92px] px-2 py-3 sm:min-w-[104px]">
                      <Input
                        type="number"
                        className="h-8 min-w-0 text-right text-sm"
                        value={survey[column]}
                        onChange={(e) => updateRow(survey.id, column, e.target.value)}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="min-w-[96px] px-2 py-3 text-right sm:min-w-[120px]">
                    <Button
                      variant="outline"
                      size="sm"
                      className="-full sm:w-auto border-red-400/40 bg-red-500/80 text-white hover:border-red-300/50 hover:bg-red-500 hover:text-white"
                      onClick={() => setSurveyPendingDelete(survey)}
                    >
                      <Trash2 className="mr-0 size-4 sm:mr-2" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AlertDialog
        open={surveyPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSurveyPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete wellplan survey row?</AlertDialogTitle>
            <AlertDialogDescription>
              {surveyPendingDelete
                ? `Are you sure you want to delete the survey at MD ${surveyPendingDelete.md.toFixed(2)}? This action only affects the local editor data.`
                : "Are you sure you want to delete this survey row?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (surveyPendingDelete) {
                  deleteSurvey(surveyPendingDelete.id);
                }
                setSurveyPendingDelete(null);
              }}
            >
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (onNavigate) {
    return content;
  }

  return (
    <AppLayout
      currentPage="configuration-wellplan-surveys"
      onNavigate={(page) => router.push(getAppPagePath(page))}
    >
      {content}
    </AppLayout>
  );
}
