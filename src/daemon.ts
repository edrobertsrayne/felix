import fs from "fs";
import path from "path";
import os from "os";

const PID_DIR =
  process.env.FELIX_PID_DIR ||
  path.join(os.homedir(), ".local", "share", "felix");
const PID_FILE = path.join(PID_DIR, "gateway.pid");
const LOG_DIR = path.join(PID_DIR, "logs");
const LOG_OUT = path.join(LOG_DIR, "gateway.out.log");
const LOG_ERR = path.join(LOG_DIR, "gateway.err.log");

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function getPidFilePath(): string {
  return PID_FILE;
}

export function getPidDir(): string {
  return PID_DIR;
}

export function writePidFile(pid: number): void {
  fs.mkdirSync(PID_DIR, { recursive: true });
  fs.writeFileSync(PID_FILE, pid.toString());
}

export function readPidFile(): number | null {
  if (!fs.existsSync(PID_FILE)) {
    return null;
  }
  const content = fs.readFileSync(PID_FILE, "utf-8").trim();
  const pid = parseInt(content, 10);
  return isNaN(pid) ? null : pid;
}

export function removePidFile(): void {
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isGatewayRunning(): boolean {
  const pid = readPidFile();
  if (pid === null) {
    return false;
  }
  return isProcessRunning(pid);
}

export async function startDaemon(host?: string): Promise<boolean> {
  const existingPid = readPidFile();
  if (existingPid && isProcessRunning(existingPid)) {
    console.error(`Gateway already running with PID ${existingPid}`);
    return false;
  }

  if (existingPid) {
    removePidFile();
  }

  ensureLogDir();

  const out = fs.openSync(LOG_OUT, "a");
  const err = fs.openSync(LOG_ERR, "a");

  const env = { ...process.env };
  if (host) {
    env.FELIX_GATEWAY_HOST = host;
  }

  const child = Bun.spawn(["bun", "run", "src/gateway-service.ts"], {
    detached: true,
    stdin: "ignore",
    stdout: out,
    stderr: err,
    env,
  });

  fs.closeSync(out);
  fs.closeSync(err);

  child.unref();

  writePidFile(child.pid);
  console.log(`Gateway started with PID ${child.pid}`);
  return true;
}

export async function stopDaemon(): Promise<boolean> {
  const pid = readPidFile();
  if (!pid) {
    console.error("No gateway running (no PID file)");
    return false;
  }

  if (!isProcessRunning(pid)) {
    console.log("Stale PID file, cleaning up");
    removePidFile();
    return true;
  }

  process.kill(pid, "SIGTERM");

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (!isProcessRunning(pid)) {
      removePidFile();
      console.log("Gateway stopped");
      return true;
    }
  }

  process.kill(pid, "SIGKILL");
  removePidFile();
  console.log("Gateway force killed");
  return true;
}
