using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using Media = System.Windows.Media;
using Forms = System.Windows.Forms;

namespace SwapUp;

public partial class MainWindow : Window
{
    private readonly bool _startup;
    private readonly Forms.NotifyIcon _tray;
    private readonly Forms.ToolStripMenuItem _openItem;
    private readonly Forms.ToolStripMenuItem _newItem;
    private readonly Forms.ToolStripMenuItem _exitItem;
    private bool _allowExit;
    private bool _closeTipShown;
    private string _trayTipTitle = "SwapUp! continua ativo";
    private string _trayTipBody = "Seus lembretes ficam funcionando na bandeja. Clique duas vezes no ícone para abrir.";

    public MainWindow(bool startup)
    {
        _startup = startup;
        InitializeComponent();

        var icon = System.Drawing.Icon.ExtractAssociatedIcon(Environment.ProcessPath!) ?? SystemIcons.Application;
        _tray = new Forms.NotifyIcon
        {
            Icon = icon,
            Text = "SwapUp! — Seu calendário",
            Visible = true
        };
        _tray.DoubleClick += (_, _) => ShowCalendar();
        var menu = new Forms.ContextMenuStrip();
        _openItem = new Forms.ToolStripMenuItem("Abrir SwapUp!", null, (_, _) => ShowCalendar());
        _newItem = new Forms.ToolStripMenuItem("Novo evento", null, async (_, _) => { ShowCalendar(); await Browser.ExecuteScriptAsync("window.SwapUp && window.SwapUp.openNewEvent()"); });
        _exitItem = new Forms.ToolStripMenuItem("Sair", null, (_, _) => ExitApp());
        menu.Items.Add(_openItem);
        menu.Items.Add(_newItem);
        menu.Items.Add(new Forms.ToolStripSeparator());
        menu.Items.Add(_exitItem);
        _tray.ContextMenuStrip = menu;

        Loaded += async (_, _) => await InitializeBrowser();
        StateChanged += (_, _) => MaximizeButton.Content = WindowState == WindowState.Maximized ? "❐" : "□";
        Closing += (_, e) =>
        {
            if (_allowExit) return;
            e.Cancel = true;
            Hide();
            if (!_closeTipShown)
            {
                _closeTipShown = true;
                _tray.ShowBalloonTip(2500, _trayTipTitle, _trayTipBody, Forms.ToolTipIcon.Info);
            }
        };
    }

    private async Task InitializeBrowser()
    {
        var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SwapUp", "WebView2");
        Directory.CreateDirectory(profile);
        var env = await CoreWebView2Environment.CreateAsync(null, profile);
        await Browser.EnsureCoreWebView2Async(env);
        Browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
        Browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        Browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
        Browser.CoreWebView2.SetVirtualHostNameToFolderMapping("app.swapup", Path.Combine(AppContext.BaseDirectory, "web"), CoreWebView2HostResourceAccessKind.Allow);
        Browser.CoreWebView2.WebMessageReceived += OnWebMessage;
        Browser.Source = new Uri("https://app.swapup/index.html");
        if (_startup) Hide();
    }

