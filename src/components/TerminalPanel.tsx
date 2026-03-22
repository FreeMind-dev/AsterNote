import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useMemo, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';

import type { QuietMarkAPI, TerminalSessionInfo } from '../electron';
import { getDocumentUiLanguage, getUiText } from '../lib/uiText';
import { RotateCcw, X } from './icons';

interface TerminalPanelProps {
  visible: boolean;
  api: QuietMarkAPI;
  documentPath: string | null;
  onClose: () => void;
}

function resolveTerminalTypography() {
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;

  if (/Windows/i.test(userAgent)) {
    return {
      fontFamily:
        '"Cascadia Mono", "Cascadia Code", Consolas, "Lucida Console", "Sarasa Mono SC", "Noto Sans Mono CJK SC", "NSimSun", monospace',
      fontSize: 14,
      letterSpacing: 0,
      lineHeight: 1.3,
      fontWeight: 400,
      fontWeightBold: 700,
      theme: {
        background: '#0c0c0c',
        foreground: '#f3f3f3',
        cursor: '#f3f3f3',
        selectionBackground: 'rgba(255, 255, 255, 0.2)',
        black: '#0c0c0c',
        red: '#c50f1f',
        green: '#13a10e',
        yellow: '#c19c00',
        blue: '#0037da',
        magenta: '#881798',
        cyan: '#3a96dd',
        white: '#cccccc',
        brightBlack: '#767676',
        brightRed: '#e74856',
        brightGreen: '#16c60c',
        brightYellow: '#f9f1a5',
        brightBlue: '#3b78ff',
        brightMagenta: '#b4009e',
        brightCyan: '#61d6d6',
        brightWhite: '#f2f2f2',
      },
    };
  }

  if (/Macintosh|Mac OS X/i.test(userAgent)) {
    return {
      fontFamily:
        '"SFMono-Regular", Menlo, Monaco, "Sarasa Mono SC", "PingFang SC", monospace',
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 1.35,
      fontWeight: 400,
      fontWeightBold: 700,
      theme: {
        background: '#0f1720',
        foreground: '#e9edf2',
        cursor: '#f5c97a',
        selectionBackground: 'rgba(245, 201, 122, 0.18)',
        black: '#0b1117',
        red: '#d2856e',
        green: '#8ab57c',
        yellow: '#f5c97a',
        blue: '#71b7d6',
        magenta: '#cb9af2',
        cyan: '#7ad6cf',
        white: '#d8dee7',
        brightBlack: '#5f7180',
        brightRed: '#f1a28d',
        brightGreen: '#9bd08c',
        brightYellow: '#f9d98f',
        brightBlue: '#84c8e5',
        brightMagenta: '#d9adfa',
        brightCyan: '#8de5dc',
        brightWhite: '#f6f8fb',
      },
    };
  }

  return {
    fontFamily:
      '"JetBrains Mono", "Noto Sans Mono", "Noto Sans Mono CJK SC", "Sarasa Mono SC", "Liberation Mono", monospace',
    fontSize: 13,
    letterSpacing: 0,
    lineHeight: 1.35,
    fontWeight: 400,
    fontWeightBold: 700,
    theme: {
      background: '#0f1720',
      foreground: '#e9edf2',
      cursor: '#f5c97a',
      selectionBackground: 'rgba(245, 201, 122, 0.18)',
      black: '#0b1117',
      red: '#d2856e',
      green: '#8ab57c',
      yellow: '#f5c97a',
      blue: '#71b7d6',
      magenta: '#cb9af2',
      cyan: '#7ad6cf',
      white: '#d8dee7',
      brightBlack: '#5f7180',
      brightRed: '#f1a28d',
      brightGreen: '#9bd08c',
      brightYellow: '#f9d98f',
      brightBlue: '#84c8e5',
      brightMagenta: '#d9adfa',
      brightCyan: '#8de5dc',
      brightWhite: '#f6f8fb',
    },
  };
}

