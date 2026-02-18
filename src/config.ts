import fs from "fs";
import path from "path";

export interface Config {
  workspace: string;
  contextWindow: number;
  guardThreshold: number;
  gateway: {
    port: number;
  };
  model: string;
  systemPrompt: string;
}

const DEFAULT_CONFIG: Config = {
  workspace: "./agent-workspace",
  contextWindow: 128000,
  guardThreshold: 0.8,
  gateway: {
    port: 18789,
  },
  model: "openrouter/auto",
  systemPrompt: "You are a helpful AI assistant. Keep responses concise.",
};

export function loadConfig(configPath?: string): Config {
  const defaultPath = path.resolve("config.json");
  const filePath = configPath || defaultPath;

  if (!fs.existsSync(filePath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const userConfig = JSON.parse(fileContent);
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      gateway: {
        ...DEFAULT_CONFIG.gateway,
        ...userConfig.gateway,
      },
    };
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
