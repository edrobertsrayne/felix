#!/usr/bin/env bun

import { Command } from "commander";
import {
  startGateway,
  stopGateway,
  statusGateway,
} from "./commands/gateway.js";
import { startTUI } from "./commands/tui.js";

const program = new Command();

program.name("felix").description("Felix AI Agent CLI").version("1.0.0");

program
  .command("gateway")
  .description("Manage the gateway service")
  .addCommand(
    new Command("start")
      .description("Start the gateway in background")
      .option("--no-telegram", "Disable Telegram adapter")
      .option("--host <ip>", "Host IP to bind to (e.g., 127.0.0.1, 0.0.0.0)")
      .option("--override", "Stop existing gateway and restart")
      .action(async (options) => {
        await startGateway({
          telegram: options.telegram !== false,
          host: options.host,
          override: options.override,
        });
      }),
  )
  .addCommand(
    new Command("stop")
      .description("Stop the running gateway")
      .action(stopGateway),
  )
  .addCommand(
    new Command("status")
      .description("Show gateway status")
      .action(statusGateway),
  );

program
  .command("tui")
  .description("Open TUI and connect to gateway")
  .option("--url <url>", "Gateway WebSocket URL", "ws://127.0.0.1:18789")
  .option("--no-auto-start", "Don't auto-start gateway if not running")
  .action((options) => {
    startTUI({ url: options.url, autoStart: options.autoStart !== false });
  });

program.parse();
