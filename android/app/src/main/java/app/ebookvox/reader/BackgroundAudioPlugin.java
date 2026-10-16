package app.ebookvox.reader;

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS bridge: window.Capacitor.Plugins.BackgroundAudio.start({title, text}) / stop(); emits "stopRequested" from the notification's Stop button. */
@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {
  private static BackgroundAudioPlugin instance;

  @Override
  public void load() { instance = this; }

  @PluginMethod
  public void start(PluginCall call) {
    String title = call.getString("title", "Ebookvox");
    String text = call.getString("text", "Reading aloud");
    try {
      if (AudioService.running) {
        AudioService.update(getContext(), title, text); // already foreground: just refresh the notification (safe even with the screen off)
      } else {
        Intent i = new Intent(getContext(), AudioService.class).putExtra("title", title).putExtra("text", text);
        ContextCompat.startForegroundService(getContext(), i);
      }
      call.resolve();
    } catch (Exception e) {
      call.reject(e.getMessage());
    }
  }

  @PluginMethod
  public void stop(PluginCall call) {
    getContext().stopService(new Intent(getContext(), AudioService.class));
    call.resolve();
  }

  static void requestStop() {
    if (instance != null) instance.notifyListeners("stopRequested", new JSObject());
  }
}
