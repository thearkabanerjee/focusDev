// @ts-check
const path = require("path");
const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  let panel;

  const openCmd = vscode.commands.registerCommand('focusDev.open', () => {
    if (panel) {
      panel.reveal(vscode.ViewColumn.Two);
      return;
    }

    panel = vscode.window.createWebviewPanel(
      'focusDevTimer',
      'FocusDev',
      { viewColumn: vscode.ViewColumn.Two, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    const logoUri = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, "assests", "mario.gif"))
    );

    panel.webview.html = getWebviewContent(panel.webview, context, logoUri);

    panel.onDidDispose(() => {
      panel = undefined;
    }, null, context.subscriptions);

    panel.webview.onDidReceiveMessage(message => {
      switch (message.type) {
        case 'sessionComplete': {
          const key = 'focusDev.totalSessions';
          const previous = context.globalState.get(key, 0);
          const updated = previous + 1;
          context.globalState.update(key, updated);
          vscode.window.showInformationMessage(`FocusDev: session complete — total sessions: ${updated}`);
          break;
        }
        case 'openSettings': {
          vscode.commands.executeCommand('workbench.action.openSettings', 'focusDev');
          break;
        }
        case 'requestConfig': {
          const config = vscode.workspace.getConfiguration('focusDev');
          panel.webview.postMessage({
            type: 'updateConfig',
            workMinutes: config.get('workMinutes', 25),
            breakMinutes: config.get('breakMinutes', 5),
            longBreakMinutes: config.get('longBreakMinutes', 15),
            longBreakInterval: config.get('longBreakInterval', 4),
            autoStartNext: config.get('autoStartNext', false)
          });
          break;
        }
        default:
          console.log('FocusDev: unknown message', message);
      }
    }, undefined, context.subscriptions);
  });

  const openSettings = vscode.commands.registerCommand('focusDev.openSettings', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'focusDev');
  });

  const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('focusDev') && panel) {
      const config = vscode.workspace.getConfiguration('focusDev');
      panel.webview.postMessage({
        type: 'updateConfig',
        workMinutes: config.get('workMinutes', 25),
        breakMinutes: config.get('breakMinutes', 5),
        longBreakMinutes: config.get('longBreakMinutes', 15),
        longBreakInterval: config.get('longBreakInterval', 4),
        autoStartNext: config.get('autoStartNext', false)
      });
    }
  });

  context.subscriptions.push(openCmd, openSettings, configWatcher);
}

function deactivate() {}

/**
 * @param {vscode.Webview} webview
 * @param {vscode.ExtensionContext} context
 * @param {vscode.Uri} logoUri
 */
