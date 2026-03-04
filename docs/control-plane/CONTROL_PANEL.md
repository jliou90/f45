# KUTM Control Panel (Windows)

The Control Panel is the Windows-only privileged control surface for v1 operations:

- Start / Stop / Restart stack
- Backup now
- Verify backup
- Restore latest backup (dev/technician only)
- Collect diagnostics
- Open `C:\KUTM\Backups` and `C:\KUTM\Support`

## Components

- `control_panel/ControlPanel.Service`: Windows service that keeps supervisor reachable.
- `control_panel/ControlPanel.Tray`: tray app that calls supervisor on `http://127.0.0.1:7331`.

## Dev Run

```powershell
dotnet build .\control_panel\ControlPanel.Service\ControlPanel.Service.csproj
dotnet build .\control_panel\ControlPanel.Tray\ControlPanel.Tray.csproj
dotnet run --project .\control_panel\ControlPanel.Tray\ControlPanel.Tray.csproj
```

## Publish Service Binary

```powershell
dotnet publish .\control_panel\ControlPanel.Service\ControlPanel.Service.csproj -c Release -o .\control_panel\publish\service
```

## Install Service (Local)

```powershell
sc.exe create "KUTMControlPanelService" binPath= "\"C:\kingunderthemountain\control_panel\publish\service\ControlPanel.Service.exe\"" start= auto
sc.exe start "KUTMControlPanelService"
```

## Uninstall Service (Local)

```powershell
sc.exe stop "KUTMControlPanelService"
sc.exe delete "KUTMControlPanelService"
```

## Logs

- Service log file: `C:\KUTM\Logs\control-panel.log`
- Log file rotates to `control-panel.log.1` when larger than ~5MB.
