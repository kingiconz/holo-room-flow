package com.atrium.workspace;

import android.os.Bundle;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);

        Log.d("LED_BRIDGE", "REAL MAINACTIVITY STARTED");

        WebView webView = bridge.getWebView();

        // Enable autoplay for voice/sound
        WebSettings settings = webView.getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(
                new LedBridge(),
                "Android"
        );

        Log.d("LED_BRIDGE", "BRIDGE REGISTERED");
    }
}