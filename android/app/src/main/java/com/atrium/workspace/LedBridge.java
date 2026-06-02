package com.atrium.workspace;

import android.util.Log;
import android.webkit.JavascriptInterface;

import java.io.DataOutputStream;

public class LedBridge {

    private static final String TAG = "LED_BRIDGE";

    @JavascriptInterface
    public String setLedColor(String color) {

        try {

            String code;

            switch (color.toUpperCase()) {

                case "OFF":
                    code = "0x02";
                    break;

                case "ON":
                    code = "0x03";
                    break;

                case "RED":
                    code = "0x04";
                    break;

                case "GREEN":
                    code = "0x05";
                    break;

                case "YELLOW":
                    code = "0x10";
                    break;

                default:
                    return "UNKNOWN COLOR";
            }

            Process process = Runtime.getRuntime().exec("su");

            DataOutputStream os =
                    new DataOutputStream(
                            process.getOutputStream()
                    );

            os.writeBytes(
                    "echo w " + code +
                    " > /sys/devices/platform/led_con_h/zigbee_reset\n"
            );

            os.writeBytes("exit\n");
            os.flush();

            int exitCode = process.waitFor();

            Log.d(TAG, "LED " + color + " SENT");
            Log.d(TAG, "EXIT CODE = " + exitCode);

            return color;

        } catch (Exception ex) {

            Log.e(TAG, "LED FAILED", ex);

            return ex.toString();
        }
    }
}
