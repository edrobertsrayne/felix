import { describe, test, expect, afterAll } from "bun:test";
import { loadConfig, resolveConfig, type Config } from "../config.js";
import fs from "fs";
import path from "path";

const TEST_CONFIG_PATH = path.resolve("test-config.json");
const TEST_WORKSPACE = path.resolve("test-workspace");

describe("config", () => {
  afterAll(() => {
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
    if (fs.existsSync(TEST_WORKSPACE)) {
      fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
  });

  test("should return default config when no file exists", () => {
    const config = loadConfig("nonexistent.json");
    expect(config.workspace).toBe("./agent-workspace");
    expect(config.contextWindow).toBe(128000);
    expect(config.guardThreshold).toBe(0.8);
    expect(config.gateway.port).toBe(18789);
  });

  test("should load config from file", () => {
    const testConfig: Config = {
      workspace: "./custom-workspace",
      contextWindow: 64000,
      guardThreshold: 0.9,
      gateway: { port: 18000 },
      model: "test/model",
      systemPrompt: "Test prompt",
    };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));
    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.workspace).toBe("./custom-workspace");
    expect(config.contextWindow).toBe(64000);
    expect(config.guardThreshold).toBe(0.9);
    expect(config.gateway.port).toBe(18000);
  });

  test("should merge user config with defaults", () => {
    const testConfig = { workspace: "./my-workspace" };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));
    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.workspace).toBe("./my-workspace");
    expect(config.contextWindow).toBe(128000);
  });

  test("should resolve relative workspace paths", () => {
    const config = resolveConfig({
      ...loadConfig(),
      workspace: "./relative-path",
    });
    expect(path.isAbsolute(config.workspace)).toBe(true);
    expect(config.workspace).toContain("relative-path");
  });
});
