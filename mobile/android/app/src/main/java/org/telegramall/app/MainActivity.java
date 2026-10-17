package org.telegramall.app;

import android.graphics.Color;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Android 15 draws the app edge to edge, under the status and navigation bars. The page lays itself
    // out in the whole window, so keep it between the bars (and above the keyboard) with padding.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    final View content = findViewById(android.R.id.content);
    ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
      Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
      view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
      return WindowInsetsCompat.CONSUMED;
    });

    // the strips under the bars take the colour of the page's theme (set from themeController)
    getBridge().getWebView().addJavascriptInterface(new Object() {
      @JavascriptInterface
      public void setBarColor(String color) {
        runOnUiThread(() -> content.setBackgroundColor(Color.parseColor(color)));
      }
    }, "TgAllAndroid");
  }
}
