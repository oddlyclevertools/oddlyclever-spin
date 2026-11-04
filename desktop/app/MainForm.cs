using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace OddlyClever
{
    /// <summary>The app window: starts the music server, shows it in WebView2, stops it on close.</summary>
    sealed class MainForm : Form
    {
        static readonly Color Night = Color.FromArgb(0x0d, 0x0c, 0x0e);
        const string StartingPage = "<html><body style=\"margin:0;height:100vh;display:grid;place-items:center;" +
            "background:#0d0c0e;color:#8d8794;font:15px system-ui,sans-serif\">Starting your music...</body></html>";

        readonly WebView2 web = new WebView2 { Dock = DockStyle.Fill };
        MusicServer server;

        public MainForm()
        {
            Text = Product.Name;
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            BackColor = Night;
            MinimumSize = new Size(380, 520);
            web.DefaultBackgroundColor = Night;
            Controls.Add(web);
            WindowPlacement.Restore(this);
            Load += async (s, e) => await StartAsync();
            FormClosing += (s, e) => WindowPlacement.Save(this);
            FormClosed += (s, e) => server?.Dispose();
        }

        async Task StartAsync()
        {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            if (!File.Exists(Path.Combine(root, "server", "server.py")))
            {
                Fail("I couldn't find the app's files next to this program. Reinstalling OddlyClever Spin should fix it.");
                return;
            }
            try
            {
                // Chromium leaves media keys to the host in WebView2; this hands them to the page's player.
                var options = new CoreWebView2EnvironmentOptions("--enable-features=HardwareMediaKeyHandling");
                var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Product.DataDir, "WebView2"), options);
                await web.EnsureCoreWebView2Async(env);
            }
            catch (WebView2RuntimeNotFoundException)
            {
                var answer = MessageBox.Show(this,
                    "OddlyClever Spin needs the Microsoft Edge WebView2 Runtime, which is part of Windows 11 but missing here.\n\n" +
                    "Open the download page now? It's free and takes a minute.",
                    Product.Name, MessageBoxButtons.YesNo, MessageBoxIcon.Information);
                if (answer == DialogResult.Yes) OpenInBrowser("https://developer.microsoft.com/microsoft-edge/webview2/");
                Close();
                return;
            }

            var core = web.CoreWebView2;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDevToolsEnabled = Environment.GetEnvironmentVariable("OCM_DEVTOOLS") == "1";
            core.NavigateToString(StartingPage);
            try { server = await MusicServer.StartAsync(root); }
            catch (Exception e) { Fail(e.Message); return; }

            core.NewWindowRequested += (s, e) => { if (IsExternal(e.Uri)) { e.Handled = true; OpenInBrowser(e.Uri); } };
            core.NavigationStarting += (s, e) => { if (IsExternal(e.Uri)) { e.Cancel = true; OpenInBrowser(e.Uri); } };
            core.Navigate(server.Url);
        }

        void Fail(string message)
        {
            MessageBox.Show(this, message, Product.Name, MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }

        /// <summary>Web links leave the app and open in the default browser; the server's own pages stay.</summary>
        bool IsExternal(string uri)
        {
            if (!Uri.TryCreate(uri, UriKind.Absolute, out var u) || server == null) return false;
            if (u.Scheme == Uri.UriSchemeMailto) return true;
            return (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps)
                && !(u.Host == "127.0.0.1" && u.Port == server.Port);
        }

        static void OpenInBrowser(string uri)
        {
            try { Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true }); }
            catch (Exception e) when (e is System.ComponentModel.Win32Exception || e is InvalidOperationException)
            {
                MessageBox.Show("I couldn't open your browser for this link:\n" + uri, Product.Name);
            }
        }
    }
}
