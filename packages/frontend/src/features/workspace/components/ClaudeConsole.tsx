/**
 * ClaudeConsole — Bottom panel with terminal emulator.
 * Uses a simple pre/textarea for MVP (xterm.js can be added later).
 * Connects via useTerminalSocket for I/O.
 * Supports multi-tab sessions.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useTerminalSocket, type TerminalOutputEvent } from '../hooks/useTerminalSocket';

interface TerminalTab {
  id: string;
  label: string;
  output: string;
}

export function ClaudeConsole() {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'tab-1', label: 'Terminal 1', output: '' },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  const handleOutput = useCallback((event: TerminalOutputEvent) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, output: tab.output + event.data }
          : tab,
      ),
    );
  }, [activeTabId]);

  const handleError = useCallback((event: { message: string }) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, output: tab.output + `\n[ERROR] ${event.message}\n` }
          : tab,
      ),
    );
  }, [activeTabId]);

  const terminal = useTerminalSocket({
    enabled: isConnected,
    onOutput: handleOutput,
    onError: handleError,
  });

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [tabs, activeTabId]);

  const handleConnect = useCallback(() => {
    setIsConnected(true);
    // Small delay to let socket connect, then open session
    setTimeout(() => terminal.open({ cols: 80, rows: 24 }), 500);
  }, [terminal]);

  const handleDisconnect = useCallback(() => {
    terminal.close();
    setIsConnected(false);
  }, [terminal]);

  const handleSendInput = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && inputValue.trim()) {
        terminal.sendInput(inputValue + '\n');
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTabId
              ? { ...tab, output: tab.output + `$ ${inputValue}\n` }
              : tab,
          ),
        );
        setInputValue('');
      }
    },
    [inputValue, terminal, activeTabId],
  );

  const handleAddTab = useCallback(() => {
    const newId = `tab-${Date.now()}`;
    setTabs((prev) => [...prev, { id: newId, label: `Terminal ${prev.length + 1}`, output: '' }]);
    setActiveTabId(newId);
  }, []);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const filtered = prev.filter((t) => t.id !== tabId);
        if (filtered.length === 0) {
          return [{ id: 'tab-1', label: 'Terminal 1', output: '' }];
        }
        return filtered;
      });
      if (activeTabId === tabId) {
        setActiveTabId(tabs[0]?.id ?? 'tab-1');
      }
    },
    [activeTabId, tabs],
  );

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  return (
    <div className="flex flex-col h-64 bg-[#1a1a1a] border-t border-border-default">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border-subtle bg-bg-elevated px-2">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-b-2 -mb-px transition-colors',
              activeTabId === tab.id
                ? 'text-text-primary border-accent-primary'
                : 'text-text-secondary border-transparent hover:text-text-primary',
            )}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span>{tab.label}</span>
            {tabs.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
                className="text-text-disabled hover:text-text-primary ml-1"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddTab}
          className="px-2 py-2 text-xs text-text-secondary hover:text-text-primary"
          aria-label="New terminal tab"
        >
          +
        </button>

        {/* Connection controls */}
        <div className="ml-auto flex items-center gap-2 pr-2">
          <Badge variant={terminal.connected ? 'success' : 'neutral'}>
            {terminal.connected ? 'Connected' : 'Disconnected'}
          </Badge>
          {!isConnected ? (
            <Button size="sm" variant="ghost" onClick={handleConnect}>
              Connect
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={handleDisconnect}>
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {/* Terminal output */}
      <pre
        ref={outputRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs text-green-400 leading-relaxed whitespace-pre-wrap"
      >
        {activeTab?.output || (
          <span className="text-text-disabled">
            {isConnected ? 'Connecting...' : 'Click "Connect" to start a terminal session.'}
          </span>
        )}
      </pre>

      {/* Input line */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border-subtle">
        <span className="text-xs text-green-400 font-mono">$</span>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleSendInput}
          disabled={!terminal.connected}
          placeholder={terminal.connected ? 'Type a command...' : 'Not connected'}
          className="flex-1 bg-transparent text-xs font-mono text-text-primary placeholder:text-text-disabled focus:outline-none"
          aria-label="Terminal input"
        />
      </div>

      {/* Error display */}
      {terminal.error && (
        <div className="px-3 py-1.5 bg-[rgba(239,68,68,0.1)] text-xs text-status-danger">
          {terminal.error}
        </div>
      )}
    </div>
  );
}