    private async void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson);
            var root = doc.RootElement;
            var type = root.GetProperty("type").GetString();
            switch (type)
            {
                case "notify":
                    _tray.ShowBalloonTip(5000, root.GetProperty("title").GetString() ?? "SwapUp!", root.GetProperty("body").GetString() ?? "Você tem um compromisso.", Forms.ToolTipIcon.Info);
                    break;
                case "openExternal":
                    var url = root.GetProperty("url").GetString();
                    if (url is not null && Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == "https" || uri.Scheme == "http"))
                        Process.Start(new ProcessStartInfo(uri.ToString()) { UseShellExecute = true });
                    break;
                case "export":
                    ExportData(root.GetProperty("data").GetRawText(), GetString(root, "title", "Salvar backup do SwapUp!"), GetString(root, "backup", "Backup SwapUp!"), GetString(root, "json", "Arquivo JSON"));
                    break;
                case "import":
                    ImportData(GetString(root, "title", "Restaurar backup do SwapUp!"), GetString(root, "backup", "Backup SwapUp!"));
                    break;
                case "hide":
                    Hide();
                    break;
                case "setAutostart":
                    SetAutostart(root.GetProperty("enabled").GetBoolean());
                    break;
                case "setLanguage":
                    SetNativeLanguage(root.GetProperty("strings"));
                    break;
                case "setWindowTheme":
                    SetWindowTheme(root.TryGetProperty("dark", out var darkElement) && darkElement.GetBoolean(), root.TryGetProperty("accent", out var accentElement) ? accentElement.GetString() : null);
                    break;
                case "bugReport":
                    await HandleBugReport(root);
                    break;
            }
        }
        catch { /* Ignore malformed local messages. */ }
        await Task.CompletedTask;
    }

    private static string GetString(JsonElement root, string key, string fallback)
    {
        return root.TryGetProperty("strings", out var strings) && strings.TryGetProperty(key, out var value) ? value.GetString() ?? fallback : fallback;
    }

    private void SetNativeLanguage(JsonElement strings)
    {
        string Read(string key, string fallback) => strings.TryGetProperty(key, out var value) ? value.GetString() ?? fallback : fallback;
        _openItem.Text = Read("open", "Abrir SwapUp!");
        _newItem.Text = Read("newEvent", "Novo evento");
        _exitItem.Text = Read("exit", "Sair");
        _trayTipTitle = Read("trayTitle", "SwapUp! continua ativo");
        _trayTipBody = Read("trayBody", "Seus lembretes ficam funcionando na bandeja. Clique duas vezes no ícone para abrir.");
        var windowTitle = Read("windowTitle", "Seu calendário");
        Title = $"SwapUp! — {windowTitle}";
        _tray.Text = $"SwapUp! — {windowTitle}"[..Math.Min(63, $"SwapUp! — {windowTitle}".Length)];
        using var preferences = Registry.CurrentUser.CreateSubKey(@"Software\SwapUp");
        preferences?.SetValue("DuplicateMessage", Read("duplicate", "O SwapUp! já está aberto na bandeja do sistema."));
    }

    private void SetWindowTheme(bool dark, string? accent)
    {
        Dispatcher.Invoke(() =>
        {
            var background = dark ? "#15151E" : "#F5F5FA";
            var border = dark ? "#2D2D39" : "#DDDDE7";
            var foreground = dark ? "#F2F1F8" : "#252536";
            var muted = dark ? "#858393" : "#747486";
            var hover = dark ? "#292935" : "#E9E9F0";
            TitleBar.Background = Brush(background);
            WindowBorder.Background = Brush(background);
            WindowBorder.BorderBrush = Brush(border);
            TitleBarText.Foreground = Brush(foreground);
            MinimizeButton.Foreground = MaximizeButton.Foreground = CloseButton.Foreground = Brush(muted);
            Resources["TitleBarButtonHover"] = Brush(hover);
            if (!string.IsNullOrWhiteSpace(accent))
            {
                foreach (var child in ((System.Windows.Controls.StackPanel)TitleBar.Children[0]).Children)
                    if (child is System.Windows.Controls.Border marker) marker.Background = Brush(accent);
            }
        });
    }

    private static Media.SolidColorBrush Brush(string color) => new((Media.Color)Media.ColorConverter.ConvertFromString(color));

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton != MouseButton.Left) return;
        if (e.ClickCount == 2) ToggleMaximize();
        else DragMove();
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void MaximizeButton_Click(object sender, RoutedEventArgs e) => ToggleMaximize();
    private void CloseButton_Click(object sender, RoutedEventArgs e) => Close();
    private void ToggleMaximize() => WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;

    private async Task HandleBugReport(JsonElement root)
    {
        var report = root.GetProperty("report");
        var recipient = root.TryGetProperty("recipient", out var recipientElement) ? recipientElement.GetString() ?? "" : "";
        var issueUrl = root.TryGetProperty("issueUrl", out var issueElement) ? issueElement.GetString() ?? "" : "";
        var missingMessage = GetString(root, "missing", "O canal de suporte ainda não foi configurado pelo desenvolvedor.");
        var openedMessage = GetString(root, "opened", "Seu aplicativo de e-mail foi aberto. Revise e envie a mensagem.");
        var body = BuildBugReportText(report);
        var title = report.TryGetProperty("title", out var titleElement) ? titleElement.GetString() ?? "Bug report" : "Bug report";

        if (!string.IsNullOrWhiteSpace(issueUrl) && Uri.TryCreate(issueUrl, UriKind.Absolute, out var issueUri) && issueUri.Scheme == "https")
        {
            var separator = issueUrl.Contains('?') ? "&" : "?";
            var url = $"{issueUrl}{separator}title={Uri.EscapeDataString($"[SwapUp!] {title}")}&body={Uri.EscapeDataString(body)}";
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            await NotifyBugResult("opened", openedMessage);
            return;
        }

        if (string.IsNullOrWhiteSpace(recipient) || !recipient.Contains('@'))
        {
            var pendingFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SwapUp", "PendingBugReports");
            Directory.CreateDirectory(pendingFolder);
            var pendingPath = Path.Combine(pendingFolder, $"SwapUp-bug-{DateTime.Now:yyyyMMdd-HHmmss}.json");
            await File.WriteAllTextAsync(pendingPath, report.GetRawText(), Encoding.UTF8);
            await NotifyBugResult("missing", missingMessage);
            return;
        }

        try
        {
            var emlPath = CreateBugReportEmail(report, recipient, title, body);
            Process.Start(new ProcessStartInfo(emlPath) { UseShellExecute = true });
            await NotifyBugResult("opened", openedMessage);
        }
        catch
        {
            var mailto = $"mailto:{recipient}?subject={Uri.EscapeDataString($"[SwapUp!] {title}")}&body={Uri.EscapeDataString(body)}";
            Process.Start(new ProcessStartInfo(mailto) { UseShellExecute = true });
            await NotifyBugResult("opened", openedMessage);
        }
    }

    private static string BuildBugReportText(JsonElement report)
    {
        string Read(string key) => report.TryGetProperty(key, out var value) ? value.GetString() ?? "-" : "-";
        var environment = report.GetProperty("environment");
        string Env(string key) => environment.TryGetProperty(key, out var value) ? value.GetString() ?? value.ToString() : "-";
        return $"SwapUp! bug report\r\n\r\nReport ID: {Read("id")}\r\nVersion: {Read("version")}\r\nType: {Read("type")}\r\nSeverity: {Read("severity")}\r\nLanguage: {Env("language")}\r\nCalendar: {Env("calendarSystem")}\r\nView: {Env("view")}\r\nTime zone: {Env("timeZone")}\r\nContact: {Read("contact")}\r\n\r\nTitle:\r\n{Read("title")}\r\n\r\nDescription:\r\n{Read("description")}\r\n\r\nSteps to reproduce:\r\n{Read("steps")}\r\n\r\nEnvironment:\r\n{Env("platform")}\r\nWindows: {Environment.OSVersion.VersionString}";
    }

    private static string CreateBugReportEmail(JsonElement report, string recipient, string title, string body)
    {
        var boundary = $"SwapUpBoundary{Guid.NewGuid():N}";
        var subject = Convert.ToBase64String(Encoding.UTF8.GetBytes($"[SwapUp!] {title}"));
        var builder = new StringBuilder();
        builder.AppendLine($"To: {recipient}");
        builder.AppendLine($"Subject: =?UTF-8?B?{subject}?=");
        builder.AppendLine("MIME-Version: 1.0");
        builder.AppendLine($"Content-Type: multipart/mixed; boundary=\"{boundary}\"");
        builder.AppendLine();
        builder.AppendLine($"--{boundary}");
        builder.AppendLine("Content-Type: text/plain; charset=UTF-8");
        builder.AppendLine("Content-Transfer-Encoding: base64");
        builder.AppendLine();
        builder.AppendLine(Convert.ToBase64String(Encoding.UTF8.GetBytes(body), Base64FormattingOptions.InsertLineBreaks));

        if (report.TryGetProperty("attachment", out var attachment) && attachment.ValueKind == JsonValueKind.Object)
        {
            var dataUrl = attachment.GetProperty("data").GetString() ?? "";
            var fileName = Path.GetFileName(attachment.GetProperty("name").GetString() ?? "screenshot.png").Replace("\"", "");
            var comma = dataUrl.IndexOf(',');
            if (comma > 0)
            {
                var mime = dataUrl.StartsWith("data:image/jpeg", StringComparison.OrdinalIgnoreCase) ? "image/jpeg" : dataUrl.StartsWith("data:image/webp", StringComparison.OrdinalIgnoreCase) ? "image/webp" : "image/png";
                builder.AppendLine($"--{boundary}");
                builder.AppendLine($"Content-Type: {mime}; name=\"{fileName}\"");
                builder.AppendLine("Content-Transfer-Encoding: base64");
                builder.AppendLine($"Content-Disposition: attachment; filename=\"{fileName}\"");
                builder.AppendLine();
                builder.AppendLine(dataUrl[(comma + 1)..]);
            }
        }
        builder.AppendLine($"--{boundary}--");
        var path = Path.Combine(Path.GetTempPath(), $"SwapUp-bug-{DateTime.Now:yyyyMMdd-HHmmss}.eml");
        File.WriteAllText(path, builder.ToString(), new UTF8Encoding(false));
        return path;
    }

    private async Task NotifyBugResult(string status, string message)
    {
        await Browser.ExecuteScriptAsync($"window.SwapUp?.onBugReportResult({JsonSerializer.Serialize(status)},{JsonSerializer.Serialize(message)})");
    }

    private void ExportData(string json, string title, string backupLabel, string jsonLabel)
    {
        var dialog = new Microsoft.Win32.SaveFileDialog
        {
            Title = title,
            Filter = $"{backupLabel} (*.swapup.json)|*.swapup.json|{jsonLabel} (*.json)|*.json",
            FileName = $"SwapUp-backup-{DateTime.Now:yyyy-MM-dd}.swapup.json"
        };
        if (dialog.ShowDialog(this) == true)
            File.WriteAllText(dialog.FileName, json);
    }

    private async void ImportData(string title, string backupLabel)
    {
        var dialog = new Microsoft.Win32.OpenFileDialog
        {
            Title = title,
            Filter = $"{backupLabel} (*.swapup.json;*.json)|*.swapup.json;*.json"
        };
        if (dialog.ShowDialog(this) != true) return;
        var json = await File.ReadAllTextAsync(dialog.FileName);
        using var _ = JsonDocument.Parse(json);
        await Browser.ExecuteScriptAsync($"window.SwapUp.importData({JsonSerializer.Serialize(json)})");
    }

    private void ShowCalendar()
    {
        Dispatcher.Invoke(() =>
        {
            Show();
            if (WindowState == WindowState.Minimized) WindowState = WindowState.Normal;
            Activate();
            Topmost = true;
            Topmost = false;
            Focus();
        });
    }

    private static void SetAutostart(bool enabled)
    {
        var startupLink = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "SwapUp!.lnk");
        if (File.Exists(startupLink)) File.Delete(startupLink);
        using var run = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");
        using var preferences = Registry.CurrentUser.CreateSubKey(@"Software\SwapUp");
        preferences?.SetValue("Autostart", enabled ? 1 : 0, RegistryValueKind.DWord);
        if (enabled)
            run?.SetValue("SwapUp", $"\"{Environment.ProcessPath}\" --startup", RegistryValueKind.String);
        else
            run?.DeleteValue("SwapUp", false);
    }

    private void ExitApp()
    {
        _allowExit = true;
        _tray.Visible = false;
        _tray.Dispose();
        Close();
        System.Windows.Application.Current.Shutdown();
    }
}