export function TerminalPanel({ visible, api, documentPath, onClose }: TerminalPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [session, setSession] = useState<TerminalSessionInfo | null>(null);
  const ui = getUiText(getDocumentUiLanguage());
  const terminalTypography = useMemo(() => resolveTerminalTypography(), []);

  useEffect(() => {
    if (!visible || !hostRef.current || terminalRef.current) {
      return;
    }

    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: terminalTypography.fontFamily,
      fontSize: terminalTypography.fontSize,
      letterSpacing: terminalTypography.letterSpacing,
      lineHeight: terminalTypography.lineHeight,
      fontWeight: terminalTypography.fontWeight,
      fontWeightBold: terminalTypography.fontWeightBold,
      scrollback: 4000,
      theme: terminalTypography.theme,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(hostRef.current);
    fitAddon.fit();
    terminal.focus();

    const inputDisposable = terminal.onData((data) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      void api.terminal.write(sessionId, data);
    });

    const handleWindowResize = () => {
      fitAddon.fit();
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      void api.terminal.resize(sessionId, terminal.cols, terminal.rows);
    };

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      inputDisposable.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [
    api,
    onClose,
    terminalTypography.fontFamily,
    terminalTypography.fontSize,
    terminalTypography.letterSpacing,
    terminalTypography.lineHeight,
    terminalTypography.fontWeight,
    terminalTypography.fontWeightBold,
    terminalTypography.theme,
    ui.terminal,
    visible,
  ]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const unsubscribeData = api.terminal.onData(({ sessionId, data }) => {
      if (sessionId !== sessionIdRef.current) return;
      terminalRef.current?.write(data);
    });

    const unsubscribeExit = api.terminal.onExit(({ sessionId, exitCode, signal }) => {
      if (sessionId !== sessionIdRef.current) return;
      terminalRef.current?.writeln(`\r\n${ui.terminal.exitedWithCode(exitCode, signal)}\r\n`);
      sessionIdRef.current = null;
      setSession(null);
      window.setTimeout(() => {
        onClose();
      }, 120);
    });

    return () => {
      unsubscribeData();
      unsubscribeExit();
    };
  }, [api, onClose, ui.terminal, visible]);

  useEffect(() => {
    if (!visible || !terminalRef.current) {
      return;
    }

    let cancelled = false;

    const restartSession = async () => {
      const terminal = terminalRef.current;
      if (!terminal) return;

      if (sessionIdRef.current) {
        await api.terminal.stop(sessionIdRef.current);
        sessionIdRef.current = null;
      }

      terminal.clear();
      terminal.writeln(`\x1b[2m${ui.terminal.launchingShell}\x1b[0m`);

      const nextSession = await api.terminal.start({
        documentPath,
        cols: terminal.cols,
        rows: terminal.rows,
      });

      if (cancelled) {
        await api.terminal.stop(nextSession.sessionId);
        return;
      }

      sessionIdRef.current = nextSession.sessionId;
      setSession(nextSession);
      fitAddonRef.current?.fit();
      void api.terminal.resize(nextSession.sessionId, terminal.cols, terminal.rows);
    };

    void restartSession();

    return () => {
      cancelled = true;
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      setSession(null);
      if (sessionId) {
        void api.terminal.stop(sessionId);
      }
    };
  }, [api, documentPath, ui.terminal, visible]);

  if (!visible) {
    return null;
  }

  return (
    <section className="qm-terminal-panel">
      <div className="qm-terminal-header">
        <div className="qm-terminal-title">
          <span>{session?.cwd || ui.terminal.preparingShell}</span>
        </div>

        <div className="qm-terminal-actions">
          <button
            type="button"
            className="qm-terminal-action"
            onClick={() => {
              const currentPath = documentPath;
              const terminal = terminalRef.current;
              if (!terminal) return;
              terminal.reset();
              void api.terminal.stop(sessionIdRef.current || '');
              sessionIdRef.current = null;
              setSession(null);
              void api.terminal
                .start({
                  documentPath: currentPath,
                  cols: terminal.cols,
                  rows: terminal.rows,
                })
                .then((nextSession) => {
                  sessionIdRef.current = nextSession.sessionId;
                  setSession(nextSession);
                });
            }}
            title={ui.terminal.restartTerminal}
            aria-label={ui.terminal.restartTerminal}
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            className="qm-terminal-action"
            onClick={onClose}
            title={ui.terminal.closeTerminal}
            aria-label={ui.terminal.closeTerminal}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div ref={hostRef} className="qm-terminal-host" />
    </section>
  );
}
