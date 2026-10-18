package app.ebookvox.reader;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.WebViewListener;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private final Handler loadWatchdog = new Handler(Looper.getMainLooper());
  private Runnable pendingTimeout;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(BackgroundAudioPlugin.class);
    super.onCreate(savedInstanceState);
    // Read-aloud audio is fetched asynchronously after the user taps play, so the WebView must not
    // demand a fresh gesture for every <audio>.play(); otherwise playback is silently blocked.
    if (getBridge() != null && getBridge().getWebView() != null) {
      WebSettings s = getBridge().getWebView().getSettings();
      s.setMediaPlaybackRequiresUserGesture(false);
    }
    // Route the hardware volume keys to media volume so the user can actually raise the narration.
    setVolumeControlStream(AudioManager.STREAM_MUSIC);
    // A page that never answers (server off, wrong network, captive portal) would leave a blank white screen for a minute or more.
    // After 15 seconds with the page still loading, show the branded "Connect to internet" page instead. Errors and server (5xx) failures
    // are redirected there by Capacitor itself (server.errorPath in capacitor.config.ts).
    if (getBridge() != null) {
      getBridge().addWebViewListener(new WebViewListener() {
        @Override public void onPageStarted(WebView w) {
          cancelTimeout();
          final String err = getBridge().getErrorUrl();
          if (err == null) return;
          pendingTimeout = () -> {
            String cur = w.getUrl();
            boolean onErrorPage = cur != null && cur.startsWith(err);
            if (!onErrorPage && w.getProgress() < 100) { w.stopLoading(); w.loadUrl(err); }
          };
          loadWatchdog.postDelayed(pendingTimeout, 15000);
        }
        @Override public void onPageLoaded(WebView w) { cancelTimeout(); }
        @Override public void onReceivedError(WebView w) { cancelTimeout(); }
      });
    }
    // The on-screen keyboard resizing is done by the @capacitor/keyboard plugin (configured in capacitor.config.ts).
    // Android 13+: allow the "Reading aloud" notification (the service still keeps the app alive if refused).
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
    }
  }

  private void cancelTimeout() {
    if (pendingTimeout != null) { loadWatchdog.removeCallbacks(pendingTimeout); pendingTimeout = null; }
  }
}
