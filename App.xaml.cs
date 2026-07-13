using System.Threading;
using System.Windows;
using Microsoft.Win32;

namespace SwapUp;

public partial class App : System.Windows.Application
{
    private Mutex? _mutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        _mutex = new Mutex(true, "SwapUp.Calendar.SingleInstance", out var isFirst);
        if (!isFirst)
        {
            var duplicateMessage = Registry.CurrentUser.OpenSubKey(@"Software\SwapUp")?.GetValue("DuplicateMessage") as string ?? "O SwapUp! já está aberto na bandeja do sistema.";
            System.Windows.MessageBox.Show(duplicateMessage, "SwapUp!", MessageBoxButton.OK, MessageBoxImage.Information);
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
