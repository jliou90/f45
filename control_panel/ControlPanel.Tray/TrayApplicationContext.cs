using System.Diagnostics;
using System.Net.Http.Json;

namespace ControlPanel.Tray;

internal sealed class TrayApplicationContext : ApplicationContext
{
    private readonly NotifyIcon _notifyIcon;
    private readonly HttpClient _httpClient;
    private readonly ToolStripMenuItem _statusMenuItem;

    public TrayApplicationContext()
    {
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri("http://127.0.0.1:7331"),
            Timeout = TimeSpan.FromSeconds(10)
        };

        _statusMenuItem = new ToolStripMenuItem("Status: Checking...") { Enabled = false };

        ContextMenuStrip menu = new();
        menu.Items.Add(_statusMenuItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Start Stack", null, async (_, _) => await CallAndNotifyAsync("/stack/start")));
        menu.Items.Add(new ToolStripMenuItem("Stop Stack", null, async (_, _) => await CallAndNotifyAsync("/stack/stop")));
        menu.Items.Add(new ToolStripMenuItem("Restart Stack", null, async (_, _) => await CallAndNotifyAsync("/stack/restart")));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Backup Now", null, async (_, _) => await CallAndNotifyAsync("/backup")));
        menu.Items.Add(new ToolStripMenuItem("Verify Latest Backup", null, async (_, _) => await CallAndNotifyAsync("/backup/verify")));
        menu.Items.Add(new ToolStripMenuItem("Restore Latest Backup (Dev Only)", null, async (_, _) => await RestoreLatestBackupAsync()));
        menu.Items.Add(new ToolStripMenuItem("Collect Diagnostics", null, async (_, _) => await CallAndNotifyAsync("/diagnostics")));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Open Backups Folder", null, (_, _) => OpenFolder(@"C:\KUTM\Backups")));
        menu.Items.Add(new ToolStripMenuItem("Open Support Folder", null, (_, _) => OpenFolder(@"C:\KUTM\Support")));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Exit", null, (_, _) => ExitThread()));

        _notifyIcon = new NotifyIcon
        {
            Text = "KUTM Control Panel",
            Icon = SystemIcons.Application,
            ContextMenuStrip = menu,
            Visible = true
        };

        _ = RefreshStatusAsync();
    }

    protected override void ExitThreadCore()
    {
        _notifyIcon.Visible = false;
        _notifyIcon.Dispose();
        _httpClient.Dispose();
        base.ExitThreadCore();
    }

    private async Task RefreshStatusAsync()
    {
        try
        {
            var payload = await _httpClient.GetFromJsonAsync<SupervisorEnvelope>("/status");
            string message = payload?.ok == true ? "Online" : "Unavailable";
            _statusMenuItem.Text = $"Status: {message}";
        }
        catch
        {
            _statusMenuItem.Text = "Status: Unreachable";
        }
    }

    private async Task CallAndNotifyAsync(string endpoint)
    {
        try
        {
            using HttpResponseMessage response = await _httpClient.PostAsJsonAsync(endpoint, new { });
            var payload = await response.Content.ReadFromJsonAsync<SupervisorEnvelope>();
            string title = response.IsSuccessStatusCode ? "KUTM Control Panel" : "KUTM Action Failed";
            string message = payload?.message ?? $"Request returned HTTP {response.StatusCode}";
            _notifyIcon.ShowBalloonTip(4000, title, message, ToolTipIcon.Info);
        }
        catch (Exception ex)
        {
            _notifyIcon.ShowBalloonTip(4000, "KUTM Action Failed", ex.Message, ToolTipIcon.Error);
        }
        finally
        {
            await RefreshStatusAsync();
        }
    }

    private async Task RestoreLatestBackupAsync()
    {
        try
        {
            using HttpResponseMessage response = await _httpClient.PostAsJsonAsync("/restore", new
            {
                path = "",
                confirm_phrase = "RESTORE_KUTM",
            });
            var payload = await response.Content.ReadFromJsonAsync<SupervisorEnvelope>();
            string title = response.IsSuccessStatusCode ? "KUTM Restore" : "KUTM Restore Failed";
            string message = payload?.message ?? $"Request returned HTTP {response.StatusCode}";
            _notifyIcon.ShowBalloonTip(5000, title, message, ToolTipIcon.Info);
        }
        catch (Exception ex)
        {
            _notifyIcon.ShowBalloonTip(5000, "KUTM Restore Failed", ex.Message, ToolTipIcon.Error);
        }
        finally
        {
            await RefreshStatusAsync();
        }
    }

    private static void OpenFolder(string path)
    {
        Directory.CreateDirectory(path);
        Process.Start(new ProcessStartInfo("explorer.exe", path) { UseShellExecute = true });
    }

    private sealed class SupervisorEnvelope
    {
        public bool ok { get; set; }
        public string? code { get; set; }
        public string? message { get; set; }
    }
}
