package org.telegramall.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsAnimationCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.WindowInsetsCompat;

import java.util.List;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  // the system bars' sizes in CSS px: top, bottom, left, right
  private float[] insets = new float[]{0, 0, 0, 0};

  private View contentView;
  private WebView pageView;
  private float density = 1;
  private Insets bars = Insets.NONE;
  // the keyboard is sliding in or out: the page follows it frame by frame
  private boolean keyboardMoving = false;
  private int shownKeyboard = -1;

  /**
   * Sets the bottom of the view and the sizes of the bars for a keyboard height (px). It is done at every frame of the
   * keyboard's own animation, so the page grows and shrinks with it instead of jumping to the end at once.
   */
  private void applyKeyboard(int imeBottom) {
    if(imeBottom == shownKeyboard) return;
    shownKeyboard = imeBottom;
    contentView.setPadding(0, 0, 0, imeBottom);
    // the gesture strip is under the keyboard while it is up: its room goes as the keyboard rises over it
    insets = new float[]{
      bars.top / density,
      Math.max(0, bars.bottom - imeBottom) / density,
      bars.left / density,
      bars.right / density
    };
    pushInsets(pageView);
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // The page is drawn edge to edge, under the status bar and the navigation bar, the way the official
    // client does it. The page learns how big the bars are (`--sat` / `--sab` / ...) and pads what has to
    // stay clear of them; the keyboard alone shrinks the view.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    final View content = findViewById(android.R.id.content);
    final WebView webView = getBridge().getWebView();

    contentView = content;
    pageView = webView;
    density = getResources().getDisplayMetrics().density;

    ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
      bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      // while the keyboard moves, its animation sets the bottom (below), not the end of it that this reports at the start
      if(!keyboardMoving) {
        Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
        shownKeyboard = -1;
        applyKeyboard(ime.bottom > bars.bottom ? ime.bottom : 0);
      }

      return WindowInsetsCompat.CONSUMED;
    });

    ViewCompat.setWindowInsetsAnimationCallback(getWindow().getDecorView(), new WindowInsetsAnimationCompat.Callback(
      WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE
    ) {
      @Override
      public void onPrepare(WindowInsetsAnimationCompat animation) {
        if((animation.getTypeMask() & WindowInsetsCompat.Type.ime()) != 0) keyboardMoving = true;
      }

      @Override
      public WindowInsetsCompat onProgress(WindowInsetsCompat windowInsets, List<WindowInsetsAnimationCompat> running) {
        if(keyboardMoving) applyKeyboard(windowInsets.getInsets(WindowInsetsCompat.Type.ime()).bottom);
        return windowInsets;
      }

      @Override
      public void onEnd(WindowInsetsAnimationCompat animation) {
        if((animation.getTypeMask() & WindowInsetsCompat.Type.ime()) == 0) return;
        keyboardMoving = false;
        WindowInsetsCompat last = ViewCompat.getRootWindowInsets(content);
        if(last != null) {
          int bottom = last.getInsets(WindowInsetsCompat.Type.ime()).bottom;
          shownKeyboard = -1;
          applyKeyboard(bottom > bars.bottom ? bottom : 0);
        }
      }
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

      // a full-screen sheet takes the navigation bar (the gesture strip) away: it comes back with a swipe
      // from the edge and goes again by itself
      @JavascriptInterface
      public void setNavigationHidden(boolean hidden) {
        runOnUiThread(() -> {
          WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
          controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
          if(hidden) controller.hide(WindowInsetsCompat.Type.navigationBars());
          else controller.show(WindowInsetsCompat.Type.navigationBars());
        });
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
