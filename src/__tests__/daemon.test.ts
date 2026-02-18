import { describe, test, expect, afterAll, beforeAll } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_PID_DIR = path.join(os.tmpdir(), "felix-test-daemon");
const TEST_PID_FILE = path.join(TEST_PID_DIR, "gateway.pid");

process.env.FELIX_PID_DIR = TEST_PID_DIR;

describe("daemon PID file management", () => {
  beforeAll(() => {
    fs.mkdirSync(TEST_PID_DIR, { recursive: true });
  });

  afterAll(() => {
    try {
      if (fs.existsSync(TEST_PID_FILE)) {
        fs.unlinkSync(TEST_PID_FILE);
      }
    } catch {
      // Ignore cleanup errors
    }
    try {
      if (fs.existsSync(TEST_PID_DIR)) {
        fs.rmSync(TEST_PID_DIR, { force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  test("should write PID to file", async () => {
    const { writePidFile } = await import("../daemon.js");
    writePidFile(12345);
    const content = fs.readFileSync(TEST_PID_FILE, "utf-8");
    expect(content).toBe("12345");
  });

  test("should read PID from file", async () => {
    const { readPidFile } = await import("../daemon.js");
    const pid = readPidFile();
    expect(pid).toBe(12345);
  });

  test("should return null when PID file does not exist", async () => {
    const { readPidFile } = await import("../daemon.js");
    if (fs.existsSync(TEST_PID_FILE)) {
      fs.unlinkSync(TEST_PID_FILE);
    }
    const pid = readPidFile();
    expect(pid).toBeNull();
  });

  test("should detect running process", async () => {
    const { isProcessRunning } = await import("../daemon.js");
    expect(isProcessRunning(process.pid)).toBe(true);
    expect(isProcessRunning(99999)).toBe(false);
    expect(isProcessRunning(1)).toBe(false);
  });

  test("should check if gateway is running", async () => {
    const { isGatewayRunning } = await import("../daemon.js");
    expect(isGatewayRunning()).toBe(false);
  });

  test("should report running after writing PID", async () => {
    const { writePidFile, isGatewayRunning } = await import("../daemon.js");
    writePidFile(process.pid);
    expect(isGatewayRunning()).toBe(true);
  });
});

describe("daemon start/stop", () => {
  test("should refuse to start if already running", async () => {
    const { writePidFile, startDaemon } = await import("../daemon.js");
    writePidFile(process.pid);
    const result = await startDaemon();
    expect(result).toBe(false);
  });

  test("should detect stale PID file", async () => {
    const { writePidFile, isGatewayRunning } = await import("../daemon.js");
    writePidFile(99999);
    expect(isGatewayRunning()).toBe(false);
  });
});
