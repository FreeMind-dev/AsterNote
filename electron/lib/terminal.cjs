const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

function resolveScriptBinary() {
  const candidates = ['/usr/bin/script', '/bin/script'];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function resolveShellLaunch() {
  const shellPath = process.env.SHELL || '/bin/bash';
  const scriptBinary = resolveScriptBinary();

  if (process.platform === 'win32') {
    const command = process.env.COMSPEC || 'powershell.exe';
    const args = /cmd\.exe$/i.test(command) ? [] : ['-NoLogo'];
    return {
      command,
      args,
      shellLabel: path.basename(command),
    };
  }

  if (scriptBinary) {
    return {
      command: scriptBinary,
      args: ['-qfec', `${shellPath} --login`, '/dev/null'],
      shellLabel: path.basename(shellPath),
    };
  }

  return {
    command: shellPath,
    args: ['--login'],
    shellLabel: path.basename(shellPath),
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

class TerminalManager {
  constructor({ sendData, sendExit }) {
    this.sendData = sendData;
    this.sendExit = sendExit;
    this.sessions = new Map();
  }

  async start(payload = {}) {
    const cwd = resolveCwd(payload);
    const launch = resolveShellLaunch();
    const sessionId = crypto.randomUUID();

    const child = spawn(launch.command, launch.args, {
      cwd,
      env: {
        ...process.env,
        TERM: process.env.TERM || 'xterm-256color',
        COLORTERM: process.env.COLORTERM || 'truecolor',
      },
      stdio: 'pipe',
    });

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

    this.sessions.set(sessionId, { child, cwd, shell: launch.shellLabel });

    return {
      sessionId,
      cwd,
      shell: launch.shellLabel,
    };
  }

  async write(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session || session.child.killed) return;
    session.child.stdin.write(String(data || ''));
  }

  async resize(_sessionId, _cols, _rows) {
    return;
  }

  async stop(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
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
