# Central Server Service Guide

## Services

Planned Windows services:

- `MWDBackend`
- `MWDFrontend`
- `MWDReceiver`

`MWDReceiver` is scaffolded but skipped by installer scripts until the receiver command is manually verified. Current receiver/gateway logic starts inside the backend process.

PostgreSQL is expected to run as its own PostgreSQL service.

## Dry-run install

```powershell
.\scripts\install-central-services.ps1 -DryRun
```

## Confirm install

Requires NSSM installed and available in `PATH`.

Current scaffold status: NSSM is not installed on this machine, so service installation remains dry-run only. Do not run `-ConfirmInstall` until NSSM is installed and the service command plan has been reviewed.

Firewall and service installation remain separate approvals. A ready local runtime does not imply services have been installed.

```powershell
.\scripts\install-central-services.ps1 -ConfirmInstall
```

LAN mode:

```powershell
.\scripts\install-central-services.ps1 -ConfirmInstall -LanMode -ServerHost 192.168.1.10
```

## Start, stop, and check

```powershell
.\scripts\start-central-services.ps1
.\scripts\stop-central-services.ps1
.\scripts\check-central-services.ps1
```

## Logs

Service logs are written to:

```text
service-logs/service-backend.log
service-logs/service-backend-error.log
service-logs/service-frontend.log
service-logs/service-frontend-error.log
```

## Notes

- Services must use production build.
- Services must not run `npm run dev`.
- Service installation is never performed unless `-ConfirmInstall` is provided.
- Uninstall is dry-run by default and requires `-ConfirmUninstall`.
