package com.oddlyclever.music

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.drawable.Icon
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import org.json.JSONObject
import java.net.URL

/**
 * Foreground media service: keeps the app (and its Python server) alive with the screen off, and shows a
 * media notification + MediaSession so lock-screen and headset buttons work. The page plays the audio;
 * this service only mirrors its state (bridge.js -> OCMNative.state) and forwards buttons back.
 */
class PlaybackService : Service() {
    private lateinit var session: MediaSession
    private lateinit var wake: PowerManager.WakeLock
    private var state = JSONObject()
    private var artUrl = ""
    private var art: Bitmap? = null

    override fun onCreate() {
        super.onCreate()
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL, "Now playing", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        wake = getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ocm:play")
        session = MediaSession(this, "OddlyClever Spin").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() = page("play")
                override fun onPause() = page("pause")
                override fun onSkipToNext() = page("nexttrack")
                override fun onSkipToPrevious() = page("previoustrack")
                override fun onSeekTo(pos: Long) = page("seekto", pos / 1000.0)
                override fun onStop() = page("pause")
            })
            setSessionActivity(MainActivity.openApp(this@PlaybackService))
            isActive = true
        }
        running = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (val a = intent?.getStringExtra(EXTRA_ACTION)) {
            null -> {}
            "stop" -> { stopSelf(); return START_NOT_STICKY } // paused notification swiped away
            else -> page(a)
        }
        intent?.getStringExtra(EXTRA_STATE)?.let { apply(JSONObject(it)) } ?: show()
        return START_NOT_STICKY
    }

    private fun page(action: String, arg: Double = 0.0) {
        MainActivity.instance?.pageAction(action, arg)
    }

    fun apply(s: JSONObject) {
        state = s
        val url = s.optString("art")
        if (url != artUrl) {
            artUrl = url
            art = null
            if (url.isNotEmpty()) Thread {
                val bmp = runCatching { URL(url).openStream().use(BitmapFactory::decodeStream) }.getOrNull()
                if (artUrl == url) { art = bmp; show() }
            }.start()
        }
        show()
    }

    @Synchronized
    private fun show() {
        val playing = state.optBoolean("playing")
        val title = state.optString("title").ifEmpty { "OddlyClever Spin" }
        session.setMetadata(MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, state.optString("artist"))
            .putString(MediaMetadata.METADATA_KEY_ALBUM, state.optString("album"))
            .putLong(MediaMetadata.METADATA_KEY_DURATION, state.optLong("dur"))
            .apply { art?.let { putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, it) } }
            .build())
        session.setPlaybackState(PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or
                PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS or PlaybackState.ACTION_SEEK_TO)
            .setState(if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED, state.optLong("pos"), if (playing) 1f else 0f)
            .build())

        val n = Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_note)
            .setContentTitle(title)
            .setContentText(state.optString("artist"))
            .setLargeIcon(art)
            .setContentIntent(MainActivity.openApp(this))
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(playing)
            .setDeleteIntent(button("stop"))
            .addAction(action(R.drawable.ic_prev, "Previous", "previoustrack"))
            .addAction(if (playing) action(R.drawable.ic_pause, "Pause", "pause") else action(R.drawable.ic_play, "Play", "play"))
            .addAction(action(R.drawable.ic_next, "Next", "nexttrack"))
            .setStyle(Notification.MediaStyle().setMediaSession(session.sessionToken).setShowActionsInCompactView(0, 1, 2))
            .build()
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            else startForeground(ID, n)
        } catch (e: Exception) { // Android 12+ may refuse from the background; the notification still updates
            Log.w(MainActivity.TAG, "startForeground refused", e)
            getSystemService(NotificationManager::class.java).notify(ID, n)
        }
        if (!playing) stopForeground(STOP_FOREGROUND_DETACH) // paused: let the user swipe it away
        if (playing && !wake.isHeld) wake.acquire(6 * 60 * 60 * 1000L) else if (!playing && wake.isHeld) wake.release()
    }

    private fun action(icon: Int, label: String, name: String) =
        Notification.Action.Builder(Icon.createWithResource(this, icon), label, button(name)).build()

    private fun button(action: String): PendingIntent = PendingIntent.getService(this, action.hashCode(),
        Intent(this, PlaybackService::class.java).putExtra(EXTRA_ACTION, action), PendingIntent.FLAG_IMMUTABLE)

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (!state.optBoolean("playing")) stopSelf()
    }

    override fun onDestroy() {
        running = null
        session.release()
        if (wake.isHeld) wake.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val CHANNEL = "playback"
        private const val ID = 1
        private const val EXTRA_ACTION = "action"
        private const val EXTRA_STATE = "state"
        @Volatile private var running: PlaybackService? = null

        /** Called from the page's JS thread whenever the track or play state changes. */
        fun update(ctx: Context, json: String) {
            running?.let { s -> Handler(ctx.mainLooper).post { s.apply(JSONObject(json)) }; return }
            if (!JSONObject(json).optBoolean("playing")) return // nothing to show until the first play
            val i = Intent(ctx, PlaybackService::class.java).putExtra(EXTRA_STATE, json)
            runCatching { ctx.startForegroundService(i) }.onFailure { Log.w(MainActivity.TAG, "service start refused", it) }
        }
    }
}
