import { WebSocketClient } from "./client/web-socket-client";

const ws = new WebSocketClient({
    port: 3200,
    version: 9
});

ws.on('connect', () => {
    console.log('connected');
});

ws.on('error', (reason: string) => {
    console.log('error', reason);
});

ws.on('disconnect', () => {
    console.log('disconnected');
});