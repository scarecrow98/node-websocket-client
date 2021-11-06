import EventEmitter, { on } from "events";
import { createConnection, Socket } from "net";
import { OpenHandshakeHandler, ResponseLine } from "./open-handshake-handler";

export interface WebSocketConnectOptions {
    port: number;
    host: string;
    version: number;
};

export class WebSocketClient extends EventEmitter {
    private options: WebSocketConnectOptions;

    private socket: Socket;

    private openHandshakeHandler: OpenHandshakeHandler;

    constructor(options: Partial<WebSocketConnectOptions>) {
        super();

        this.options = {
            port: 80,
            host: 'localhost',
            version: 13,
            ...options
        }

        this.socket = createConnection({
            port: this.options.port,
            host: this.options.host
        });

        this.openHandshakeHandler = new OpenHandshakeHandler(this.socket, this.options);

        this.openHandshakeHandler.on('handshake-success', () => {
            this.openHandshakeHandler.removeAllListeners();
            this.emit('connect');
        });

        this.openHandshakeHandler.on('handshake-fail', (reason: string) => {
            this.openHandshakeHandler.removeAllListeners();
            this.socket.destroy();
            this.emit('error', reason);
        });

        this.socket.on('close', this.handleSocketClose.bind(this));

        
    }

    private handleSocketClose() {
        this.emit('disconnect');
    }
}