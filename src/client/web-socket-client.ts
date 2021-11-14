import EventEmitter from "events";
import { createConnection, Socket } from "net";
import { OpenHandshakeHandler } from "./open-handshake-handler";
import SocketReader from "./socket-reader";

export interface WebSocketConnectOptions {
    port: number;
    host: string;
};

export class WebSocketClient extends EventEmitter {
    private options: WebSocketConnectOptions;

    private socket: Socket;

    private openHandshakeHandler: OpenHandshakeHandler;

    private socketReader: SocketReader;

    private state: 'connecting' | 'connected' | 'disconnected' = 'connecting';

    constructor(options: Partial<WebSocketConnectOptions>) {
        super();

        this.options = {
            port: 80,
            host: 'localhost',
            ...options
        }

        this.socket = createConnection({
            port: this.options.port,
            host: this.options.host
        });

        this.openHandshakeHandler = new OpenHandshakeHandler(this.socket, this.options);
        this.socketReader = new SocketReader(this.socket);
        this.initSocketListeners();
    }

    private initHandshake() {

        this.openHandshakeHandler.on('handshake-success', () => {
            this.state = 'connected';
            this.emit('connect');
        });

        this.openHandshakeHandler.on('handshake-fail', (reason: string) => {
            this.socket.destroy();
            this.state = 'disconnected'
            this.emit('error', reason);
        });

        this.openHandshakeHandler.doUpgrade();
    }

    private initSocketListeners() {
        this.socketReader.on('handshake-response', (data: Buffer) => {
            this.openHandshakeHandler.handleResponse(data);
        });

        this.socketReader.on('message', (message: string) => {
            this.emit('message', message);
        });

        this.socketReader.on('binary', (data: Buffer) => {
            this.emit('binary', data);
        });

        this.socket.on('connect', this.initHandshake.bind(this));

        this.socket.on('error', (err) => {
            this.socket.removeAllListeners();
            this.state = 'disconnected';
            this.emit('error', err.message);
            this.emit('disconnect');
        });
    }
}