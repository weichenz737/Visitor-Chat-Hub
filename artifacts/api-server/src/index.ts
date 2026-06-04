import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { createWebSocketServer } from "./lib/websocket";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);
const wss = createWebSocketServer();

server.on("upgrade", (request, socket, head) => {
  const url = request.url ?? "";
  if (url.startsWith("/ws")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, () => {
  logger.info({ port }, "Server listening with WebSocket support");
});
