# 專注獨釣 FocusFishing

把專注變成釣魚的 Android App。開始專注後，小貓會坐船去世界各地的釣點；忍住不打開手機，時間到就能收線，釣到魚、傳說生物或小驚喜。

## 規則
- 按下出航後，10 秒內關上螢幕，小貓才會出發。
- 專注期間螢幕亮著都算分心（用其他 App 也算），通知列會顯示分心累計。
- 分心累積滿 5 分鐘，魚就全部游走了。
- 專注越久，越有機會遇見稀有魚和傳說生物。

## 安裝
到 Releases 下載 `FocusFishing.apk`，在手機上開啟安裝（需允許「安裝未知應用程式」）。
第一次開啟請允許通知；建議在系統設定把「專注獨釣」的電池最佳化設為「不限制」。

## 開發
- 網頁介面：`www/index.html`
- 螢幕偵測（前景服務）：`android/app/src/main/java/com/york260/focusfishing/FocusService.java`
- JS 介面：`FocusGuardPlugin.java`（`window.Capacitor.Plugins.FocusGuard`）

推送到 `main` 會自動打包 APK（Actions → Artifacts）；並依 `android/app/build.gradle` 的 versionName 發佈到 Releases（改版時記得調高 versionCode 和 versionName）。

```bash
npm ci
npx cap sync android
cd android && ./gradlew assembleRelease
```

`android/app/focusfishing.keystore` 是本專案的固定簽章，讓每次更新都能直接覆蓋安裝；repo 請維持私人。
