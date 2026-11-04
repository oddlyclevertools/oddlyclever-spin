using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

namespace OddlyClever
{
    /// <summary>The bundled server.py, run by the bundled Python with no console window. It sits in a job
    /// object, so it (and any ffmpeg it started) stops when the window closes, even if the app crashes.</summary>
    sealed class MusicServer : IDisposable
    {
        // The same port each time keeps the page's saved settings (they are stored per address).
        const int PreferredPort = 8791;

        readonly Process process;
        readonly IntPtr job;
        readonly StreamWriter log;
        public int Port { get; }
        public string Url => $"http://127.0.0.1:{Port}/";
        public static string LogPath => Path.Combine(Product.DataDir, "server.log");

        MusicServer(string root)
        {
            Port = FreePort();
            Directory.CreateDirectory(Product.DataDir);
            log = new StreamWriter(LogPath, false) { AutoFlush = true };
            string tools = Path.Combine(root, "tools");
            var psi = new ProcessStartInfo(Path.Combine(root, "python", "python.exe"),
                $"-u \"{Path.Combine(root, "server", "server.py")}\"")
            {
                UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.Combine(root, "server"),
                RedirectStandardOutput = true, RedirectStandardError = true,
            };
            psi.EnvironmentVariables["OCM_PORT"] = Port.ToString();
            psi.EnvironmentVariables["OCM_APP_VERSION"] = typeof(MusicServer).Assembly.GetName().Version.ToString(3); // build.sh sets it from VERSION
            psi.EnvironmentVariables["OCM_JS"] = "quickjs:" + Path.Combine(tools, "qjs.exe");
            psi.EnvironmentVariables["PATH"] = tools + ";" + Environment.GetEnvironmentVariable("PATH"); // ffmpeg, ffprobe
            psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
            process = new Process { StartInfo = psi };
            process.OutputDataReceived += (s, e) => Log(e.Data);
            process.ErrorDataReceived += (s, e) => Log(e.Data);

            job = CreateJobObject(IntPtr.Zero, null);
            var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            info.BasicLimitInformation.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if (job == IntPtr.Zero || !SetInformationJobObject(job, 9 /* ExtendedLimitInformation */, ref info, Marshal.SizeOf(info)))
                throw new InvalidOperationException("Windows refused to set up the music server (job object).");

            process.Start();
            AssignProcessToJobObject(job, process.Handle);
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
        }

        void Log(string line) { if (line == null) return; lock (log) log.WriteLine(line); }

        /// <summary>Starts the server from the program folder and waits until it answers.</summary>
        public static async Task<MusicServer> StartAsync(string root)
        {
            var server = new MusicServer(root);
            using (var http = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(2) })
                for (var until = DateTime.UtcNow.AddSeconds(90); DateTime.UtcNow < until; await Task.Delay(250))
                {
                    if (server.process.HasExited) break;
                    try { if ((await http.GetAsync(server.Url + "api/jobs")).IsSuccessStatusCode) return server; }
                    catch (Exception e) when (e is System.Net.Http.HttpRequestException || e is TaskCanceledException) { }
                }
            server.Dispose();
            throw new InvalidOperationException("The music server didn't start. Details are in " + LogPath);
        }

        // The page keeps settings and the queue in localStorage, which belongs to one port: when 8791 is taken,
        // reuse the last fallback port so a restart doesn't start from scratch.
        static string PortFile => Path.Combine(Product.DataDir, "port.txt");

        static int FreePort()
        {
            int.TryParse(File.Exists(PortFile) ? File.ReadAllText(PortFile).Trim() : "", out int saved);
            foreach (int port in new[] { PreferredPort, saved, 0 })
            {
                var l = new TcpListener(IPAddress.Loopback, port);
                try
                {
                    l.Start();
                    int got = ((IPEndPoint)l.LocalEndpoint).Port;
                    if (got != PreferredPort && got != saved) { Directory.CreateDirectory(Product.DataDir); File.WriteAllText(PortFile, got.ToString()); }
                    return got;
                }
                catch (SocketException) { } // taken: try the next one
                finally { l.Stop(); }
            }
            throw new InvalidOperationException("No free port for the music server.");
        }

        public void Dispose()
        {
            if (job != IntPtr.Zero) CloseHandle(job); // kills the server and everything it started
            process.Dispose();
            lock (log) log.Dispose();
        }

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass, SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount, ReadTransferCount, WriteTransferCount, OtherTransferCount;
            public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attrs, string name);
        [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION info, int size);
        [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
        [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    }
}
