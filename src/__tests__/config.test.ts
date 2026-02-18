import {
  describe,
  test,
  expect,
  afterAll,
  beforeAll,
  afterEach,
} from "bun:test";
import { loadConfig, resolveConfig, type Config } from "../config.js";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_CONFIG_PATH = path.resolve("test-config.json");
const TEST_WORKSPACE = path.resolve("test-workspace");
const TEST_DIR = path.join(os.tmpdir(), "felix-test-config");
const HOME_CONFIG_DIR = path.join(os.homedir(), ".config", "felix");

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
      tui: { enabled: true },
      telegram: { enabled: true, allowedChats: [] },
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

describe("config multi-path loading", () => {
  const originalCwd = process.cwd();

  beforeAll(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(HOME_CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    const localConfig = path.resolve("config.json");
    if (fs.existsSync(localConfig)) {
      fs.unlinkSync(localConfig);
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { force: true, recursive: true });
    }
    const homeConfig = path.join(HOME_CONFIG_DIR, "config.json");
    if (fs.existsSync(homeConfig)) {
      fs.unlinkSync(homeConfig);
    }
  });

  test("should load from explicit path", () => {
    const explicitPath = path.join(TEST_DIR, "explicit.json");
    fs.writeFileSync(explicitPath, JSON.stringify({ model: "explicit-model" }));
    const config = loadConfig(explicitPath);
    expect(config.model).toBe("explicit-model");
    fs.unlinkSync(explicitPath);
  });

  test("should load from current directory config.json", () => {
    const localConfig = path.resolve("config.json");
    fs.writeFileSync(localConfig, JSON.stringify({ model: "local-model" }));
    const config = loadConfig();
    expect(config.model).toBe("local-model");
  });

  test("should load from ~/.config/felix/config.json when local not found", () => {
    const homeConfig = path.join(HOME_CONFIG_DIR, "config.json");
    fs.writeFileSync(homeConfig, JSON.stringify({ model: "home-model" }));
    const localConfig = path.resolve("config.json");
    if (fs.existsSync(localConfig)) {
      fs.unlinkSync(localConfig);
    }
    const config = loadConfig();
    expect(config.model).toBe("home-model");
  });

  test("should prefer current directory over home config", () => {
    const homeConfig = path.join(HOME_CONFIG_DIR, "config.json");
    fs.writeFileSync(homeConfig, JSON.stringify({ model: "home-model" }));
    const localConfig = path.resolve("config.json");
    fs.writeFileSync(localConfig, JSON.stringify({ model: "local-model" }));
    const config = loadConfig();
    expect(config.model).toBe("local-model");
  });
});

describe("config telegram merge", () => {
  afterAll(() => {
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
  });

  test("should merge telegram config deeply", () => {
    const testConfig = {
      telegram: {
        enabled: true,
        allowedChats: ["123456789"],
      },
    };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));
    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.telegram).toBeDefined();
    expect(config.telegram?.enabled).toBe(true);
    expect(config.telegram?.allowedChats).toEqual(["123456789"]);
    expect(config.model).toBe("openrouter/auto");
  });

  test("should have default telegram config when not specified", () => {
    const testConfig = { model: "custom-model" };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));
    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.telegram?.enabled).toBe(true);
  });
});
