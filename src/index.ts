import { WebSocketClient } from "./client/web-socket-client";

const ws = new WebSocketClient({
    port: 3200,
});

ws.on('connect', () => {
    console.log('connected');
});

ws.on('message', (message: string) => {
    console.log('string message length', message.length);
});

ws.on('binary', (data: Buffer) => {
    console.log('binary message length: ', data.length);
});

ws.on('error', (reason: string) => {
    console.log('error', reason);
});

ws.on('disconnect', () => {
    console.log('disconnected');
});