package app.ebookvox.reader;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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
    // The on-screen keyboard resizing is done by the @capacitor/keyboard plugin (configured in capacitor.config.ts).
    // Android 13+: allow the "Reading aloud" notification (the service still keeps the app alive if refused).
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
    }
  }
}
