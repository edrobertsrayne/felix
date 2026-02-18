import blessed from 'blessed';
import { WebSocket } from 'ws';

export interface TUIConfig {
  gatewayUrl: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export class TUI {
  private screen: blessed.Widgets.Screen;
  private chatBox: blessed.Widgets.BoxElement;
  private inputBox: blessed.Widgets.TextboxElement;
  private statusLine: blessed.Widgets.BoxElement;
  private ws: WebSocket | null = null;
  private messages: ChatMessage[] = [];
  private sessionId: string = 'default';
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private config: TUIConfig) {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'My Agent',
    });

    this.statusLine = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: 'Connecting to gateway...',
      style: { bg: 'blue', fg: 'white' },
    });

    this.chatBox = blessed.box({
      top: 1,
      left: 0,
      width: '100%',
      height: '100%-3',
      scrollable: true,
      alwaysScroll: true,
      style: { fg: 'white' },
    });

    this.inputBox = blessed.textbox({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 2,
      style: { fg: 'green' },
    });

    this.screen.append(this.statusLine);
    this.screen.append(this.chatBox);
    this.screen.append(this.inputBox);

    this.inputBox.key('enter', () => {
      const content = this.inputBox.getValue().trim();
      if (content) {
        this.sendMessage(content);
        this.inputBox.clearValue();
      }
      this.screen.render();
    });

    this.inputBox.key('C-c', () => {
      this.disconnect();
      process.exit(0);
    });

    this.screen.key('q', () => {
      this.disconnect();
      process.exit(0);
    });

    this.screen.key(['escape', 'C-c'], () => {
      this.disconnect();
      process.exit(0);
    });

    this.inputBox.focus();
  }

  connect(): void {
    this.ws = new WebSocket(this.config.gatewayUrl);

    this.ws.on('open', () => {
      this.updateStatus('Connected', 'green');
      this.loadHistory();
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    });

    this.ws.on('close', () => {
      this.updateStatus('Disconnected', 'red');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      this.updateStatus('Error: ' + err.message, 'red');
    });
  }

  private handleMessage(msg: any): void {
    if (msg.type === 'response') {
      this.messages.push({
        role: 'assistant',
        content: msg.content,
        timestamp: msg.timestamp,
      });
    } else if (msg.type === 'error') {
      this.messages.push({
        role: 'system',
        content: 'Error: ' + msg.content,
        timestamp: msg.timestamp,
      });
    } else if (msg.type === 'history') {
      try {
        const history = JSON.parse(msg.content);
        this.messages = history;
      } catch {}
    }

    this.render();
  }

  private sendMessage(content: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messages.push({
        role: 'system',
        content: 'Not connected to gateway',
        timestamp: Date.now(),
      });
      this.render();
      return;
    }

    this.messages.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    });

    this.ws.send(JSON.stringify({
      type: 'message',
      content,
      sessionId: this.sessionId,
    }));

    this.render();
  }

  private loadHistory(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'history',
        sessionId: this.sessionId,
      }));
    }
  }

  private updateStatus(text: string, color: string): void {
    this.statusLine.setContent(text);
    this.statusLine.style.bg = color;
    this.statusLine.style.fg = 'white';
    this.screen.render();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  private disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private render(): void {
    let content = '';
    for (const msg of this.messages) {
      const prefix = msg.role === 'user' ? '> ' : msg.role === 'assistant' ? '< ' : '! ';
      const lines = msg.content.split('\n');
      for (const line of lines) {
        content += prefix + line + '\n';
      }
      content += '\n';
    }
    this.chatBox.setContent(content || 'No messages yet. Type something to start.');
    this.screen.render();
  }

  start(): void {
    this.connect();
    this.screen.render();
  }
}
