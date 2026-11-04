using System;
using System.IO;

namespace OddlyClever
{
    /// <summary>Names and folders shared by the app, the installer and the uninstaller.</summary>
    internal static class Product
    {
        public const string Name = "OddlyClever Spin";
        public const string Publisher = "Oddly Clever Tools";
        public const string Id = "OddlyCleverMusic";
        public const string ExeName = "OddlyClever Spin.exe";
        public const string UninstallerName = "Uninstall OddlyClever Spin.exe";
        public const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + Id;

        static readonly string LocalAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        /// <summary>%LOCALAPPDATA%\Programs\OddlyCleverMusic: where the program lives.</summary>
        public static string InstallDir => Path.Combine(LocalAppData, "Programs", Id);

        /// <summary>%LOCALAPPDATA%\OddlyCleverMusic: browser profile, window placement and the server log.
        /// Songs live in %USERPROFILE%\Music\OddlyClever Music, which nothing here ever touches.</summary>
        public static string DataDir => Path.Combine(LocalAppData, Id);

        public static string StartMenuShortcut => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.Programs), Name + ".lnk");

        public static string DesktopShortcut => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Name + ".lnk");
    }
}
