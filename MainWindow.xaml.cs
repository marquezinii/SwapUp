using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using Media = System.Windows.Media;
using Forms = System.Windows.Forms;

namespace SwapUp.Schedule;

public partial class MainWindow : Window
{
    private readonly bool _startup;
    private readonly Forms.NotifyIcon _tray;
    private readonly Forms.ToolStripMenuItem _openItem;
    private readonly Forms.ToolStripMenuItem _newItem;
    private readonly Forms.ToolStripMenuItem _exitItem;
    private static readonly HttpClient BugReportClient = new() { Timeout = TimeSpan.FromSeconds(25) };
    private bool _allowExit;
    private bool _closeToTray = true;
    private bool _closeTipShown;
    private string _brandName = "SwapUp! Agenda ©";
    private string _trayTipTitle = "SwapUp! Agenda © continua ativo";
    private string _trayTipBody = "Seus lembretes ficam funcionando na bandeja. Clique duas vezes no ícone para abrir.";

    public MainWindow(bool startup)
    {
        _startup = startup;
        InitializeComponent();

        var icon = System.Drawing.Icon.ExtractAssociatedIcon(Environment.ProcessPath!) ?? SystemIcons.Application;
        _tray = new Forms.NotifyIcon
        {
            Icon = icon,
            Text = "SwapUp! Agenda © — Seu calendário",
            Visible = true
        };
        _tray.DoubleClick += (_, _) => ShowCalendar();
        var menu = new Forms.ContextMenuStrip();
        _openItem = new Forms.ToolStripMenuItem("Abrir SwapUp! Agenda ©", null, (_, _) => ShowCalendar());
        _newItem = new Forms.ToolStripMenuItem("Novo evento", null, async (_, _) => { ShowCalendar(); await Browser.ExecuteScriptAsync("window.SwapUpSchedule && window.SwapUpSchedule.openNewEvent()"); });
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
            if (!_closeToTray)
            {
                _allowExit = true;
                _tray.Visible = false;
                _tray.Dispose();
                Dispatcher.BeginInvoke(() => System.Windows.Application.Current.Shutdown());
                return;
            }
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
        var appDataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SwapUpSchedule");
        var legacyRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SwapUp");
        if (!Directory.Exists(appDataRoot) && Directory.Exists(legacyRoot))
        {
            try { Directory.Move(legacyRoot, appDataRoot); } catch { /* Keep using a clean profile if migration is unavailable. */ }
        }
        var profile = Path.Combine(appDataRoot, "WebView2");
        Directory.CreateDirectory(profile);
        var env = await CoreWebView2Environment.CreateAsync(null, profile);
        await Browser.EnsureCoreWebView2Async(env);
        Browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
        Browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        Browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
        Browser.CoreWebView2.SetVirtualHostNameToFolderMapping("app.swapup.schedule", Path.Combine(AppContext.BaseDirectory, "web"), CoreWebView2HostResourceAccessKind.Allow);
        Browser.CoreWebView2.WebMessageReceived += OnWebMessage;
        Browser.Source = new Uri("https://app.swapup.schedule/index.html");
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
                    _tray.ShowBalloonTip(5000, root.GetProperty("title").GetString() ?? _brandName, root.GetProperty("body").GetString() ?? "Você tem um compromisso.", Forms.ToolTipIcon.Info);
                    break;
                case "openExternal":
                    var url = root.GetProperty("url").GetString();
                    if (url is not null && Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == "https" || uri.Scheme == "http"))
                        Process.Start(new ProcessStartInfo(uri.ToString()) { UseShellExecute = true });
                    break;
                case "export":
                    ExportData(root.GetProperty("data").GetRawText(), GetString(root, "title", "Salvar backup do SwapUp! Agenda ©"), GetString(root, "backup", "Backup SwapUp! Agenda ©"), GetString(root, "json", "Arquivo JSON"));
                    break;
                case "import":
                    ImportData(GetString(root, "title", "Restaurar backup do SwapUp! Agenda ©"), GetString(root, "backup", "Backup SwapUp! Agenda ©"));
                    break;
                case "hide":
                    Hide();
                    break;
                case "setAutostart":
                    SetAutostart(root.GetProperty("enabled").GetBoolean());
                    break;
                case "setCloseBehavior":
                    _closeToTray = root.TryGetProperty("closeToTray", out var closeToTray) && closeToTray.GetBoolean();
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
        _brandName = Read("brand", "SwapUp! Agenda ©");
        _openItem.Text = Read("open", "Abrir SwapUp! Agenda ©");
        _newItem.Text = Read("newEvent", "Novo evento");
        _exitItem.Text = Read("exit", "Sair");
        _trayTipTitle = Read("trayTitle", "SwapUp! Agenda © continua ativo");
        _trayTipBody = Read("trayBody", "Seus lembretes ficam funcionando na bandeja. Clique duas vezes no ícone para abrir.");
        var windowTitle = Read("windowTitle", "Seu calendário");
        TitleBarText.Text = _brandName;
        Title = $"{_brandName} — {windowTitle}";
        var trayText = $"{_brandName} — {windowTitle}";
        _tray.Text = trayText[..Math.Min(63, trayText.Length)];
        using var preferences = Registry.CurrentUser.CreateSubKey(@"Software\SwapUpSchedule");
        preferences?.SetValue("BrandName", _brandName);
        preferences?.SetValue("DuplicateMessage", Read("duplicate", "O SwapUp! Agenda © já está aberto na bandeja do sistema."));
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
        var endpoint = root.TryGetProperty("endpoint", out var endpointElement) ? endpointElement.GetString() ?? "" : "";
        var missingMessage = GetString(root, "missing", "O canal de suporte ainda não foi configurado pelo desenvolvedor.");
        var sentMessage = GetString(root, "sent", "Relatório enviado com segurança. Obrigado por ajudar a melhorar o aplicativo.");
        var failedMessage = GetString(root, "failed", "Não foi possível enviar agora. Uma cópia foi salva com segurança neste computador.");
        var body = BuildBugReportText(report);
        var title = report.TryGetProperty("title", out var titleElement) ? titleElement.GetString() ?? "Bug report" : "Bug report";

