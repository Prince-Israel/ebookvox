package app.ebookvox.reader;

import android.media.AudioManager;
import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Read-aloud audio is fetched asynchronously after the user taps play, so the WebView must not
    // demand a fresh gesture for every <audio>.play(); otherwise playback is silently blocked.
    if (getBridge() != null && getBridge().getWebView() != null) {
      WebSettings s = getBridge().getWebView().getSettings();
      s.setMediaPlaybackRequiresUserGesture(false);
    }
    // Route the hardware volume keys to media volume so the user can actually raise the narration.
    setVolumeControlStream(AudioManager.STREAM_MUSIC);
  }
}