function getWebviewContent(webview, context, logoUri) {
  const config = vscode.workspace.getConfiguration('focusDev');
  const workMinutes = config.get('workMinutes', 25);
  const breakMinutes = config.get('breakMinutes', 5);
  const longBreakMinutes = config.get('longBreakMinutes', 15);
  const longBreakInterval = config.get('longBreakInterval', 4);
  const autoStartNext = config.get('autoStartNext', false);
  const totalSessions = context.globalState.get('focusDev.totalSessions', 0);

  const initialState = {
    workMinutes,
    breakMinutes,
    longBreakMinutes,
    longBreakInterval,
    autoStartNext,
    totalSessions
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FocusDev</title>
<style>
:root { --bg:#0f1724; --card:#071019; --accent:#ff6b6b; --muted:#9aa7b2; }
body {
  display:flex; justify-content:center; align-items:center;
  height:100vh; margin:0;
  background:linear-gradient(180deg,#0b1220,#041220);
  color:#e6eef6; font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial;
}
#pomodoro-box {
  width:300px; padding:30px 20px 40px 20px;
  background: rgba(255,255,255,0.02); border-radius:20px;
  text-align:center; box-shadow:0 6px 18px rgba(2,6,23,0.6);
}
#logo-box { border-radius:13px; padding:5px; margin-bottom:20px; }
#logo { max-width:100%; border-radius:20px; }
#stats-row { display:flex; justify-content:space-between; margin-bottom:20px; }
.stat { text-align:center; font-size:12px; color:var(--muted); }
.stat-label { font-size:14px; margin:0; }
.stat-value { font-size:12px; margin:0; }
#timer-section { margin-bottom:20px; color:#9aa7b2; }
#timer { font-size:35px; font-weight:700; letter-spacing:1px; color:#fff; margin:0; }
#timer-label { margin:0; font-size:16px; }
#button-row { display:flex; gap:8px; justify-content:space-around; }
#button-row button { padding:8px 20px; border:2px solid #000; border-radius:10px; cursor:pointer; font-size:14px; }
#start-btn { background:linear-gradient(90deg,var(--accent),#ff9a9a); color:#08121b; border:none; }
</style>
</head>
<body>
<div id="pomodoro-box">
  <div id="logo-box"><img id="logo" src="${logoUri}" alt="logo"></div>
  <div id="stats-row">
    <div class="stat" id="work-stat"><p class="stat-label">work</p><p class="stat-value">25 mins</p></div>
    <div class="stat" id="break-stat"><p class="stat-label">break</p><p class="stat-value">5 mins</p></div>
    <div class="stat" id="session-stat"><p class="stat-label">session</p><p class="stat-value" id="stat-value">4</p></div>
  </div>
  <div id="timer-section">
    <p id="timer">25:00</p>
    <p id="timer-label">Focus</p>
  </div>
  <div id="button-row">
    <button id="start-btn">Start</button>
    <button id="pause-btn">Reset</button>
  </div>
</div>
<script>
const vscode = acquireVsCodeApi();
const initialState = ${JSON.stringify(initialState)};

const timerEl = document.getElementById('timer');
const timerLabelEl = document.getElementById('timer-label');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('pause-btn');

let workSeconds = initialState.workMinutes*60;
let breakSeconds = initialState.breakMinutes*60;
let longBreakSeconds = initialState.longBreakMinutes*60;
let longInterval = initialState.longBreakInterval || 4;
let autoStartNext = !!initialState.autoStartNext;

let saved = JSON.parse(localStorage.getItem('focusDev.state') || 'null');
let state = saved || { mode:'work', remaining:workSeconds, running:false, completedWorkSessions:0 };

function formatTime(s){ const m=Math.floor(s/60); const sec=s%60; return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0'); }
function updateUI(){ timerEl.textContent=formatTime(state.remaining); timerLabelEl.textContent=state.mode==='work'?'Work':(state.mode==='break'?'Short break':'Long break'); }

let timerId=null;
function tick(){ state.remaining=Math.max(0,state.remaining-1); updateUI(); if(state.remaining===0) handleSessionComplete(); }

function startTimer() {
  if (state.running) return;
  state.running = true;
  timerId = setInterval(tick, 1000);
  saveState();
  startBtn.textContent = 'Pause';
}

function pauseTimer() {
  if (!state.running) return;
  state.running = false;
  clearInterval(timerId);
  timerId = null;
  saveState();
  startBtn.textContent = 'Start';
}
function resetTimer(){ pauseTimer(); state.remaining=state.mode==='work'?workSeconds:(state.mode==='break'?breakSeconds:longBreakSeconds); updateUI(); saveState(); }
function switchToMode(newMode){ state.mode=newMode; state.remaining=newMode==='work'?workSeconds:(newMode==='break'?breakSeconds:longBreakSeconds); updateUI(); }
function handleSessionComplete(){ vscode.postMessage({type:'sessionComplete', mode:state.mode}); if(state.mode==='work'){ state.completedWorkSessions=(state.completedWorkSessions||0)+1; if(state.completedWorkSessions%longInterval===0) switchToMode('longbreak'); else switchToMode('break'); } else switchToMode('work'); if(autoStartNext) startTimer(); else pauseTimer(); saveState(); }
function saveState(){ localStorage.setItem('focusDev.state',JSON.stringify(state)); }

startBtn.addEventListener('click', () => {
  if (state.running) {
    pauseTimer();
    startBtn.textContent = 'Start';
  } else {
    startTimer();
    startBtn.textContent = 'Pause';
  }
});
resetBtn.addEventListener('click', ()=>{ resetTimer(); });

updateUI();
if(state.running) startTimer();
vscode.postMessage({type:'requestConfig'});
window.addEventListener('message', event => { const msg=event.data; if(!msg) return; if(msg.type==='updateConfig'){ workSeconds=msg.workMinutes*60; breakSeconds=msg.breakMinutes*60; longBreakSeconds=msg.longBreakMinutes*60; longInterval=msg.longBreakInterval; autoStartNext=!!msg.autoStartNext; if(state.mode==='work') state.remaining=Math.min(state.remaining,workSeconds); if(state.mode==='break') state.remaining=Math.min(state.remaining,breakSeconds); if(state.mode==='longbreak') state.remaining=Math.min(state.remaining,longBreakSeconds); updateUI(); saveState(); } });
</script>
</body>
</html>`;
}

module.exports = { activate, deactivate };
