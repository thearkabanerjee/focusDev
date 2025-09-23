// @ts-check

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

    panel.webview.html = getWebviewContent(panel.webview, context);

    // When the panel is disposed, clear reference
    panel.onDidDispose(() => {
      panel = undefined;
    }, null, context.subscriptions);

    // Listen for messages from the webview
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
          // webview requested updated config (e.g., if user changes settings)
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

  // Watch for settings changes and notify webviews (if present)
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
 * Produce the HTML for the Webview (inline SVG/CSS/JS) and inject initial config.
 * @param {vscode.Webview} webview
 * @param {vscode.ExtensionContext} context
 */
function getWebviewContent(webview, context) {
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

  // HTML with inline CSS, SVG (cute animated face + progress ring), and JS logic.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FocusDev</title>
  <style>
    :root{
      --bg:#0f1724;
      --card:#071019;
      --accent:#ff6b6b;
      --muted:#9aa7b2;
    }
    html,body{ height:100%; margin:0; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial; background: linear-gradient(180deg,#0b1220,#041220); color:#e6eef6; }
    .wrap{ padding:16px; display:flex; flex-direction:column; gap:12px; height:100%; box-sizing:border-box; }
    .card{ background: rgba(255,255,255,0.02); border-radius:12px; padding:12px; display:flex; gap:12px; align-items:center; box-shadow: 0 6px 18px rgba(2,6,23,0.6); }
    .left{ display:flex; flex-direction:column; gap:8px; align-items:center; justify-content:center; width:180px; }
    .timer{ font-size:28px; font-weight:700; letter-spacing:1px; }
    .mode{ font-size:12px; color:var(--muted); }
    .controls{ display:flex; gap:8px; margin-top:6px; }
    .btn{ background:transparent; border:1px solid rgba(255,255,255,0.06); color:inherit; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:13px; }
    .btn.primary{ background: linear-gradient(90deg,var(--accent),#ff9a9a); color:#08121b; border:none; }
    .right{ flex:1; display:flex; flex-direction:column; gap:6px; }
    .svgwrap{ display:flex; align-items:center; justify-content:center; width:120px; height:120px; margin:auto; }
    .cute { animation: bob 2.2s ease-in-out infinite; }
    @keyframes bob { 0%{transform:translateY(0)} 50%{transform:translateY(-8px)} 100%{transform:translateY(0)} }
    .small{ font-size:12px; color:var(--muted); }
    .footer{ display:flex; gap:8px; align-items:center; justify-content:space-between; }
    .session-count{ font-weight:600; }
    @media (max-width:480px){ .wrap{ padding:10px } .left{ width:140px } }
  </style>
</head>
<body>
   <div style="display:flex; justify-content:center; margin-bottom:12px;">
    <button class="btn primary" id="top-start" style="font-size:16px; padding:8px 16px;">Start FocusDev</button>
  </div>
  <div class="wrap">
    <div class="card">
      <div class="left">
        <div class="svgwrap">
          <svg class="progress-ring cute" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g" x1="0" x2="1">
                <stop offset="0%" stop-color="#ff9a9a"/>
                <stop offset="100%" stop-color="#ff6b6b"/>
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="48" stroke="#07121a" stroke-width="6" fill="#04121a" />
            <circle id="progress" cx="60" cy="60" r="48" stroke="url(#g)" stroke-width="6" stroke-linecap="round" fill="none" transform="rotate(-90 60 60)" stroke-dasharray="302" stroke-dashoffset="302" />
            <g transform="translate(0,6)">
              <ellipse cx="46" cy="60" rx="6" ry="4" fill="#fff" opacity="0.95" />
              <ellipse cx="74" cy="60" rx="6" ry="4" fill="#fff" opacity="0.95" />
              <circle cx="46" cy="60" r="1.6" fill="#07121a" />
              <circle cx="74" cy="60" r="1.6" fill="#07121a" />
            </g>
            <path d="M48 74 Q60 82 72 74" stroke="#ffd6d6" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M30 40 C36 18 50 30 48 46" stroke="#9fe6b2" stroke-width="3" fill="none" stroke-linecap="round" />
            <path d="M90 40 C84 18 70 30 72 46" stroke="#9fe6b2" stroke-width="3" fill="none" stroke-linecap="round" />
          </svg>
        </div>
        <div class="timer" id="time">25:00</div>
        <div class="mode" id="mode">Work</div>
        <div class="controls">
          <button class="btn primary" id="start">Start</button>
          <button class="btn" id="pause">Pause</button>
          <button class="btn" id="reset">Reset</button>
        </div>
      </div>

      <div class="right">
        <div style="display:flex; justify-content:space-between; align-items:center">
          <div><div class="small">Work</div><div class="small session-info" id="work-duration">25 min</div></div>
          <div><div class="small">Break</div><div class="small session-info" id="break-duration">5 min</div></div>
          <div><div class="small">Long break</div><div class="small session-info" id="long-duration">15 min</div></div>
          <div><div class="small">Sessions</div><div class="small session-info" id="long-interval">4</div></div>
        </div>

        <div style="margin-top:12px">
          <div class="small">Controls</div>
          <div style="display:flex; gap:8px; margin-top:8px">
            <button class="btn" id="skip">Skip</button>
            <button class="btn" id="open-settings">Settings</button>
          </div>
        </div>

        <div style="flex:1; display:flex; align-items:flex-end">
          <div class="footer" style="width:100%">
            <div class="small">Sessions completed</div>
            <div class="session-count" id="session-count">0</div>
          </div>
        </div>

      </div>
    </div>

    <div style="color:var(--muted); font-size:12px">Tip: Edit FocusDev durations in Settings (search for \"FocusDev\").</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const initialState = ${JSON.stringify(initialState)};
  	// const topStartBtn = document.getElementById('top-start');



	// // When clicked, start the timer
	// topStartBtn.addEventListener('click', () => {
	// 	startTimer();
	// });

    // UI refs
    const timeEl = document.getElementById('time');
    const modeEl = document.getElementById('mode');
    const startBtn = document.getElementById('start');
    const pauseBtn = document.getElementById('pause');
    const resetBtn = document.getElementById('reset');
    const skipBtn = document.getElementById('skip');
    const openSettingsBtn = document.getElementById('open-settings');
    const sessionCountEl = document.getElementById('session-count');
    const progressEl = document.getElementById('progress');

    // durations in seconds from config
    let workSeconds = initialState.workMinutes * 60;
    let breakSeconds = initialState.breakMinutes * 60;
    let longBreakSeconds = initialState.longBreakMinutes * 60;
    let longInterval = initialState.longBreakInterval || 4;
    let autoStartNext = !!initialState.autoStartNext;

    // restore saved state
    const saved = JSON.parse(localStorage.getItem('focusDev.state') || 'null');
    let state = saved || {
      mode: 'work', // 'work' | 'break' | 'longbreak'
      remaining: workSeconds,
      running: false,
      completedWorkSessions: 0
    };

    // display global stored sessions as baseline
    sessionCountEl.textContent = initialState.totalSessions || 0;

    function formatTime(s){
      const m = Math.floor(s/60);
      const sec = s % 60;
      return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
    }

    function updateUI(){
      timeEl.textContent = formatTime(state.remaining);
      modeEl.textContent = state.mode === 'work' ? 'Work' : (state.mode === 'break' ? 'Short break' : 'Long break');
      document.getElementById('work-duration').textContent = Math.round(workSeconds/60) + ' min';
      document.getElementById('break-duration').textContent = Math.round(breakSeconds/60) + ' min';
      document.getElementById('long-duration').textContent = Math.round(longBreakSeconds/60) + ' min';
      document.getElementById('long-interval').textContent = longInterval;

      // progress ring math
      const radius = 48;
      const circumference = 2 * Math.PI * radius;
      const total = state.mode === 'work' ? workSeconds : (state.mode === 'break' ? breakSeconds : longBreakSeconds);
      const fraction = (total - state.remaining) / total;
      const dash = Math.max(0, circumference * (1 - fraction));
      progressEl.style.strokeDasharray = String(circumference);
      progressEl.style.strokeDashoffset = String(dash);
    }

    function beep(duration = 300, frequency = 880, volume = 0.08){
      try{
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = frequency;
        g.gain.value = volume;
        o.start();
        setTimeout(()=>{ o.stop(); ctx.close(); }, duration);
      }catch(e){
        console.warn('Audio failed:', e);
      }
    }

    let lastTick = null;
    let timerId = null;

    function tick(){
      const now = Date.now();
      if (!lastTick) lastTick = now;
      const elapsed = Math.floor((now - lastTick) / 1000);
      if (elapsed >= 1){
        state.remaining = Math.max(0, state.remaining - elapsed);
        lastTick = now;
        updateUI();

        if (state.remaining === 0){
          handleSessionComplete();
        }
      }
    }

    function startTimer(){
      if (state.running) return;
      state.running = true;
      lastTick = Date.now();
      timerId = setInterval(tick, 1000);
      saveState();
    }

    function pauseTimer(){
      if (!state.running) return;
      state.running = false;
      clearInterval(timerId);
      timerId = null;
      lastTick = null;
      saveState();
    }

    function resetTimer(){
      pauseTimer();
      if (state.mode === 'work') state.remaining = workSeconds;
      else if (state.mode === 'break') state.remaining = breakSeconds;
      else state.remaining = longBreakSeconds;
      updateUI();
      saveState();
    }

    function switchToMode(newMode){
      state.mode = newMode;
      if (newMode === 'work') state.remaining = workSeconds;
      else if (newMode === 'break') state.remaining = breakSeconds;
      else state.remaining = longBreakSeconds;
      updateUI();
    }

    function handleSessionComplete(){
      beep();
      // notify extension host so it can persist a global counter and show a notification
      vscode.postMessage({ type: 'sessionComplete', mode: state.mode, timestamp: Date.now() });

      if (state.mode === 'work'){
        state.completedWorkSessions = (state.completedWorkSessions || 0) + 1;
        if (state.completedWorkSessions % longInterval === 0){
          switchToMode('longbreak');
        } else {
          switchToMode('break');
        }
      } else {
        switchToMode('work');
      }

      updateUI();
      saveState();

      if (autoStartNext){
        startTimer();
      } else {
        pauseTimer();
      }
    }

    function saveState(){
      localStorage.setItem('focusDev.state', JSON.stringify(state));
    }

    // UI wiring
    startBtn.addEventListener('click', ()=>{ startTimer(); });
    pauseBtn.addEventListener('click', ()=>{ pauseTimer(); });
    resetBtn.addEventListener('click', ()=>{ resetTimer(); });
    skipBtn.addEventListener('click', ()=>{ handleSessionComplete(); });
    openSettingsBtn.addEventListener('click', ()=>{ vscode.postMessage({ type: 'openSettings' }); });

    updateUI();
    if (state.running) startTimer();

    // ask host for config updates on demand
    vscode.postMessage({ type: 'requestConfig' });

    // Handle messages FROM the host
    window.addEventListener('message', event => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'updateConfig'){
        workSeconds = msg.workMinutes * 60;
        breakSeconds = msg.breakMinutes * 60;
        longBreakSeconds = msg.longBreakMinutes * 60;
        longInterval = msg.longBreakInterval;
        autoStartNext = !!msg.autoStartNext;

        if (state.mode === 'work') state.remaining = Math.min(state.remaining, workSeconds);
        if (state.mode === 'break') state.remaining = Math.min(state.remaining, breakSeconds);
        if (state.mode === 'longbreak') state.remaining = Math.min(state.remaining, longBreakSeconds);

        updateUI();
        saveState();
      }
    });
  </script>
</body>
</html>`;
}

module.exports = {
  activate,
  deactivate
};
