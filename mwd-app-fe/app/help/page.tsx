import React from "react";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  HelpCircle,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";

const quickStartSteps = [
  {
    title: "Login dan pastikan role benar",
    detail:
      "Operator bisa memonitor dan melihat data. Engineer/Admin dapat mengubah konfigurasi, export, clear/restore data, dan action teknis lain sesuai akses page.",
  },
  {
    title: "Pilih atau buat MWD session aktif",
    detail:
      "Session aktif adalah konteks utama untuk dashboard, survey, history, plotting, WITS output, LAS/export, dan well plot. Jika session kosong, mulai dari Configuration > Well and Job Information.",
  },
  {
    title: "Cek status koneksi",
    detail:
      "Gunakan Dashboard, Settings > System Health, atau Admin Panel untuk melihat backend API, realtime, serial gateway, ESP WebSocket, DTS/depth tracking, dan raw packet freshness.",
  },
  {
    title: "Refresh data saat kondisi berubah",
    detail:
      "Gunakan tombol refresh pada page terkait setelah session berubah, backend baru online, data baru dikirim, atau token baru dibuat setelah login ulang.",
  },
];

const statusGuides = [
  {
    label: "Connected",
    action: "Data source merespons. Jika chart tetap kosong, cek session aktif, WITS config, filter waktu/depth, dan apakah backend memang punya record.",
  },
  {
    label: "Degraded",
    action: "Data masih mungkin masuk, tetapi latency, packet freshness, atau sebagian endpoint bermasalah. Cek System Health dan raw packet status.",
  },
  {
    label: "Disconnected",
    action: "Cek backend/API, serial gateway, ESP WS, realtime client, jaringan, dan session. Gunakan Reconnect/Refresh; login ulang jika muncul auth error.",
  },
  {
    label: "Unsupported",
    action: "Endpoint probe ada yang belum tersedia di backend. Fitur page mungkin masih bisa berjalan, tetapi status spesifik tidak bisa dikonfirmasi.",
  },
  {
    label: "Auth Error",
    action: "Backend reachable, tetapi token/permission gagal. Login ulang, lalu cek role user dan akses page di Admin Panel.",
  },
];

