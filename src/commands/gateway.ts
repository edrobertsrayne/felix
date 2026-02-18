import { startDaemon, stopDaemon, isGatewayRunning } from "../daemon.js";

export interface GatewayStartOptions {
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
