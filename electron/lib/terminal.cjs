const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

let nodePty = null;
try {
  nodePty = require('@homebridge/node-pty-prebuilt-multiarch');
} catch (_error) {
  try {
    nodePty = require('node-pty');
  } catch (_innerError) {
    nodePty = null;
  }
}

function resolveScriptBinary() {
  const candidates = ['/usr/bin/script', '/bin/script'];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function resolveWindowsShellBinary() {
  const preferredShell =
    typeof process.env.ASTERNOTE_SHELL === 'string' && process.env.ASTERNOTE_SHELL.trim()
      ? process.env.ASTERNOTE_SHELL.trim()
      : null;
  if (preferredShell) {
    return preferredShell;
  }

  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const powershellPath = path.join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );

  if (fs.existsSync(powershellPath)) {
    return powershellPath;
  }

  return process.env.COMSPEC || 'cmd.exe';
}

function resolveShellLaunch() {
  const shellPath = process.env.SHELL || '/bin/bash';
  const scriptBinary = resolveScriptBinary();

  if (process.platform === 'win32') {
    const command = resolveWindowsShellBinary();
    const isCmd = /cmd(?:\.exe)?$/i.test(command);
    const isPowerShell = /(powershell|pwsh)(?:\.exe)?$/i.test(command);
    const args = isCmd
      ? ['/K', 'chcp 65001>nul']
      : isPowerShell
        ? [
            '-NoLogo',
            '-NoExit',
            '-Command',
            [
              '[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)',
              '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
              '$OutputEncoding = [Console]::OutputEncoding',
              'try { chcp 65001 > $null } catch {}',
            ].join('; '),
          ]
        : [];
    return {
      command,
      args,
      shellLabel: path.basename(command),
      usePty: Boolean(nodePty),
    };
  }

  if (scriptBinary) {
    return {
      command: scriptBinary,
      args: ['-qfec', `${shellPath} --login`, '/dev/null'],
      shellLabel: path.basename(shellPath),
      usePty: false,
    };
  }

  return {
    command: shellPath,
    args: ['--login'],
    shellLabel: path.basename(shellPath),
    usePty: false,
  };
}

function resolveCwd(payload = {}) {
  const documentPath =
    typeof payload.documentPath === 'string' && payload.documentPath.trim()
      ? payload.documentPath.trim()
      : null;
  const directCwd =
    typeof payload.cwd === 'string' && payload.cwd.trim() ? payload.cwd.trim() : null;

  const candidates = [
    documentPath ? path.dirname(documentPath) : null,
    directCwd,
    os.homedir(),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch (_error) {
      continue;
    }
  }

  return os.homedir();
}

function resolveTerminalEnv() {
  return {
    ...process.env,
    TERM: process.env.TERM || 'xterm-256color',
    COLORTERM: process.env.COLORTERM || 'truecolor',
    LANG: process.env.LANG || 'en_US.UTF-8',
    PYTHONUTF8: process.platform === 'win32' ? '1' : process.env.PYTHONUTF8,
  };
}

function clampDimension(value, fallback, minimum, maximum) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
}

class TerminalManager {
  constructor({ sendData, sendExit }) {
    this.sendData = sendData;
    this.sendExit = sendExit;
    this.sessions = new Map();
  }

  async startPtySession({ sessionId, cwd, launch, cols, rows }) {
    const pty = nodePty.spawn(launch.command, launch.args, {
      name: process.env.TERM || 'xterm-256color',
      cols,
      rows,
      cwd,
      env: resolveTerminalEnv(),
      encoding: 'utf8',
    });

    pty.onData((data) => {
      this.sendData({ sessionId, data });
    });

    pty.onExit(({ exitCode, signal }) => {
      this.sessions.delete(sessionId);
      this.sendExit({
        sessionId,
        exitCode: typeof exitCode === 'number' ? exitCode : 0,
        signal: signal == null ? null : String(signal),
      });
    });

    this.sessions.set(sessionId, { kind: 'pty', pty, cwd, shell: launch.shellLabel });
    return {
      sessionId,
      cwd,
      shell: launch.shellLabel,
    };
  }

  async start(payload = {}) {
    const cwd = resolveCwd(payload);
    const launch = resolveShellLaunch();
    const sessionId = crypto.randomUUID();
    const cols = clampDimension(Number(payload.cols), 120, 40, 400);
    const rows = clampDimension(Number(payload.rows), 32, 12, 240);

    if (launch.usePty && nodePty) {
      return this.startPtySession({ sessionId, cwd, launch, cols, rows });
    }

    const child = spawn(launch.command, launch.args, {
      cwd,
      env: resolveTerminalEnv(),
      stdio: 'pipe',
    });

    child.stdin.setDefaultEncoding('utf8');

    child.stdout.on('data', (data) => {
      this.sendData({ sessionId, data: data.toString('utf8') });
    });

    child.stderr.on('data', (data) => {
      this.sendData({ sessionId, data: data.toString('utf8') });
    });

    child.on('close', (exitCode, signal) => {
      this.sessions.delete(sessionId);
      this.sendExit({
        sessionId,
        exitCode: typeof exitCode === 'number' ? exitCode : 0,
        signal: signal || null,
      });
    });

    child.on('error', (error) => {
      this.sendData({
        sessionId,
        data: `\r\n[AsterNote terminal error] ${error.message}\r\n`,
      });
    });

    this.sessions.set(sessionId, { kind: 'child', child, cwd, shell: launch.shellLabel });

    return {
      sessionId,
      cwd,
      shell: launch.shellLabel,
    };
  }

  async write(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.kind === 'pty') {
      session.pty.write(String(data || ''));
      return;
    }

    if (session.child.killed) return;
    session.child.stdin.write(String(data || ''));
  }

  async resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (!session || session.kind !== 'pty') {
      return;
    }

    session.pty.resize(
      clampDimension(Number(cols), 120, 40, 400),
      clampDimension(Number(rows), 32, 12, 240)
    );
  }

  async stop(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.kind === 'pty') {
      session.pty.kill();
      this.sessions.delete(sessionId);
      return;
    }

    session.child.kill();
    this.sessions.delete(sessionId);
  }

  async stopAll() {
    const ids = Array.from(this.sessions.keys());
    await Promise.all(ids.map((id) => this.stop(id)));
  }
}

module.exports = {
  TerminalManager,
};
