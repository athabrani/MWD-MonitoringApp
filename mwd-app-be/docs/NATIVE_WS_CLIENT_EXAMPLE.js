// Native WebSocket Frontend Client Example
// Use the browser built-in WebSocket API for this backend realtime channel.

const WS_URL = "ws://localhost:5001/ws";

let ws = null;
let reconnectTimer = null;

const connectNativeWebSocket = () => {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("[MWD WS] connected");

    ws.send(JSON.stringify({
      event: "ping",
      payload: {},
    }));
  };

  ws.onmessage = (event) => {
    let message;

    try {
      message = JSON.parse(event.data);
    } catch {
      console.error("[MWD WS] invalid JSON message", event.data);
      return;
    }

    switch (message.event) {
      case "connected":
        console.log("[MWD WS] welcome", message.payload);
        break;

      case "pong":
        console.log("[MWD WS] pong", message.payload);
        break;

      case "mwd-data":
        console.log("[MWD WS] MWD data", message.payload);
        break;

      case "connection-status":
        console.log("[MWD WS] connection status", message.payload);
        break;

      case "esp-gateway-status":
        console.log("[MWD WS] ESP gateway status", message.payload);
        break;

      case "wits-data":
        console.log("[MWD WS] WITS data", message.payload);
        break;

      case "alert":
        console.warn("[MWD WS] alert", message.payload);
        break;

      case "error":
        console.error("[MWD WS] backend error", message.payload);
        break;

      default:
        console.log("[MWD WS] event", message.event, message.payload);
    }
  };

  ws.onclose = () => {
    console.log("[MWD WS] disconnected, reconnecting...");
    reconnectTimer = setTimeout(connectNativeWebSocket, 3000);
  };

  ws.onerror = (error) => {
    console.error("[MWD WS] error", error);
  };
};

const disconnectNativeWebSocket = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }
};

connectNativeWebSocket();

export {
  connectNativeWebSocket,
  disconnectNativeWebSocket,
};