const troubleshootingItems = [
  {
    value: "no-data",
    question: "Tidak ada data masuk atau dashboard kosong",
    answer: [
      "Pastikan user sudah login dan token masih valid.",
      "Cek apakah ada active MWD session di header atau Configuration.",
      "Buka Dashboard atau Settings > System Health untuk cek backend, realtime, serial gateway, ESP WS, dan raw packets.",
      "Jika backend connected tetapi record kosong, cek apakah data dikirim ke session yang sama dengan session aktif.",
      "Cek WITS Config dan data mapping. Chart/KPI hanya bisa menampilkan parameter yang punya data dan mapping yang sesuai.",
      "Tekan Refresh pada Dashboard, Log Data, Charts, Rig WITS, atau page terkait setelah backend/session diperbaiki.",
    ],
  },
  {
    value: "session-failed",
    question: "Session gagal dimuat, dropdown session kosong, atau No active session",
    answer: [
      "Buka Configuration > Well and Job Information dan refresh daftar MWD Session.",
      "Jika daftar tetap kosong, cek /api/mwd-sessions melalui Settings > System Health atau Admin backend probe.",
      "Jika muncul unauthorized, forbidden, atau role error, login ulang lalu pastikan role user punya akses membaca session.",
      "Jika backend reachable tetapi tidak ada session, buat New Session dari Configuration atau minta engineer/admin membuat session backend.",
      "Setelah session tersedia, pilih session aktif lalu refresh page yang membutuhkan data session.",
    ],
  },
  {
    value: "auth",
    question: "Invalid token, expired session, unauthorized, atau forbidden",
    answer: [
      "Jika muncul pesan Session expired, token invalid, auth-error, 401, atau unauthorized, lakukan logout/login ulang.",
      "Jika 403/forbidden tetap muncul setelah login ulang, role user belum punya izin untuk endpoint atau page tersebut.",
      "Operator dapat melihat sebagian besar monitoring, tetapi beberapa action edit/export/admin dibatasi untuk engineer/admin.",
      "Admin dapat cek Users, Roles, dan Role Page Access di Admin Panel jika page/action tidak muncul.",
    ],
  },
  {
    value: "connection",
    question: "Realtime, Serial, ESP WS, atau DTS disconnected/unknown",
    answer: [
      "Gunakan Dashboard status chips dan Settings > System Health untuk melihat komponen mana yang gagal.",
      "Serial disconnected: cek port rig WITS, adapter serial, baud rate, dan kabel/null-modem.",
      "ESP WS disconnected: cek proses ESP gateway, network path, websocket endpoint, RSSI/SNR jika tersedia.",
      "Realtime disconnected: cek websocket backend/realtime client dan apakah session aktif sudah disubscribe.",
      "DTS unknown/unavailable: cek depth tracking endpoint dan session depth state. Tekan Refresh DTS setelah backend pulih.",
    ],
  },
  {
    value: "charts-history-export",
    question: "Charts, Historical Data, atau Export kosong",
    answer: [
      "Pastikan active session sudah dipilih dan memiliki MWD/WITS records.",
      "Kosongkan atau longgarkan filter date/time dan depth. Historical Data default dapat menampilkan record lama jika date filter tidak dipersempit.",
      "Di Charts, pastikan parameter dipilih dan data historis tersedia untuk parameter tersebut.",
      "Jika export menghasilkan file kosong, cek filter range dan session. Backend bisa mengembalikan empty file jika tidak ada record yang cocok.",
      "Jika endpoint export tertentu unsupported, gunakan export lain yang tersedia atau eskalasi ke backend.",
    ],
  },
  {
    value: "survey-trajectory-plot",
    question: "Survey, Trajectory, Well Plot, atau Plotting tidak tampil",
    answer: [
      "Pastikan active session ada, lalu refresh Survey Data atau Trajectory.",
      "Trajectory membutuhkan actual surveys dan/atau plan surveys. Jika kosong, import/generate survey dari Survey Data atau Well Plan Surveys.",
      "Well Plot membutuhkan active plot config, chart data, dan survey/trajectory context. Cek Plotting untuk template/header/track/curve config.",
      "Jika Plotting config belum tersambung, simpan atau refresh template/config untuk session aktif.",
      "Jika well plot terlihat kosong, cek WITS config, selected curves, depth range, dan apakah data masuk ke session yang sama.",
    ],
  },
  {
    value: "memory-import",
    question: "Memory Import atau CSV upload tidak berjalan",
    answer: [
      "Pastikan file CSV tidak kosong dan kolom time/depth/value dapat dikenali parser.",
      "Pilih session aktif jika file harus disimpan ke session tertentu.",
      "Jika upload berhasil tetapi data tidak muncul, refresh MWD Data/Log Data dan cek apakah data tersimpan dengan session id yang benar.",
      "Jika file detail/points gagal dimuat, cek token, backend memory-files endpoint, dan pesan error di panel upload.",
    ],
  },
  {
    value: "rig-wits",
    question: "Rig WITS output tidak muncul atau Generate Latest Output gagal",
    answer: [
      "Pastikan active session ada sebelum Generate Latest Output.",
      "Cek WITS Config, WITS data values, dan MWD latest record di Log Data.",
      "Jika queue/status output kosong, refresh WITS Output dan cek apakah backend menerima data untuk session aktif.",
      "Jika backend menolak generate, cek token/role dan endpoint WITS output.",
    ],
  },
];

