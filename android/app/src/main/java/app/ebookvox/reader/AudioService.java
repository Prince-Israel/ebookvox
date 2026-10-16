package app.ebookvox.reader;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

/**
 * Keeps Ebookvox alive while it reads aloud. Without a foreground service Android freezes the app soon after the screen turns
 * off or the app is minimised, which stops the narration. The notification also gives a one-tap way to stop reading.
 */
public class AudioService extends Service {
  static final String CHANNEL = "reading";
  static final String ACTION_STOP = "app.ebookvox.reader.STOP_READING";
  static final int ID = 4711;
  static volatile boolean running = false;
  private PowerManager.WakeLock wake;

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      BackgroundAudioPlugin.requestStop();
      shutdown();
      return START_NOT_STICKY;
    }
    String title = intent != null && intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "Ebookvox";
    String text = intent != null && intent.getStringExtra("text") != null ? intent.getStringExtra("text") : "Reading aloud";
    Notification n = build(this, title, text);
    if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    else startForeground(ID, n);
    running = true;
    if (wake == null) {
      PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
      wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ebookvox:reading");
      wake.setReferenceCounted(false);
      wake.acquire(6 * 60 * 60 * 1000L); // never longer than six hours
    }
    return START_NOT_STICKY;
  }

  static Notification build(Context c, String title, String text) {
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm.getNotificationChannel(CHANNEL) == null) {
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Reading aloud", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Shown while Ebookvox is reading to you");
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
      }
    }
    int imm = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
    Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
    PendingIntent content = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | imm);
    PendingIntent stop = PendingIntent.getService(c, 1, new Intent(c, AudioService.class).setAction(ACTION_STOP), PendingIntent.FLAG_UPDATE_CURRENT | imm);
    return new NotificationCompat.Builder(c, CHANNEL)
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle(title)
      .setContentText(text)
      .setContentIntent(content)
      .addAction(android.R.drawable.ic_media_pause, "Stop", stop)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .build();
  }

  static void update(Context c, String title, String text) {
    ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(ID, build(c, title, text));
  }

  private void shutdown() {
    running = false;
    if (wake != null && wake.isHeld()) wake.release();
    wake = null;
    stopForeground(true);
    stopSelf();
  }

  @Override
  public void onDestroy() {
    running = false;
    if (wake != null && wake.isHeld()) wake.release();
    super.onDestroy();
  }

  @Override
  public void onTaskRemoved(Intent rootIntent) {
    // The listener swiped the app away: that means "closed", so stop reading.
    shutdown();
    super.onTaskRemoved(rootIntent);
  }

  @Override
  public IBinder onBind(Intent intent) { return null; }
}
