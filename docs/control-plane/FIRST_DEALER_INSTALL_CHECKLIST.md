# First Dealer Install Checklist (No Installer Yet)

1. Install Docker Desktop on Windows 11 and confirm `docker info` succeeds.
2. Ensure host directories exist:
   - `C:\KUTM\Backups`
   - `C:\KUTM\Support`
   - `C:\KUTM\Logs`
3. From repository root, start the appliance core:
   - `docker compose up -d postgres api web supervisor`
4. Validate supervisor:
   - `Invoke-RestMethod http://127.0.0.1:7331/status`
5. Run smoke proof:
   - `.\scripts\appliance-smoke-test.ps1`
6. Build and run tray app for operator controls:
   - `dotnet run --project .\control_panel\ControlPanel.Tray\ControlPanel.Tray.csproj`
7. Optional: install Control Panel service for auto-start monitoring:
   - follow `docs/control-plane/CONTROL_PANEL.md`