const pageHelp = [
  {
    area: "Dashboard",
    use: "Ringkasan realtime: active session, KPI, connection state, DTS, serial, ESP WS, alarms, dan chart utama.",
    check: "Jika kosong, cek active session, System Health, WITS config, dan refresh data.",
  },
  {
    area: "Configuration",
    use: "Mengelola Well and Job Information, MWD Session, WITS config, decoder/system info, dan well plan surveys.",
    check: "Jika session tidak ada, refresh MWD Session atau buat New Session. Engineer/Admin diperlukan untuk perubahan tertentu.",
  },
  {
    area: "Rig WITS",
    use: "Melihat WITS raw/details, queue output, dan generate latest WITS output dari data terbaru.",
    check: "Jika output kosong, cek active session, WITS values, latest MWD data, dan endpoint WITS output.",
  },
  {
    area: "Log Data",
    use: "Melihat WITS Config, MWD Data, WITS Data Values, edit tools, dan records yang sudah tersimpan.",
    check: "Jika record kosong, cek active session, refresh API, filter depth/channel, dan backend data source.",
  },
  {
    area: "Survey Data",
    use: "Mengelola actual surveys, import/export CSV, projection, recalculation, reverse sort, dan plot surveys.",
    check: "Jika tidak bisa simpan/import, cek active session, role, CSV format, dan endpoint survey.",
  },
  {
    area: "Memory Import",
    use: "Upload memory CSV, preview parsed records, simpan file/points, dan refresh MWD Data setelah import.",
    check: "Jika parsing kosong, cek kolom CSV, delimiter, depth/time/value fields, dan session target.",
  },
  {
    area: "Plotting & Well Plot",
    use: "Mengatur plot header, tracks, curves, templates, PDF layout, dan melihat well plot session.",
    check: "Jika plot kosong, cek template aktif, selected curves, WITS config, chart data, survey, dan depth range.",
  },
  {
    area: "Trajectory",
    use: "Menganalisis actual vs planned stations, reference MD, cross-track error, dan link ke Well Plots.",
    check: "Jika trajectory kosong, import/generate survey actual dan plan surveys untuk session aktif.",
  },
  {
    area: "Charts & Analytics",
    use: "Melihat historical parameter trends, overview analytics, pinned charts, dan category trends.",
    check: "Jika chart kosong, pilih parameter, refresh chart data, dan cek historical records untuk session aktif.",
  },
  {
    area: "History & Export",
    use: "Filter historical records, export CSV/JSON/PDF/LAS, dan download data berdasarkan session/range.",
    check: "Jika export kosong, longgarkan filter, cek active session, dan pastikan backend punya record pada range itu.",
  },
  {
    area: "System Utilities",
    use: "Backup/restore, clear data, database utilities, system status, serial/ESP/realtime diagnostics.",
    check: "Gunakan tab status/diagnostics saat koneksi atau data source bermasalah sebelum clear/restore data.",
  },
  {
    area: "Settings, Alerts, Admin",
    use: "Settings untuk preferences dan System Health, Alerts untuk acknowledge/resolve alarm, Admin untuk users/roles/backend probe.",
    check: "Jika akses berbeda antar user, cek role dan Role Page Access di Admin Panel.",
  },
];

const escalationChecks = [
  "Backend API unreachable, unsupported, atau mengembalikan 5xx berulang setelah refresh.",
  "Token valid tetapi endpoint penting tetap 401/403 untuk role yang seharusnya punya akses.",
  "Serial/ESP/realtime disconnected setelah hardware, gateway process, dan network path dicek.",
  "Backend reachable tetapi /api/mwd-sessions kosong padahal job/session sudah dibuat di sumber data.",
  "Data masuk di backend tetapi tidak memiliki sessionId/mapping yang bisa dibaca aplikasi.",
  "Export/clear/restore gagal di backend meskipun session, token, dan role sudah benar.",
];

