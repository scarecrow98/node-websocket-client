import EventEmitter from "events";
import { Socket } from "net";
import { WebSocketConnectOptions } from "./web-socket-client";
import { randomBytes, createHash } from 'crypto';

const MAGIC_WS_UID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export interface ResponseLine {
    httpVersion: string;
    statusCode: number;
    statusText: string;
}

export class OpenHandshakeHandler extends EventEmitter {
    private socket: Socket;
    private options: WebSocketConnectOptions;
    private secKey?: string;
    
    constructor(socket: Socket, options: WebSocketConnectOptions) {
        super();

        this.options = options;
        this.socket = socket;

        this.socket.on('connect', this.doUpgrade.bind(this));
        this.socket.on('data', this.onResponse.bind(this));
    }

    private doUpgrade() {
        this.secKey = this.generateSecKey();
        const upgradeHeaders = [
            'GET / HTTP/1.1',
            `Host: ${this.options.host}:${this.options.port}`,
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Version: ${this.options.version}`,
            `Sec-WebSocket-Key: ${this.secKey}`
        ].join("\r\n");

        this.socket.write(upgradeHeaders + "\r\n\r\n");
        this.socket.end(); //tcp fin
    }

    private onResponse(data: Buffer) {
        const lines = data.toString()?.split("\r\n").filter(x => !!x !== false);
        
        if (!lines || lines.length == 0) {
            return this.emit('handshake-fail', 'The server responded with a malformed handshake');
        }

        const responseLine = this.parseResponseLine(lines[0]);
        
        if (!responseLine) {
            return this.emit('handshake-fail', 'The server responded with a malformed handshake');
        }

        if (responseLine.statusCode !== 101) {
            return this.emit('handshake-fail', `The server responded with status code ${responseLine.statusCode} [${responseLine.statusText}]`);
        }

        lines.shift();
        const headers = this.parseHeaders(lines);

        if ((headers['upgrade'] !== 'websocket')
        || headers['connection'] !== 'Upgrade') {
            return this.emit('handshake-fail', `Invalid response handshakre headers`);
        }

        if (!this.validateSecKey(headers['sec-websocket-accept'])) {
            return this.emit('handshake-fail', `Invalid Sec-WebSocket-Accept header value`);
        }

        this.emit('handshake-success');
    }

    dispose() {
        this.removeAllListeners();
    }

    private generateSecKey(): string {
        return randomBytes(16).toString('base64');
    }

    private parseResponseLine(line: string): ResponseLine|null {
        const matches = line.match(/^(\HTTP\/[\d\.]+)\s(\d+)\s([\w\W\s]+)$/);
        if (!matches || matches.length != 4) {
            return null;
        }

        return {
            httpVersion: matches[1],
            statusCode: parseInt(matches[2]),
            statusText: matches[3]
        }
    }

    private parseHeaders(lines: string[]): Record<string, string> {
        const headers: Record<string, string> = {};

        lines.forEach(line => {
            const parts = line.split(': ');
            headers[ parts[0].toLowerCase() ] = parts[1];
        });
        return headers;
    }

    private validateSecKey(acceptKey?: string): boolean {
        const hash = createHash('sha1').update(this.secKey + MAGIC_WS_UID).digest('base64');

        return acceptKey === hash;
    }
}