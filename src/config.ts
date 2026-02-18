import fs from "fs";
import os from "os";
import path from "path";

export interface Config {
  workspace: string;
  contextWindow: number;
  guardThreshold: number;
  gateway: {
    port: number;
    host?: string;
  };
  model: string;
  systemPrompt: string;
  tui: {
    enabled: boolean;
  };
  telegram: {
    enabled: boolean;
    allowedChats: string[];
  };
}

const DEFAULT_CONFIG: Config = {
  workspace: "./agent-workspace",
  contextWindow: 128000,
  guardThreshold: 0.8,
  gateway: {
    port: 18789,
    host: "127.0.0.1",
  },
  model: "openrouter/auto",
  systemPrompt: "You are a helpful AI assistant. Keep responses concise.",
  tui: {
    enabled: true,
  },
  telegram: {
    enabled: true,
    allowedChats: [],
  },
};

function mergeConfig(userConfig: Partial<Config>): Config {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    gateway: {
      ...DEFAULT_CONFIG.gateway,
      ...(userConfig.gateway || {}),
    },
    tui: {
      ...DEFAULT_CONFIG.tui,
      ...(userConfig.tui || {}),
    },
    telegram: {
      enabled: userConfig.telegram?.enabled ?? DEFAULT_CONFIG.telegram.enabled,
      allowedChats:
        userConfig.telegram?.allowedChats ??
        DEFAULT_CONFIG.telegram.allowedChats,
    },
  };
}

export function loadConfig(configPath?: string): Config {
  if (configPath && fs.existsSync(configPath)) {
    return loadConfigFile(configPath);
  }

  const localPath = path.resolve("config.json");
  if (fs.existsSync(localPath)) {
    return loadConfigFile(localPath);
  }

  const userConfigPath = path.join(
    os.homedir(),
    ".config",
    "felix",
    "config.json",
  );
  if (fs.existsSync(userConfigPath)) {
    return loadConfigFile(userConfigPath);
  }

  return DEFAULT_CONFIG;
}

function loadConfigFile(filePath: string): Config {
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const userConfig = JSON.parse(fileContent);
    return mergeConfig(userConfig);
  } catch (err) {
    console.error(`[Config] Failed to load config from ${filePath}:`, err);
    return DEFAULT_CONFIG;
  }
}

export function resolveConfig(config: Config): Config {
  const resolved = { ...config };

  if (!path.isAbsolute(resolved.workspace)) {
    resolved.workspace = path.resolve(resolved.workspace);
  }

  return resolved;
}
