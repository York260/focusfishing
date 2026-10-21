// 專注異獸錄（FocusBeasts）Windows 主程式
const { app, BrowserWindow, ipcMain, powerMonitor, Notification, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const readline = require('readline');

let win = null;
let watcher = null;
let locked = false;
let running = false;
let selfPids = new Set([process.pid]);

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.setAppUserModelId('com.york260.focusbeasts');

const artDir = () => {
  const d = path.join(app.getPath('userData'), 'art');
  fs.mkdirSync(d, { recursive: true });
  return d;
};

function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 960, minHeight: 640,
    backgroundColor: '#11131B', autoHideMenuBar: true, title: '專注異獸錄',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: false // 視窗在背景時計時也不能停
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('close', e => {
    if (!running) return;
    const r = dialog.showMessageBoxSync(win, {
      type: 'warning', buttons: ['繼續專注', '仍要關閉'], defaultId: 0, cancelId: 0,
      title: '專注進行中', message: '現在關閉，這次專注會算失敗。', detail: '如果是進化試煉，夥伴會進入失衡狀態。'
    });
    if (r === 0) e.preventDefault();
  });
}

/* ---------- 前景視窗偵測（PowerShell + Win32 API，不需額外原生模組） ---------- */
const PS = `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class FBW {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
}
"@
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
while ($true) {
  $h = [FBW]::GetForegroundWindow()
  $sb = New-Object System.Text.StringBuilder 512
  [void][FBW]::GetWindowText($h, $sb, 512)
  $fpid = [uint32]0
  [void][FBW]::GetWindowThreadProcessId($h, [ref]$fpid)
  $n = ''
  try { $n = (Get-Process -Id $fpid -ErrorAction Stop).ProcessName } catch {}
  $o = @{ p = $n; t = $sb.ToString(); id = [int]$fpid } | ConvertTo-Json -Compress
  [Console]::Out.WriteLine($o)
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 1000
}
`;

function refreshPids() {
  try { selfPids = new Set(app.getAppMetrics().map(m => m.pid).concat(process.pid)); } catch (e) {}
}

function startWatcher() {
  if (process.platform !== 'win32') return;
  const enc = Buffer.from(PS, 'utf16le').toString('base64');
  watcher = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], { windowsHide: true });
  const rl = readline.createInterface({ input: watcher.stdout });
  rl.on('line', line => {
    let o; try { o = JSON.parse(line.trim()); } catch (e) { return; }
    if (!win || win.isDestroyed()) return;
    win.webContents.send('fg', { p: o.p || '', t: o.t || '', self: selfPids.has(o.id), locked, at: Date.now() });
  });
  watcher.on('exit', () => { watcher = null; if (!app.isQuitting) setTimeout(startWatcher, 3000); });
}

app.whenReady().then(() => {
  createWindow();
  refreshPids();
  setInterval(refreshPids, 10000);
  startWatcher();
  powerMonitor.on('lock-screen', () => { locked = true; });
  powerMonitor.on('unlock-screen', () => { locked = false; });
});
app.on('before-quit', () => { app.isQuitting = true; if (watcher) watcher.kill(); });
app.on('window-all-closed', () => app.quit());

/* ---------- IPC ---------- */
ipcMain.handle('info', () => ({ platform: process.platform, artDir: artDir(), version: app.getVersion() }));
ipcMain.handle('art:save', (_e, id, dataUrl) => {
  if (!/^[a-z]{3}\d$/.test(id)) throw new Error('bad id');
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('請選擇 PNG、JPG 或 WebP 圖片');
  fs.writeFileSync(path.join(artDir(), id + '.png'), Buffer.from(m[2], 'base64'));
  return true;
});
ipcMain.handle('art:remove', (_e, id) => {
  if (!/^[a-z]{3}\d$/.test(id)) return false;
  try { fs.unlinkSync(path.join(artDir(), id + '.png')); } catch (e) {}
  return true;
});
ipcMain.handle('art:open', () => shell.openPath(artDir()));
ipcMain.on('running', (_e, v) => { running = !!v; });
ipcMain.on('notify', (_e, title, body) => {
  if (Notification.isSupported()) new Notification({ title, body, silent: true }).show();
  if (win && !win.isFocused()) win.flashFrame(true);
});