export const HelpPage: React.FC = () => {
  return (
    <div className="page-surface page-help max-w-5xl space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">Operational guide</Badge>
          <Badge variant="outline" className="text-xs">MWD Monitoring App</Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Help & Troubleshooting</h1>
        <p className="max-w-3xl text-sm leading-snug text-muted-foreground sm:text-base">
          Practical guidance for monitoring, session selection, connection diagnosis, empty data states,
          token/session issues, and page-specific checks in the current MWD Monitoring App.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-3 sm:p-4">
          <Database className="mb-2 size-5 text-primary" />
          <h3 className="text-sm font-semibold sm:text-base">Data context</h3>
          <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
            Most pages are scoped by active MWD session. If the session is missing or wrong, data can look empty even when backend is online.
          </p>
        </Card>
        <Card className="p-3 sm:p-4">
          <Stethoscope className="mb-2 size-5 text-primary" />
          <h3 className="text-sm font-semibold sm:text-base">Diagnosis path</h3>
          <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
            Start with Dashboard status, then Settings &gt; System Health, then Admin backend probe if role allows it.
          </p>
        </Card>
        <Card className="p-3 sm:p-4">
          <ShieldAlert className="mb-2 size-5 text-primary" />
          <h3 className="text-sm font-semibold sm:text-base">Auth and roles</h3>
          <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
            Invalid token requires login ulang. Forbidden/403 usually means role or page access needs Admin review.
          </p>
        </Card>
      </div>

      <Card className="p-3 sm:p-5">
        <div className="mb-3 flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Quick start</h2>
            <p className="text-sm text-muted-foreground">
              Use this sequence when starting a shift or opening the app after backend changes.
            </p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {quickStartSteps.map((step, index) => (
            <div key={step.title} className="rounded-lg border border-border/70 bg-background/70 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{index + 1}</Badge>
                <h3 className="text-sm font-semibold">{step.title}</h3>
              </div>
              <p className="text-xs leading-snug text-muted-foreground">{step.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-3 sm:p-5">
        <div className="mb-3 flex items-start gap-2">
          <RefreshCw className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Refresh vs login ulang</h2>
            <p className="text-sm text-muted-foreground">
              Use the lightest action that matches the symptom.
            </p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <h3 className="text-sm font-semibold">Refresh page data</h3>
            <p className="text-xs leading-snug text-muted-foreground">
              Use when backend is online, session exists, but a page still shows old or empty records.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <h3 className="text-sm font-semibold">Reconnect status</h3>
            <p className="text-xs leading-snug text-muted-foreground">
              Use when ConnectionStatus shows offline/degraded or realtime/serial/ESP state changed.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <h3 className="text-sm font-semibold">Login ulang</h3>
            <p className="text-xs leading-snug text-muted-foreground">
              Use for expired token, invalid session, auth-error, unauthorized, or repeated 401 responses.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-3 sm:p-5">
        <div className="mb-3 flex items-start gap-2">
          <HelpCircle className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Status and connection meaning</h2>
            <p className="text-sm text-muted-foreground">
              These labels appear in Dashboard, Settings &gt; System Health, Admin Panel, and connection indicators.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {statusGuides.map((item) => (
            <div key={item.label} className="rounded-lg border border-border/70 bg-background/70 p-3">
              <Badge variant="outline" className="mb-2 text-xs">{item.label}</Badge>
              <p className="text-xs leading-snug text-muted-foreground">{item.action}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-3 sm:p-5">
        <div className="mb-2 flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Troubleshooting by symptom</h2>
            <p className="text-sm text-muted-foreground">
              Follow the checklist for the exact error or empty state you see.
            </p>
          </div>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {troubleshootingItems.map((item) => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionTrigger className="text-left text-sm font-semibold">
                {item.question}
              </AccordionTrigger>
              <AccordionContent>
                <ol className="ml-4 list-decimal space-y-1.5 text-sm leading-snug text-muted-foreground">
                  {item.answer.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      <Card className="p-3 sm:p-5">
        <div className="mb-3 flex items-start gap-2">
          <FileText className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Page-specific checks</h2>
            <p className="text-sm text-muted-foreground">
              What each major area is for and what to verify when the page looks empty or blocked.
            </p>
          </div>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {pageHelp.map((item) => (
            <div key={item.area} className="rounded-lg border border-border/70 bg-background/70 p-3">
              <h3 className="text-sm font-semibold">{item.area}</h3>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{item.use}</p>
              <p className="mt-2 text-xs leading-snug">
                <span className="font-medium">If it fails: </span>
                <span className="text-muted-foreground">{item.check}</span>
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-amber-300/60 bg-amber-50 p-3 text-amber-950 sm:p-5">
        <h2 className="font-semibold">When to escalate to backend/admin/dev</h2>
        <p className="mt-1 text-sm leading-snug">
          Escalate after refresh, session check, and login ulang have been tried, especially for backend/API or permission failures.
        </p>
        <ul className="mt-3 grid gap-1.5 text-sm leading-snug md:grid-cols-2">
          {escalationChecks.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

export default HelpPage;
