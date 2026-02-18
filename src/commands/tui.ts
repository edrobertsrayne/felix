import { isGatewayRunning, startDaemon } from "../daemon.js";

export interface TUIOptions {
  url: string;
  autoStart: boolean;
}

export async function startTUI(options: TUIOptions): Promise<void> {
  if (!isGatewayRunning()) {
    if (options.autoStart) {
      console.log("Gateway not running, starting...");
      const result = await startDaemon();
      if (!result) {
        console.error("Failed to start gateway");
        process.exit(1);
      }
    } else {
      console.error(
        "Gateway is not running. Run 'felix gateway start' or use --auto-start",
      );
      process.exit(1);
    }
  }

  const { startTUI: inkStartTUI } = await import("../tui.js");
  inkStartTUI({ gatewayUrl: options.url });
}
