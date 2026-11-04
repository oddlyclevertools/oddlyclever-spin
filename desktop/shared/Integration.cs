using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace OddlyClever
{
    /// <summary>Everything the installer adds to Windows outside the program folder, and how the
    /// uninstaller takes it away again. All of it is per user (HKCU), so no admin rights are needed.</summary>
    internal static class Integration
    {
        static string ExePath => Path.Combine(Product.InstallDir, Product.ExeName);
        static string UninstallerPath => Path.Combine(Product.InstallDir, Product.UninstallerName);

        public static void AddShortcuts(bool desktop)
        {
            CreateShortcut(Product.StartMenuShortcut);
            if (desktop) CreateShortcut(Product.DesktopShortcut);
        }

        public static void RemoveShortcuts()
        {
            foreach (var lnk in new[] { Product.StartMenuShortcut, Product.DesktopShortcut })
                if (File.Exists(lnk)) File.Delete(lnk);
        }

        /// <summary>The "Apps &amp; features" entry.</summary>
        public static void Register(string version, long sizeBytes)
        {
            using (var k = Registry.CurrentUser.CreateSubKey(Product.UninstallKey))
            {
                k.SetValue("DisplayName", Product.Name);
                k.SetValue("DisplayVersion", version);
                k.SetValue("Publisher", Product.Publisher);
                k.SetValue("DisplayIcon", ExePath + ",0");
                k.SetValue("InstallLocation", Product.InstallDir);
                k.SetValue("UninstallString", "\"" + UninstallerPath + "\"");
                k.SetValue("QuietUninstallString", "\"" + UninstallerPath + "\" /S");
                k.SetValue("EstimatedSize", (int)(sizeBytes / 1024), RegistryValueKind.DWord);
                k.SetValue("NoModify", 1, RegistryValueKind.DWord);
                k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                k.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"));
            }
        }

        public static void Unregister() => Registry.CurrentUser.DeleteSubKeyTree(Product.UninstallKey, false);

        static void CreateShortcut(string path)
        {
            var link = (IShellLinkW)new ShellLink();
            link.SetPath(ExePath);
            link.SetWorkingDirectory(Product.InstallDir);
            link.SetIconLocation(ExePath, 0);
            link.SetDescription("Your own music player and downloader");
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            ((IPersistFile)link).Save(path, true);
            Marshal.ReleaseComObject(link);
        }

        [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
        class ShellLink { }

        [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
        interface IShellLinkW
        {
            void GetPath(IntPtr pszFile, int cch, IntPtr pfd, int fFlags);
            void GetIDList(out IntPtr ppidl);
            void SetIDList(IntPtr pidl);
            void GetDescription(IntPtr pszName, int cch);
            void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
            void GetWorkingDirectory(IntPtr pszDir, int cch);
            void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
            void GetArguments(IntPtr pszArgs, int cch);
            void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
            void GetHotkey(out short pwHotkey);
            void SetHotkey(short wHotkey);
            void GetShowCmd(out int piShowCmd);
            void SetShowCmd(int iShowCmd);
            void GetIconLocation(IntPtr pszIconPath, int cch, out int piIcon);
            void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
            void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
            void Resolve(IntPtr hwnd, int fFlags);
            void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
        }

        [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("0000010b-0000-0000-C000-000000000046")]
        interface IPersistFile
        {
            void GetClassID(out Guid pClassID);
            [PreserveSig] int IsDirty();
            void Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, int dwMode);
            void Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [MarshalAs(UnmanagedType.Bool)] bool fRemember);
            void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
            void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string ppszFileName);
        }

        /// <summary>True if a copy of the app from the install folder is running (files would be locked).</summary>
        public static bool AppIsRunning()
        {
            foreach (var p in System.Diagnostics.Process.GetProcessesByName(Path.GetFileNameWithoutExtension(Product.ExeName)))
            {
                try { if (string.Equals(p.MainModule?.FileName, ExePath, StringComparison.OrdinalIgnoreCase)) return true; }
                catch (System.ComponentModel.Win32Exception) { return true; }
                finally { p.Dispose(); }
            }
            return false;
        }
    }
}
