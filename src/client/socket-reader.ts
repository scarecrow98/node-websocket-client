import { SSL_OP_CISCO_ANYCONNECT } from "constants";
import EventEmitter from "events";
import { Socket } from "net";

const READ_BUFFER_SIZE = 10 * 10000;

enum FrameOpcode {
    TEXT = 1,
    BINARY = 2
}

class SocketReader extends EventEmitter {
    private socket: Socket;
    private _buffer: Buffer = Buffer.alloc(READ_BUFFER_SIZE);
    private _bufferIdx = 0;
    private _readIdx = 0;

    constructor(socket: Socket) {
        super();
        this.socket = socket;

        this.socket.on('data', this.onData.bind(this));
    }

    private onData(data: Buffer) {
        let i = 0;
        while (i < data.length) {

            if (data.subarray(i, i + 4).toString() === '\r\n\r\n') {
                this.emit('handshake-response', this._buffer.subarray(0, this._bufferIdx));
                this._bufferIdx = 0;
                i += 4;
                continue;
            }

            this._buffer[this._bufferIdx++] = data[i];

            ++i;
        }        

        this.readFrame();
    }

    private readFrame() {        
        const b1 = this._buffer[this._readIdx];
        const fin = (128 & b1) > 0;
        const rsv1 = ((128 >> 1) & b1) > 0; 
        const rsv2 = ((128 >> 2) & b1) > 0; 
        const rsv3 = ((128 >> 3) & b1) > 0;
        const opcode = (15 & b1);
        const b2 = this._buffer[this._readIdx + 1];
    
        const mask = (128 & b2) > 0;

        if (mask) {
            throw new Error('Unmasking frames is not impemented yet.');
        }

        let payloadLength = 127 & b2;
        let payloadStart = this._readIdx + 2;

        if (payloadLength === 126) {
            payloadLength = (this._buffer[this._readIdx + 2] << 8) | (this._buffer[this._readIdx + 3]);
            payloadStart += 2;
        } else if (payloadLength === 127) {
            //todo: implement 8-byte length frame
            throw new Error('8-byte message lengths are not implemented yet.');
        }

        //if theres not enough data in the read buffer yet.
        //we skip, and wait for the next tcp packet
        if (payloadLength > this._bufferIdx - this._readIdx) {
            return;
        }

        //todo: implement other frame types
        if (opcode === FrameOpcode.BINARY) {
            this.emit('binary', this._buffer.subarray(payloadStart, payloadStart + payloadLength));
        } else if (opcode === FrameOpcode.TEXT) {
            const msg = this._buffer.subarray(payloadStart, payloadStart + payloadLength).toString();
            this.emit('message', msg);
        }
            
        this._readIdx = payloadStart + payloadLength;

        if (this._readIdx < this._bufferIdx) {
            this.readFrame();
        } else {
            this._readIdx = 0;
            this._bufferIdx = 0;
        }
    }
}

export = SocketReader;