        if (!string.IsNullOrWhiteSpace(endpoint) && Uri.TryCreate(endpoint, UriKind.Absolute, out var endpointUri) && endpointUri.Scheme == "https")
        {
            try
            {
                if (await SubmitBugReport(endpointUri, report, title, body))
                {
                    await NotifyBugResult("sent", sentMessage);
                    return;
                }
            }
            catch { /* Preserve the report locally below. */ }
        }

        var pendingFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SwapUpSchedule", "PendingBugReports");
        Directory.CreateDirectory(pendingFolder);
        var pendingPath = Path.Combine(pendingFolder, $"SwapUp-Schedule-bug-{DateTime.Now:yyyyMMdd-HHmmss}.json");
        await File.WriteAllTextAsync(pendingPath, report.GetRawText(), Encoding.UTF8);
        await NotifyBugResult(string.IsNullOrWhiteSpace(endpoint) ? "missing" : "failed", string.IsNullOrWhiteSpace(endpoint) ? missingMessage : failedMessage);
    }

    private static async Task<bool> SubmitBugReport(Uri endpoint, JsonElement report, string title, string body)
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent($"[SwapUp! Schedule ©] {title}", Encoding.UTF8), "_subject");
        content.Add(new StringContent("table", Encoding.UTF8), "_template");
        content.Add(new StringContent("false", Encoding.UTF8), "_captcha");
        content.Add(new StringContent(body, Encoding.UTF8), "report");

        if (report.TryGetProperty("attachment", out var attachment) && attachment.ValueKind == JsonValueKind.Object)
        {
            var dataUrl = attachment.TryGetProperty("data", out var dataElement) ? dataElement.GetString() ?? "" : "";
            var fileName = Path.GetFileName(attachment.TryGetProperty("name", out var nameElement) ? nameElement.GetString() ?? "screenshot.png" : "screenshot.png").Replace("\"", "");
            var comma = dataUrl.IndexOf(',');
            if (comma > 0)
            {
                var bytes = Convert.FromBase64String(dataUrl[(comma + 1)..]);
                if (bytes.Length <= 5 * 1024 * 1024)
                {
                    var mime = dataUrl.StartsWith("data:image/jpeg", StringComparison.OrdinalIgnoreCase) ? "image/jpeg" : dataUrl.StartsWith("data:image/webp", StringComparison.OrdinalIgnoreCase) ? "image/webp" : "image/png";
                    var fileContent = new ByteArrayContent(bytes);
                    fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mime);
                    content.Add(fileContent, "attachment", fileName);
                }
            }
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint) { Content = content };
        request.Headers.Referrer = new Uri("https://app.swapup.schedule/");
        request.Headers.TryAddWithoutValidation("Origin", "https://app.swapup.schedule");
        using var response = await BugReportClient.SendAsync(request);
        return response.IsSuccessStatusCode;
    }

    private static string BuildBugReportText(JsonElement report)
    {
        string Read(string key) => report.TryGetProperty(key, out var value) ? value.GetString() ?? "-" : "-";
        var environment = report.GetProperty("environment");
        string Env(string key) => environment.TryGetProperty(key, out var value) ? value.GetString() ?? value.ToString() : "-";
        return $"SwapUp! Schedule © bug report\r\n\r\nReport ID: {Read("id")}\r\nVersion: {Read("version")}\r\nType: {Read("type")}\r\nSeverity: {Read("severity")}\r\nLanguage: {Env("language")}\r\nCalendar: {Env("calendarSystem")}\r\nView: {Env("view")}\r\nTime zone: {Env("timeZone")}\r\nContact: {Read("contact")}\r\n\r\nTitle:\r\n{Read("title")}\r\n\r\nDescription:\r\n{Read("description")}\r\n\r\nSteps to reproduce:\r\n{Read("steps")}\r\n\r\nEnvironment:\r\n{Env("platform")}\r\nWindows: {Environment.OSVersion.VersionString}";
    }

    private async Task NotifyBugResult(string status, string message)
    {
        await Browser.ExecuteScriptAsync($"window.SwapUpSchedule?.onBugReportResult({JsonSerializer.Serialize(status)},{JsonSerializer.Serialize(message)})");
    }

    private void ExportData(string json, string title, string backupLabel, string jsonLabel)
    {
        var dialog = new Microsoft.Win32.SaveFileDialog
        {
            Title = title,
            Filter = $"{backupLabel} (*.swapup-schedule.json)|*.swapup-schedule.json|{jsonLabel} (*.json)|*.json",
            FileName = $"SwapUp-Schedule-backup-{DateTime.Now:yyyy-MM-dd}.swapup-schedule.json"
        };
        if (dialog.ShowDialog(this) == true)
            File.WriteAllText(dialog.FileName, json);
    }

    private async void ImportData(string title, string backupLabel)
    {
        var dialog = new Microsoft.Win32.OpenFileDialog
        {
            Title = title,
            Filter = $"{backupLabel} (*.swapup-schedule.json;*.swapup.json;*.json)|*.swapup-schedule.json;*.swapup.json;*.json"
        };
        if (dialog.ShowDialog(this) != true) return;
        var json = await File.ReadAllTextAsync(dialog.FileName);
        using var _ = JsonDocument.Parse(json);
        await Browser.ExecuteScriptAsync($"window.SwapUpSchedule.importData({JsonSerializer.Serialize(json)})");
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
        var startupLink = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "SwapUp! Agenda ©.lnk");
        if (File.Exists(startupLink)) File.Delete(startupLink);
        var legacyStartupLink = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "SwapUp!.lnk");
        if (File.Exists(legacyStartupLink)) File.Delete(legacyStartupLink);
        var unmarkedStartupLink = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "SwapUp! Agenda.lnk");
        if (File.Exists(unmarkedStartupLink)) File.Delete(unmarkedStartupLink);
        using var run = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");
        using var preferences = Registry.CurrentUser.CreateSubKey(@"Software\SwapUpSchedule");
        preferences?.SetValue("Autostart", enabled ? 1 : 0, RegistryValueKind.DWord);
        if (enabled)
            run?.SetValue("SwapUpSchedule", $"\"{Environment.ProcessPath}\" --startup", RegistryValueKind.String);
        else
            run?.DeleteValue("SwapUpSchedule", false);
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
