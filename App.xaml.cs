using System.Threading;
using System.Windows;
using Microsoft.Win32;

namespace SwapUp.Schedule;

public partial class App : System.Windows.Application
{
    private Mutex? _mutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        _mutex = new Mutex(true, "SwapUp.Schedule.SingleInstance", out var isFirst);
        if (!isFirst)
        {
            using var preferences = Registry.CurrentUser.OpenSubKey(@"Software\SwapUpSchedule");
            var duplicateMessage = preferences?.GetValue("DuplicateMessage") as string ?? "O SwapUp! Agenda © já está aberto na bandeja do sistema.";
            var brandName = preferences?.GetValue("BrandName") as string ?? "SwapUp! Agenda ©";
            System.Windows.MessageBox.Show(duplicateMessage, brandName, MessageBoxButton.OK, MessageBoxImage.Information);
            Shutdown();
            return;
        }

        var startup = e.Args.Any(a => a.Equals("--startup", StringComparison.OrdinalIgnoreCase));
        var window = new MainWindow(startup);
        MainWindow = window;
        if (!startup) window.Show();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _mutex?.ReleaseMutex();
        _mutex?.Dispose();
        base.OnExit(e);
    }
}
