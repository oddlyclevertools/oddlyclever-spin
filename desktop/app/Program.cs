using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace OddlyClever
{
    static class Program
    {
        /// <summary>One copy at a time: a second launch brings the open window to the front and quits.</summary>
        [STAThread]
        static void Main()
        {
            using (var mutex = new Mutex(true, @"Local\" + Product.Id, out bool first))
            {
                if (!first) { FocusOtherCopy(); return; }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new MainForm());
            }
        }

        static void FocusOtherCopy()
        {
            using (var me = Process.GetCurrentProcess())
                foreach (var p in Process.GetProcessesByName(me.ProcessName))
                    using (p)
                    {
                        if (p.Id == me.Id || p.MainWindowHandle == IntPtr.Zero) continue;
                        if (IsIconic(p.MainWindowHandle)) ShowWindow(p.MainWindowHandle, 9 /* SW_RESTORE */);
                        SetForegroundWindow(p.MainWindowHandle);
                        return;
                    }
        }

        [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);
    }
}
