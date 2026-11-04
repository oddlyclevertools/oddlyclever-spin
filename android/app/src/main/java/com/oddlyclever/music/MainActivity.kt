package com.oddlyclever.music

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.FileObserver
import android.provider.Settings
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import java.io.File
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private lateinit var root: FrameLayout
    @Volatile private var ready = false
    private val bridgeJs by lazy { assets.open("bridge.js").bufferedReader().readText() }
    private var afterStorage: (() -> Unit)? = null
    private var installPending = false

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen().setKeepOnScreenCondition { !ready }
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        instance = this

        if (BuildConfig.WEB_DEBUG) WebView.setWebContentsDebuggingEnabled(true)
        web = WebView(this).apply {
            setBackgroundColor(Color.parseColor(DEFAULT_THEME))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.textZoom = 100 // the phone's font size setting would scale text and push the layout off screen
            addJavascriptInterface(Bridge(), "OCMNative")
            if (Build.VERSION.SDK_INT >= 26) setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                    if (req.url.host == "127.0.0.1") return false
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, req.url)) } // other sites open in the browser
                    return true
                }

                // Fallback for old WebViews without document-start scripts (bridge.js skips itself if already in).
                override fun onPageFinished(view: WebView, url: String) {
                    if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) view.evaluateJavascript(bridgeJs, null)
                }
            }
        }
        // The web UI pads for env(safe-area-inset-*), but WebView doesn't report system bars (and ignores its
        // own padding), so a padded frame keeps it clear of them; the frame paints the bars in the page's theme colour.
        root = FrameLayout(this).apply { addView(web) }
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setContentView(root)
        applyThemeColor(DEFAULT_THEME)

        onBackPressedDispatcher.addCallback(this) {
            if (web.canGoBack()) web.goBack() else moveTaskToBack(true) // keep playing, like a music app
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }

        withStorage { Thread {
            startServerOnce()
            runOnUiThread {
                val origin = "http://127.0.0.1:$port"
                if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                    WebViewCompat.addDocumentStartJavaScript(web, bridgeJs, setOf(origin))
                }
                web.loadUrl("$origin/") // the page keeps its own state (queue, settings) in localStorage
                ready = true
            }
        }.start() }
    }

    /** Android 8-10 need WRITE_EXTERNAL_STORAGE for the public Music folder: ask once, before the server starts. */
    private fun withStorage(go: () -> Unit) {
        val prefs = getSharedPreferences("ocm", MODE_PRIVATE)
        if (Build.VERSION.SDK_INT >= 30 || serverThread != null || prefs.getBoolean("askedStorage", false) ||
            checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED) return go()
        prefs.edit().putBoolean("askedStorage", true).apply()
        afterStorage = go
        requestPermissions(arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), 2) // no: songs stay in the app's own folder
    }

    override fun onRequestPermissionsResult(code: Int, perms: Array<String>, results: IntArray) {
        super.onRequestPermissionsResult(code, perms, results)
        if (code == 2) afterStorage?.also { afterStorage = null }?.invoke()
    }

    override fun onResume() {
        super.onResume()
        if (!installPending) return
        installPending = false // back from "Install unknown apps": carry on if it was allowed, else tell the page
        if (Build.VERSION.SDK_INT < 26 || packageManager.canRequestPackageInstalls()) installUpdate() else pageEvent("install-blocked")
    }

    /** Hands the APK that updates.py downloaded to the system installer (only that one file is shared). */
    fun installUpdate(): String {
        val apk = File(musicDir(), ".cache/update/update.apk")
        if (!apk.isFile) return "missing"
        if (Build.VERSION.SDK_INT >= 26 && !packageManager.canRequestPackageInstalls()) {
            installPending = true
            runOnUiThread {
                runCatching { startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName"))) }
                    .onFailure { installPending = false; pageEvent("install-blocked") }
            }
            return "permission"
        }
        val uri = FileProvider.getUriForFile(this, "$packageName.files", apk)
        runOnUiThread {
            runCatching {
                startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
            }.onFailure { Log.e(TAG, "installer", it); pageEvent("install-failed") }
        }
        return "ok"
    }

    private fun pageEvent(name: String) = runOnUiThread { web.evaluateJavascript("window.__ocmEvent && window.__ocmEvent('$name')", null) }

    private fun musicDir() = File(getExternalFilesDir(Environment.DIRECTORY_MUSIC) ?: filesDir, "OddlyClever Music")

    /** Public Music/OddlyClever Spin, so songs show in Files and other players and outlive the app. Null: keep them private. */
    private fun publicSongs(): File? {
        if (Build.VERSION.SDK_INT < 30 && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) return null
        @Suppress("DEPRECATION")
        val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC), BuildConfig.SONGS_DIR)
        return dir.takeIf { it.isDirectory || it.mkdirs() }
    }

    /** Tells the media scanner about songs in Music/OddlyClever Spin so Files and other players list them (even on
     *  Android 15 a file written there stays unlisted until scanned). Scans what is there once, then each change. */
    @Suppress("DEPRECATION")
    private fun watchSongs(dir: File) {
        val prefs = getSharedPreferences("ocm", MODE_PRIVATE)
        if (!prefs.getBoolean("scannedSongs", false)) { // once, for songs already there
            prefs.edit().putBoolean("scannedSongs", true).apply()
            dir.listFiles { f -> f.isFile && !f.name.startsWith(".") }?.map { it.path }?.takeIf { it.isNotEmpty() }
                ?.let { MediaScannerConnection.scanFile(applicationContext, it.toTypedArray(), null, null) }
        }
        scanner = object : FileObserver(dir.path, CLOSE_WRITE or MOVED_TO or MOVED_FROM or DELETE) {
            override fun onEvent(event: Int, name: String?) {
                if (name != null && !name.startsWith(".")) MediaScannerConnection.scanFile(applicationContext, arrayOf(File(dir, name).path), null, null)
            }
        }.apply { startWatching() }
    }

    private fun serverEnv(songs: File?): String {
        val env = JSONObject()
            .put("OCM_PLATFORM", "android")
            .put("OCM_APP_VERSION", packageManager.getPackageInfo(packageName, 0).versionName)
            .put("OCM_OS", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}), ${Build.SUPPORTED_ABIS.firstOrNull()}")
            .put("OCM_ABI", Build.SUPPORTED_ABIS.firstOrNull() ?: "")
        if (songs != null) env.put("OCM_SONGS", songs.path).put("OCM_SONGS_LABEL", "Music › ${BuildConfig.SONGS_DIR}")
        else env.put("OCM_SONGS_LABEL", "Inside the app (Android › data › com.oddlyclever.music)")
        // Test builds only: test-env.json (pushed with adb) points updates at a fake release / PyPI index.
        val test = File(getExternalFilesDir(null), "test-env.json")
        if (BuildConfig.WEB_DEBUG && test.isFile) JSONObject(test.readText()).let { t -> t.keys().forEach { env.put(it, t.getString(it)) } }
        return env.toString()
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        if (isFinishing) stopService(Intent(this, PlaybackService::class.java))
        web.destroy()
        super.onDestroy()
    }

    // Note: onPause/onStop deliberately never call web.onPause() or pauseTimers(), so audio keeps playing.

    private fun startServerOnce() {
        synchronized(Companion) {
            if (serverThread == null) {
                val appDir = unpackWebApp()
                val music = musicDir()
                val songs = publicSongs()?.also(::watchSongs)
                val env = serverEnv(songs)
                val qjs = File(applicationInfo.nativeLibraryDir, "libqjs.so").path
                // Fixed port so the page's localStorage (queue, theme, settings) survives restarts.
                port = if (portFree(DEFAULT_PORT)) DEFAULT_PORT else ServerSocket(0).use { it.localPort }
                if (!Python.isStarted()) Python.start(AndroidPlatform(this))
                serverThread = Thread {
                    try {
                        Python.getInstance().getModule("ocm_main").callAttr("start", appDir.path, music.path, qjs, port, env)
                    } catch (e: Throwable) {
                        Log.e(TAG, "server stopped", e)
                    }
                }.apply { isDaemon = true; start() }
            }
        }
        val until = System.currentTimeMillis() + 60_000 // first start imports yt-dlp and ytmusicapi
        while (System.currentTimeMillis() < until && !portOpen(port)) Thread.sleep(150)
    }

    /** Copies server.py and web/ out of the APK when the app is new or updated (server.py serves files from disk). */
    private fun unpackWebApp(): File {
        val dir = File(filesDir, "app")
        val stamp = File(dir, ".stamp")
        val version = packageManager.getPackageInfo(packageName, 0).lastUpdateTime.toString()
        if (stamp.takeIf { it.exists() }?.readText() == version) return dir
        dir.deleteRecursively() // only our own copy of the bundled app, never the music folder
        copyAsset("app", dir)
        stamp.writeText(version)
        return dir
    }

    private fun copyAsset(path: String, to: File) {
        val kids = assets.list(path).orEmpty()
        if (kids.isEmpty()) {
            to.parentFile?.mkdirs()
            assets.open(path).use { i -> to.outputStream().use { i.copyTo(it) } }
        } else kids.forEach { copyAsset("$path/$it", File(to, it)) }
    }

    fun applyThemeColor(color: String) {
        val c = runCatching { Color.parseColor(color.trim()) }.getOrNull() ?: return
        web.setBackgroundColor(c)
        root.setBackgroundColor(c)
        val light = Color.luminance(c) > 0.5f
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = light
            isAppearanceLightNavigationBars = light
        }
    }

    /** Native media buttons call the page's own mediaSession handlers (bridge.js). */
    fun pageAction(action: String, arg: Double = 0.0) = runOnUiThread {
        web.evaluateJavascript("window.__ocm && window.__ocm('$action', $arg)", null)
    }

    inner class Bridge {
        @JavascriptInterface fun state(json: String) = PlaybackService.update(this@MainActivity, json).also { Log.d(TAG, "state $json") }
        @JavascriptInterface fun theme(color: String) = runOnUiThread { applyThemeColor(color) }
        @JavascriptInterface fun installUpdate(): String = this@MainActivity.installUpdate()
        @JavascriptInterface fun copy(text: String): Boolean = runCatching {
            (getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager)
                .setPrimaryClip(android.content.ClipData.newPlainText("OddlyClever Spin diagnostics", text))
        }.isSuccess
    }

    @SuppressLint("StaticFieldLeak")
    companion object {
        const val TAG = "OCM"
        const val DEFAULT_PORT = 8790
        const val DEFAULT_THEME = "#170f20"
        var instance: MainActivity? = null
        private var serverThread: Thread? = null
        private var scanner: FileObserver? = null // kept so it isn't collected
        var port = DEFAULT_PORT

        private fun portFree(p: Int) = runCatching { ServerSocket(p, 1, java.net.InetAddress.getByName("127.0.0.1")).close() }.isSuccess
        private fun portOpen(p: Int) = runCatching { Socket().use { it.connect(InetSocketAddress("127.0.0.1", p), 300) } }.isSuccess

        fun openApp(ctx: android.content.Context): android.app.PendingIntent = android.app.PendingIntent.getActivity(
            ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            android.app.PendingIntent.FLAG_IMMUTABLE)
    }
}
