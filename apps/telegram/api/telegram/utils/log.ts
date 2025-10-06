export const log = (message: string, extra?: Record<string, unknown>) =>
  console.log(
    `[${new Date().toISOString()}] Telegram: ${message}`,
    extra ? JSON.stringify(extra) : ""
  );
