package com.hacklingo.app;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // AFTER super — AppCompatActivity resets window state during super, so must come after
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Paint window black so there is never a grey gap before HTML loads
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.BLACK));

        // Fully transparent system bars
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        // Kill Android contrast enforcement scrim (Android 10+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }

        // THE MISSING PIECE: Capacitor's WebView has a grey default background.
        // With transparent bars the WebView background shows through — making bars appear grey.
        // Setting it transparent means the black window background shows through instead.
        try {
            getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
        } catch (Exception ignored) {}
    }
}