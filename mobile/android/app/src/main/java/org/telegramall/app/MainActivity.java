package org.telegramall.app;

import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  // the system bars' sizes in CSS px: top, bottom, left, right
  private float[] insets = new float[]{0, 0, 0, 0};

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // The page is drawn edge to edge, under the status bar and the navigation bar, the way the official
    // client does it. The page learns how big the bars are (`--sat` / `--sab` / ...) and pads what has to
    // stay clear of them; the keyboard alone shrinks the view.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    final View content = findViewById(android.R.id.content);
    final WebView webView = getBridge().getWebView();

    ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
      Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
      boolean keyboard = ime.bottom > bars.bottom;
      view.setPadding(0, 0, 0, keyboard ? ime.bottom : 0);

      DisplayMetrics metrics = getResources().getDisplayMetrics();
      insets = new float[]{
        bars.top / metrics.density,
        keyboard ? 0 : bars.bottom / metrics.density,
        bars.left / metrics.density,
        bars.right / metrics.density
      };
      pushInsets(webView);
      return WindowInsetsCompat.CONSUMED;
    });

    // the system back gesture / button closes the open screen first, and only from the chat list leaves
    getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
      @Override
      public void handleOnBackPressed() {
        webView.evaluateJavascript("(function(){return !!(window.__tgAndroidBack&&window.__tgAndroidBack());})()", value -> {
          if(!"true".equals(value)) moveTaskToBack(true);
        });
      }
    });

    webView.addJavascriptInterface(new Object() {
      @JavascriptInterface
      public String getInsets() {
        return insets[0] + "," + insets[1] + "," + insets[2] + "," + insets[3];
      }
    }, "TgAllAndroid");
  }

  private void pushInsets(WebView webView) {
    final String script = "(function(){var s=document.documentElement.style;"
      + "s.setProperty('--sat','" + insets[0] + "px');"
      + "s.setProperty('--sab','" + insets[1] + "px');"
      + "s.setProperty('--sal','" + insets[2] + "px');"
      + "s.setProperty('--sar','" + insets[3] + "px');})()";
    webView.post(() -> webView.evaluateJavascript(script, null));
  }
}
