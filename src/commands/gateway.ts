import WebSocket from "ws";
import {
  startDaemon,
  stopDaemon,
  isGatewayRunning,
  readPidFile,
  isProcessRunning,
} from "../daemon.js";
import { loadConfig } from "../config.js";
import { type GatewayStatus } from "../gateway.js";

interface GatewayStartOptions {
  telegram?: boolean;
}

export async function startGateway(
  options: GatewayStartOptions,
): Promise<void> {
  // TODO: Pass options to gateway-service via env vars or CLI args
  void options;

  if (isGatewayRunning()) {
    console.log("Gateway is already running");
    return;
  }

  const result = await startDaemon();
  if (!result) {
    console.error("Failed to start gateway");
    process.exit(1);
  }
}

export async function stopGateway(): Promise<void> {
  const result = await stopDaemon();
  if (!result) {
    console.error("Failed to stop gateway");
    process.exit(1);
  }
}

export async function statusGateway(): Promise<void> {
  const pid = readPidFile();
  const config = loadConfig();
  const port = config.gateway.port;

  if (!pid) {
    printStatusHeader(false);
    console.log(`  ${red("✗")}  Gateway is not running`);
    return;
  }

  const running = isProcessRunning(pid);

  if (!running) {
    printStatusHeader(false);
    console.log(`  ${red("✗")}  Gateway not running (stale PID: ${pid})`);
    console.log(`  ${yellow("⚠")}  Run 'felix gateway start' to start`);
    return;
  }

  try {
    const status = await fetchGatewayStatus(port);
    printStatusHeader(true);
    printProcessSection(pid, status.uptime);
    printConnectionSection(port, status.clientCount);
    printSessionsSection(status.sessionCount);
    printConfigSection(status);
  } catch {
    printStatusHeader(true);
    console.log(`  ${green("✓")}  Gateway process running (PID: ${pid})`);
    console.log(`  ${red("✗")}  Cannot connect to gateway`);
    console.log(
      `  ${dim("    Port may be unavailable or gateway starting up")}`,
    );
  }
}

async function fetchGatewayStatus(port: number): Promise<GatewayStatus> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Connection timeout"));
    }, 3000);

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "status" }));
    });

    ws.on("message", (data) => {
      clearTimeout(timeout);
      const msg = JSON.parse(data.toString());
      if (msg.type === "status" && msg.statusData) {
        resolve(msg.statusData);
      } else {
        reject(new Error("Invalid status response"));
      }
      ws.close();
    });

    ws.on("error", () => {
      clearTimeout(timeout);
      reject(new Error("Connection failed"));
    });
  });
}

function printStatusHeader(isRunning: boolean): void {
  console.log("");
  console.log(
    isRunning
      ? `${green("◉")} ${bold("Gateway Status")}`
      : `${red("○")} ${bold("Gateway Status")}`,
  );
  console.log(dim("─".repeat(40)));
}

function printProcessSection(pid: number, uptime: number): void {
  console.log(`\n  ${cyan("⬡")}  ${bold("Process")}`);
  console.log(`      PID:        ${pid}`);
  console.log(`      Uptime:     ${formatUptime(uptime)}`);
}

function printConnectionSection(port: number, clientCount: number): void {
  console.log(`\n  ${blue("◈")}  ${bold("Connections")}`);
  console.log(`      Port:       ${port}`);
  console.log(`      Clients:    ${clientCount}`);
}

function printSessionsSection(sessionCount: number): void {
  console.log(`\n  ${magenta("▸")}  ${bold("Sessions")}`);
  console.log(`      Total:      ${sessionCount}`);
}

function printConfigSection(status: GatewayStatus): void {
  console.log(`\n  ${yellow("⚙")}  ${bold("Configuration")}`);
  console.log(`      Model:       ${status.model}`);
  console.log(
    `      Context:     ${status.contextWindow.toLocaleString()} tokens`,
  );
  console.log(`      Workspace:   ${status.workspace}`);
  console.log(
    `      Telegram:    ${status.telegramEnabled ? green("enabled") : dim("disabled")}`,
  );
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const blue = (s: string) => `\x1b[34m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
