using System.Diagnostics;
using System.Text;

namespace ControlPanel.Service;

public sealed class Worker : BackgroundService
{
    private const string SupervisorUrl = "http://127.0.0.1:7331/status";
    private const string LogPath = @"C:\KUTM\Logs\control-panel.log";
    private readonly IHttpClientFactory _httpClientFactory;

    public Worker(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(LogPath)!);
        await WriteLogAsync("Service started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                bool reachable = await IsSupervisorReachableAsync(stoppingToken);
                if (!reachable)
                {
                    await WriteLogAsync("Supervisor unreachable; attempting docker compose up -d supervisor.");
                    await TryStartSupervisorAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                await WriteLogAsync($"Service loop error: {ex.Message}");
            }

            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }
    }

    private async Task<bool> IsSupervisorReachableAsync(CancellationToken cancellationToken)
    {
        using HttpClient client = _httpClientFactory.CreateClient("supervisor");
        try
        {
            using HttpResponseMessage response = await client.GetAsync("/status", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private async Task TryStartSupervisorAsync(CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "powershell",
            Arguments = "-NoProfile -ExecutionPolicy Bypass -Command \"docker compose up -d supervisor\"",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            WorkingDirectory = Environment.GetEnvironmentVariable("KUTM_COMPOSE_DIR") ?? @"C:\kingunderthemountain"
        };

        using Process process = new() { StartInfo = startInfo };
        process.Start();
        string output = await process.StandardOutput.ReadToEndAsync(cancellationToken);
        string error = await process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);

        if (process.ExitCode == 0)
        {
            await WriteLogAsync("docker compose up -d supervisor succeeded.");
        }
        else
        {
            await WriteLogAsync($"docker compose failed with code {process.ExitCode}: {error}");
            if (!string.IsNullOrWhiteSpace(output))
            {
                await WriteLogAsync($"stdout: {output.Trim()}");
            }
        }
    }

    private static async Task WriteLogAsync(string message)
    {
        RotateIfNeeded();
        string line = $"{DateTimeOffset.Now:O} {message}";
        await File.AppendAllTextAsync(LogPath, line + Environment.NewLine, Encoding.UTF8);
    }

    private static void RotateIfNeeded()
    {
        var fileInfo = new FileInfo(LogPath);
        if (!fileInfo.Exists || fileInfo.Length < 5 * 1024 * 1024)
        {
            return;
        }

        string rotated = Path.Combine(fileInfo.DirectoryName!, "control-panel.log.1");
        if (File.Exists(rotated))
        {
            File.Delete(rotated);
        }
        File.Move(LogPath, rotated);
    }
}
