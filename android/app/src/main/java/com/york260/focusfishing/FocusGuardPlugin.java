package com.york260.focusfishing;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS 介面：window.Capacitor.Plugins.FocusGuard */
@CapacitorPlugin(name = "FocusGuard")
public class FocusGuardPlugin extends Plugin {

    @PluginMethod
    public void arm(PluginCall call) {
        askNotify();
        Intent i = new Intent(getContext(), FocusService.class).setAction(FocusService.ACTION_ARM)
            .putExtra("dur", call.getInt("dur", 25).intValue())
            .putExtra("spot", call.getInt("spot", 0).intValue())
            .putExtra("spotName", call.getString("spotName", "湖上"));
        ContextCompat.startForegroundService(getContext(), i);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        FocusService.prefs(getContext()).edit().putString("state", "idle").apply();
        Intent i = new Intent(getContext(), FocusService.class).setAction(FocusService.ACTION_STOP);
        try { getContext().startService(i); } catch (Exception ignored) {}
        call.resolve();
    }

    /** 收線或看完結果後清掉狀態 */
    @PluginMethod
    public void clear(PluginCall call) {
        FocusService.prefs(getContext()).edit().clear().putString("state", "idle").apply();
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        SharedPreferences p = FocusService.prefs(getContext());
        JSObject o = new JSObject();
        o.put("state", p.getString("state", "idle"));
        o.put("dur", p.getInt("dur", 25));
        o.put("spot", p.getInt("spot", 0));
        o.put("armAt", p.getLong("armAt", 0));
        o.put("startAt", p.getLong("startAt", 0));
        o.put("distractMs", p.getLong("distract", 0));
        o.put("onSince", p.getLong("onSince", 0));
        o.put("now", System.currentTimeMillis());
        call.resolve(o);
    }

    @PluginMethod
    public void askPermission(PluginCall call) {
        askNotify();
        call.resolve();
    }

    private void askNotify() {
        if (Build.VERSION.SDK_INT >= 33 && getActivity() != null &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 41);
        }
    }
}
