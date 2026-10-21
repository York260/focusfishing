package com.york260.focusfishing;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * 前景服務：專注期間偵測螢幕開關。
 * 螢幕亮著的每一秒都算分心（不管在哪個 App），累計滿 5 分鐘就失敗。
 */
public class FocusService extends Service {
    public static final String ACTION_ARM = "arm";
    public static final String ACTION_STOP = "stop";
    public static final String ACTION_END = "end";
    static final long LIMIT = 5 * 60 * 1000L;
    static final long LAUNCH_WINDOW = 10 * 1000L;
    static final String PREFS = "focus";
    static final String CH_ON = "focus_ongoing";
    static final String CH_ALERT = "focus_alert";
    static final int NOTI_ONGOING = 1, NOTI_ALERT = 2;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private BroadcastReceiver receiver;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, MODE_PRIVATE); }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        makeChannels(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        SharedPreferences p = prefs(this);
        long now = System.currentTimeMillis();

        if (ACTION_STOP.equals(action)) { finish(false); return START_NOT_STICKY; }

        if (ACTION_ARM.equals(action)) {
            handler.removeCallbacksAndMessages(null);
            p.edit().clear()
                .putString("state", "launch")
                .putInt("dur", intent.getIntExtra("dur", 25))
                .putInt("spot", intent.getIntExtra("spot", 0))
                .putString("spotName", intent.getStringExtra("spotName"))
                .putLong("armAt", now)
                .putLong("distract", 0)
                .putLong("onSince", 0)
                .apply();
            goForeground("小貓解開纜繩了", "請在 10 秒內關上螢幕", 0, false);
            registerScreen();
            handler.postDelayed(this::launchTimeout, LAUNCH_WINDOW);
            return START_STICKY;
        }

        if (ACTION_END.equals(action)) {
            goForeground(runTitle(), "收線中…", 0, false);
            timeUp();
            return START_NOT_STICKY;
        }

        // 被系統重啟：恢復偵測
        String st = p.getString("state", "idle");
        if ("run".equals(st)) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            boolean on = pm != null && pm.isInteractive();
            p.edit().putLong("onSince", on ? now : 0).apply();
            goForeground(runTitle(), "安靜地等魚上鉤…", endAt(), true);
            registerScreen();
            if (now >= endAt()) timeUp(); else scheduleEnd();
            if (on) scheduleFailCheck();
            return START_STICKY;
        }
        stopSelf();
        return START_NOT_STICKY;
    }

    private long endAt() {
        SharedPreferences p = prefs(this);
        return p.getLong("startAt", 0) + p.getInt("dur", 25) * 60000L;
    }

    private String runTitle() { return "小貓正在" + prefs(this).getString("spotName", "湖上") + "釣魚"; }

    private void launchTimeout() {
        if ("launch".equals(prefs(this).getString("state", ""))) {
            prefs(this).edit().putString("state", "cancelled").apply();
            finish(false);
        }
    }

    private void registerScreen() {
        if (receiver != null) return;
        receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                if (Intent.ACTION_SCREEN_OFF.equals(i.getAction())) onScreenOff();
                else if (Intent.ACTION_SCREEN_ON.equals(i.getAction())) onScreenOn();
            }
        };
        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_SCREEN_OFF);
        f.addAction(Intent.ACTION_SCREEN_ON);
        ContextCompat.registerReceiver(this, receiver, f, ContextCompat.RECEIVER_EXPORTED);
    }

    private void onScreenOff() {
        SharedPreferences p = prefs(this);
        String st = p.getString("state", "");
        long now = System.currentTimeMillis();
        if ("launch".equals(st)) {
            handler.removeCallbacksAndMessages(null);
            p.edit().putString("state", "run").putLong("startAt", now).putLong("onSince", 0).apply();
            goForeground(runTitle(), "安靜地等魚上鉤…", endAt(), true);
            scheduleEnd();
        } else if ("run".equals(st)) {
            long since = p.getLong("onSince", 0);
            long d = p.getLong("distract", 0) + (since > 0 ? now - since : 0);
            p.edit().putLong("distract", d).putLong("onSince", 0).apply();
            handler.removeCallbacksAndMessages(null);
            goForeground(runTitle(), "分心累計 " + mss(d) + " / 5:00", endAt(), true);
        }
    }

    private void onScreenOn() {
        SharedPreferences p = prefs(this);
        if (!"run".equals(p.getString("state", ""))) return;
        long now = System.currentTimeMillis();
        if (now >= endAt()) { timeUp(); return; }
        p.edit().putLong("onSince", now).apply();
        long d = p.getLong("distract", 0);
        // 計時器顯示分心累計時間，從 d 開始往上數
        Notification n = base(CH_ON, "嚇！小貓被嚇到了", "螢幕亮著都算分心，滿 5:00 魚就游走了")
            .setWhen(now - d).setUsesChronometer(true).setShowWhen(true).build();
        nm().notify(NOTI_ONGOING, n);
        scheduleFailCheck();
    }

    private void scheduleFailCheck() {
        handler.removeCallbacksAndMessages(null);
        SharedPreferences p = prefs(this);
        long d = p.getLong("distract", 0);
        long since = p.getLong("onSince", 0);
        long used = d + (since > 0 ? System.currentTimeMillis() - since : 0);
        long wait = Math.max(500, LIMIT - used);
        long untilEnd = endAt() - System.currentTimeMillis();
        if (untilEnd > 0 && untilEnd < wait) { handler.postDelayed(this::timeUp, untilEnd); return; }
        handler.postDelayed(() -> {
            SharedPreferences q = prefs(this);
            if (!"run".equals(q.getString("state", ""))) return;
            long s = q.getLong("onSince", 0);
            long total = q.getLong("distract", 0) + (s > 0 ? System.currentTimeMillis() - s : 0);
            if (total >= LIMIT) {
                q.edit().putString("state", "fail").putLong("distract", total).putLong("onSince", 0).apply();
                alert("魚兒們都游走了", "分心滿 5 分鐘，小貓抱著空水桶划回岸邊。明天再來。");
                finish(true);
            } else scheduleFailCheck();
        }, wait);
    }

    private void scheduleEnd() {
        AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = endIntent(this);
        long at = endAt();
        try {
            if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms())
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    static PendingIntent endIntent(Context c) {
        Intent i = new Intent(c, FocusService.class).setAction(ACTION_END);
        return PendingIntent.getForegroundService(c, 7, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private void timeUp() {
        SharedPreferences p = prefs(this);
        if (!"run".equals(p.getString("state", ""))) {
            String st = p.getString("state", "");
            finish("done".equals(st) || "fail".equals(st));
            return;
        }
        long now = System.currentTimeMillis();
        long end = endAt();
        long since = p.getLong("onSince", 0);
        long d = p.getLong("distract", 0) + (since > 0 ? Math.max(0, Math.min(now, end) - since) : 0);
        if (d >= LIMIT) {
            p.edit().putString("state", "fail").putLong("distract", d).putLong("onSince", 0).apply();
            alert("魚兒們都游走了", "分心滿 5 分鐘，小貓抱著空水桶划回岸邊。明天再來。");
        } else {
            p.edit().putString("state", "done").putLong("distract", d).putLong("onSince", 0).apply();
            alert("時間到了，浮標在動！", "回到專注獨釣收線，看看釣到什麼。");
        }
        finish(true);
    }

    private void finish(boolean keepState) {
        handler.removeCallbacksAndMessages(null);
        if (receiver != null) { try { unregisterReceiver(receiver); } catch (Exception ignored) {} receiver = null; }
        AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
        if (am != null) am.cancel(endIntent(this));
        if (!keepState) {
            String st = prefs(this).getString("state", "idle");
            if (!"cancelled".equals(st)) prefs(this).edit().putString("state", "idle").apply();
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    // ---------- notifications ----------
    static void makeChannels(Context c) {
        NotificationManager m = c.getSystemService(NotificationManager.class);
        NotificationChannel on = new NotificationChannel(CH_ON, "釣魚中", NotificationManager.IMPORTANCE_LOW);
        on.setDescription("專注期間常駐，讓小貓不會被系統趕回岸邊");
        on.setShowBadge(false);
        NotificationChannel al = new NotificationChannel(CH_ALERT, "收線提醒", NotificationManager.IMPORTANCE_HIGH);
        al.setDescription("時間到或魚游走時通知你");
        al.setSound(null, null);
        m.createNotificationChannel(on);
        m.createNotificationChannel(al);
    }

    private NotificationManager nm() { return getSystemService(NotificationManager.class); }

    private NotificationCompat.Builder base(String ch, String title, String text) {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, ch)
            .setSmallIcon(R.drawable.ic_stat_fish)
            .setColor(0xFFA87D35)
            .setContentTitle(title).setContentText(text)
            .setContentIntent(pi).setOngoing(CH_ON.equals(ch)).setOnlyAlertOnce(true)
            .setSilent(true);
    }

    private void goForeground(String title, String text, long countdownTo, boolean countdown) {
        NotificationCompat.Builder b = base(CH_ON, title, text);
        if (countdown && countdownTo > 0) b.setWhen(countdownTo).setUsesChronometer(true).setChronometerCountDown(true).setShowWhen(true);
        else b.setShowWhen(false);
        Notification n = b.build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(NOTI_ONGOING, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(NOTI_ONGOING, n);
    }

    private void alert(String title, String text) {
        Notification n = base(CH_ALERT, title, text).setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH).setSilent(false).setDefaults(0).build();
        nm().notify(NOTI_ALERT, n);
    }

    static String mss(long ms) {
        long s = Math.max(0, ms) / 1000;
        return (s / 60) + ":" + String.format(java.util.Locale.US, "%02d", s % 60);
    }
}
