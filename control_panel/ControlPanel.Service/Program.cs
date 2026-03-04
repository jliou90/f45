using ControlPanel.Service;

HostApplicationBuilder builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "KUTM Control Panel Service";
});
builder.Services.AddHostedService<Worker>();
builder.Services.AddHttpClient("supervisor", client =>
{
    client.BaseAddress = new Uri("http://127.0.0.1:7331");
    client.Timeout = TimeSpan.FromSeconds(4);
});

IHost host = builder.Build();
host.Run();
