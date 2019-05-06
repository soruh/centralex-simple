"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const multiPortServer_1 = __importDefault(require("./multiPortServer"));
const ChunkPackages_1 = __importDefault(require("./ChunkPackages"));
const ITelexServerCom_1 = require("./ITelexServerCom");
require("./prototypes/Buffer");
require("./prototypes/Map");
const PKG_END = 0x03;
const PKG_REJECT = 0x04;
const PKG_REM_CONNECT = 0x81;
const PKG_REM_CONFIRM = 0x82;
const PKG_REM_CALL = 0x83;
const PKG_REM_ACK = 0x84;
const AUTH_TIMEOUT = 30 * 1000;
const CALL_ACK_TIMEOUT = 30 * 1000;
const PING_INTERVAL = 15 * 1000;
const TIMEOUT_DELAY = 35 * 1000;
const PORT_TIMEOUT = 60 * 60 * 1000;
class NominalType {
}
let clients = new Map();
let ports = new Map();
let portTimeouts = new Map();
let savedRejectCodes = new Map();
// const debug = require('util').debuglog('centralex');
function makePackageSkeleton(type, length = 0) {
    let buffer = Buffer.alloc(length + 2);
    buffer[0] = type;
    buffer[1] = length;
    return buffer;
}
class Client {
    constructor(socket, centralex) {
        this.noCloseHandle = false;
        this.callbacks = {};
        this.number = null;
        this.centralexEnabled = false;
        this.socket = socket;
        this._id = require('crypto').randomBytes(3).toString('base64');
        this.idColor = centralex ? '\x1b[35m' : '\x1b[34m';
    }
    get id() {
        return this.idColor + this._id + '\x1b[0m';
    }
    get available() {
        // console.log(this.id + ': ' + ((this.authenticated && !this.occupied) ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m available');
        return this.authenticated && !this.occupied;
    }
    close() {
        this.socket.destroy();
        // let destroy = () => {
        //     destroy = () => { };
        //     this.socket.destroy();
        // }
        // this.socket.end(destroy);
        // setTimeout(destroy, 2000);
    }
    enableCentralex() {
        this.centralexEnabled = true;
        this.callbacks.connect = this.authenticate;
        this.socket.on('close', () => {
            this.clearAllTimeouts();
            clearInterval(this.ping);
        });
        this.restartTimeout();
        this.authTimeout = setTimeout(() => {
            console.log("client %s failed to authenticate itself in time", this.id);
            this.onTimeout();
        }, AUTH_TIMEOUT);
        this.ping = setInterval(() => {
            this.write(Buffer.alloc(2));
        }, PING_INTERVAL);
        this.socket.on('data', () => {
            this.restartTimeout();
        });
    }
    restartTimeout() {
        // console.log("restarted timeout for client %s", this.id);
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            console.log("client %s timed out", this.id);
            this.onTimeout();
        }, TIMEOUT_DELAY);
    }
    onTimeout() {
        console.log("client " + this.id + " timed out");
        this.clearAllTimeouts();
        clearInterval(this.ping);
        if (this.peer) {
            this.peer.send_reject('der');
        }
        this.close();
    }
    clearAllTimeouts() {
        clearTimeout(this.timeout);
        clearTimeout(this.authTimeout);
    }
    async authenticate(number, pin) {
        clearTimeout(this.authTimeout);
        let port = ports.get(number);
        savedRejectCodes.delete(port);
        if (port) {
            clearTimeout(portTimeouts.get(port));
            portTimeouts.delete(port);
        }
        if (!port) {
            port = await itelexServer.addFreePort();
        }
        if (!port) {
            this.socket.destroy();
            console.log('\x1b[31mfailed to open free port\x1b[0m');
            return;
        }
        ports.set(number, port);
        console.log('\x1b[32madded\x1b[0m entry for client %s on port: \x1b[36m%i\x1b[0m', this.id, port);
        clients.set(port, this);
        this.socket.once('close', () => {
            if (this.noCloseHandle)
                return;
            console.log('\x1b[31mremoved\x1b[0m entry for client %s on port: \x1b[36m%i\x1b[0m', this.id, port);
            clients.delete(port);
            clearTimeout(portTimeouts.get(port));
            portTimeouts.set(port, setTimeout(() => {
                savedRejectCodes.delete(port);
                const number = ports.findIndex(value => value === port);
                ports.delete(number);
                itelexServer.removePorts(port);
                portTimeouts.delete(port);
            }, PORT_TIMEOUT));
        });
        try {
            await ITelexServerCom_1.dynIpUpdate(number, pin, port);
            this.authenticated = true;
            const oldId = this.id;
            this.number = number;
            this._id = number.toString();
            this.idColor = '\x1b[33m';
            const newId = this.id;
            console.log("authenticated %s as %s", oldId, newId);
            this.send_centralex_confirm();
        }
        catch (err) {
            console.error('failed to update entry:', err);
            console.log("\x1b[31mpurging\x1b[0m all information on client %s", this.id);
            this.noCloseHandle = true; // don't call standart close handler
            // remove all client infomration on failed login
            clients.delete(port);
            itelexServer.removePorts(port);
            ports.delete(number);
            clearTimeout(portTimeouts.get(port));
            portTimeouts.delete(port);
            this.send_reject('na');
        }
    }
    call_callback(callback, ...args) {
        if (!this.callbacks.hasOwnProperty(callback))
            return false;
        this.callbacks[callback].apply(this, args);
        this.callbacks[callback] = null;
    }
    connect(client) {
        console.log('\x1b[1mconnecting\x1b[0m %s to %s', client.id, this.id);
        if (!(client.available && this.available)) {
            console.error('\x1b[31mfailed to connect\x1b[0m');
            // console.log(client.id + ': ' + (client.available ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m available');
            // console.log(client.id + ': ' + (client.occupied ? '\x1b[31mis' : '\x1b[32mnot') + '\x1b[0m occupied');
            // console.log(client.id + ': ' + (client.authenticated ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m authenticated');
            // console.log(this.id + ': ' + (this.available ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m available');
            // console.log(this.id + ': ' + (this.occupied ? '\x1b[31mis' : '\x1b[32mnot') + '\x1b[0m occupied');
            // console.log(this.id + ': ' + (this.authenticated ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m authenticated');
            return false;
        }
        clearTimeout(client.timeout);
        clearTimeout(this.timeout);
        clearInterval(client.ping);
        clearInterval(this.ping);
        client.occupied = true;
        this.occupied = true;
        client.peer = this;
        this.peer = client;
        client.socket.removeAllListeners('data');
        this.socket.removeAllListeners('data');
        client.socket.pipe(this.socket);
        this.socket.pipe(client.socket);
        this.socket.on('close', () => {
            // console.log(this.id + " socket closed");
            client.close();
        });
        client.socket.on('close', () => {
            // console.log(client.id + " socket closed");
            this.close();
        });
        return true;
    }
    write(buffer, end = false) {
        // if (!(buffer.length == 2 && buffer[0] == 0 && buffer[1] == 0)) {
        //     console.log('sent to ' + this.id + ': ', buffer);
        // }
        try {
            if (end) {
                this.socket.write(buffer);
                setTimeout(() => {
                    this.socket.end();
                }, 5 * 1000);
            }
            else {
                this.socket.write(buffer);
            }
            return true;
        }
        catch (err) {
            return false;
        }
    }
    centralex_call() {
        if (this.callbacks.callAccept)
            return false;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                resolve(false);
            }, CALL_ACK_TIMEOUT);
            this.callbacks.callAccept = () => {
                clearTimeout(timeout);
                resolve(true);
            };
            this.send_centralex_call();
        });
    }
    send_reject(message) {
        message += '\0';
        let buffer = makePackageSkeleton(PKG_REJECT, Buffer.byteLength(message, 'ascii'));
        buffer.write(message, 2, 'ascii');
        return this.write(buffer, true);
    }
    send_end() {
        const buffer = makePackageSkeleton(PKG_END);
        return this.write(buffer, true);
    }
    send_centralex_confirm() {
        const buffer = makePackageSkeleton(PKG_REM_CONFIRM);
        return this.write(buffer);
    }
    send_centralex_call() {
        const buffer = makePackageSkeleton(PKG_REM_CALL);
        return this.write(buffer);
    }
}
const itelexServer = new multiPortServer_1.default(async (socket, port) => {
    const caller = new Client(socket, false);
    console.log('new caller: %s', caller.id);
    socket.on('error', error => {
        socket.on('error', (error) => {
            if (error.code === "ECONNRESET") {
                console.error("client " + caller.id + " reset the socket");
            }
            else if (error.code === "EPIPE") {
                console.error("tried to write data to " + caller.id + " which is closed");
            }
            else {
                console.error('itelex socket error:', require('util').inspect(error));
            }
        });
    });
    socket.on('close', error => {
        console.log('caller %s disconnected', caller.id);
    });
    if (!clients.has(port)) {
        // client is not connected
        caller.send_reject(savedRejectCodes.get(port) || 'nc');
        return;
    }
    caller.authenticated = true;
    // caller is unknown, but has to be set to authenticated
    // for calls to be allowed
    let called = clients.get(port);
    if (!called.available) {
        // if a client is not available
        let errorMessage = 'nc';
        if (!called.authenticated) {
            errorMessage = 'na';
        }
        else if (called.occupied) {
            errorMessage = 'occ';
        }
        caller.send_reject(errorMessage);
        return;
    }
    const success = await called.centralex_call();
    if (!success) {
        caller.send_reject('occ');
        return;
    }
    const connected = called.connect(caller);
    if (!connected) {
        caller.send_reject('occ');
    }
});
const centralexServer = new net_1.Server(socket => {
    const client = new Client(socket, true);
    console.log('new centralex client: ' + client.id);
    socket.on('error', (error) => {
        if (error.code === "ECONNRESET") {
            console.error("client " + client.id + " reset the socket");
        }
        else if (error.code === "EPIPE") {
            console.error("tried to write data to " + client.id + " which is closed");
        }
        else {
            console.error('centralex socket error:', error);
            console.log("error code: ", error.code);
        }
    });
    socket.on('close', () => {
        console.log('centralex client %s disconnected', client.id);
    });
    client.enableCentralex();
    const chunker = new ChunkPackages_1.default();
    chunker.on('data', async (pkg) => {
        const [type, length] = pkg;
        const content = pkg.slice(2);
        switch (type) {
            case PKG_END:
            // fall through to PKG_REJECT case
            // client.close();
            // break;
            case PKG_REJECT:
                if (client.authenticated) {
                    const port = ports.get(client.number);
                    if (port) {
                        const code = content.readNullTermString();
                        console.log("saving exit code \x1b[32m'%s'\x1b[0m for port \x1b[36m%i\x1b[0m", code, port);
                        savedRejectCodes.set(port, code);
                    }
                }
                client.close();
                // console.log('client reject:', content.readNullTermString());
                break;
            case PKG_REM_CONNECT:
                if (content.length >= 6) {
                    let number = content.readUInt32LE(0);
                    let pin = content.readUInt16LE(4);
                    if (ports.has(number)) {
                        const port = ports.get(number);
                        if (clients.has(port)) {
                            const old_client = clients.get(port);
                            if (old_client.occupied) {
                                client.send_reject("occ");
                                break;
                            }
                            else {
                                old_client.send_reject("occ");
                            }
                        }
                    }
                    client.call_callback('connect', number, pin);
                }
                break;
            case PKG_REM_ACK:
                client.call_callback('callAccept');
                break;
        }
    });
    socket.pipe(chunker);
});
/*
itelexServer.on('listening', (port: number) => {
    console.log('\x1b[32listening\x1b[0m on port: \x1b[36m%i\x1b[0m', port);
});
*/
itelexServer.on('close', (port) => {
    console.log('\x1b[31mclosed\x1b[0m port: \x1b[36m%i\x1b[0m', port);
});
centralexServer.listen(49491, () => {
    console.log("centralex server listening on port %d", 49491);
});
function timeLeft(timeout) {
    let remaining = timeout["_idleTimeout"] + timeout["_idleStart"] - Math.floor(process.uptime() * 1000);
    if (remaining < 0)
        remaining = 0;
    return (remaining / 1000).toFixed(3);
}
function getStateProblems() {
    let openPorts = itelexServer.listPorts();
    let problems = [];
    for (let [port, client] of clients) {
        if (ports.find(value => value == port) === null) {
            problems.push(`client ${client._id} has no map to a number`);
        }
        if (portTimeouts.has(port)) {
            problems.push(`port ${port} is connected to a client and in timeout at the same time`);
        }
    }
    for (let [number, port] of ports) {
        if (!~openPorts.indexOf(port)) {
            problems.push(`port ${port} should be open, but is not`);
        }
        if (!(clients.has(port) || portTimeouts.has(port))) {
            problems.push(`port ${port} is used, but neither connected, nor in timeout`);
        }
    }
    for (let port of openPorts) {
        if (ports.find((value, key) => value == port) === null) {
            problems.push(`port ${port} is open, but should not be`);
        }
        if (ports.find(value => value == port) === null) {
            problems.push(`port ${port} is open, but should not be`);
        }
    }
    for (let [port, timeout] of portTimeouts) {
        if (clients.has(port)) {
            problems.push(`port ${port} is connected and in timeout at the same time`);
        }
        if (ports.findIndex(value => value === port) === null) {
            problems.push(`port ${port} has a timeout, but not an associated number`);
        }
    }
    for (let [port, code] of savedRejectCodes) {
        if (ports.findIndex(value => value === port) === null) {
            problems.push(`port ${port} has a know reject code, but not an associated number`);
        }
    }
    return problems;
}
const debugServer = new net_1.Server(socket => {
    let message = "";
    message += "\n=> port-number mapping:\n";
    message += Array.from(ports).sort((a, b) => a[1] - b[1]).map(x => `  - ${(x[0] + '').padStart(10)} on port: ${x[1]}`).join('\n');
    message += "\n\n=> connected clients:\n";
    // message += Array.from(clients).map(x => `  - ${(x[0] + '').padStart(10)} is a ${x[1].centralexEnabled ? 'centralex client' : 'caller'}`).join('\n');
    message += Array.from(clients).sort((a, b) => a[0] - b[0]).map(x => `  - ${(x[1]._id + '').padStart(10)} on port: ${x[0]}${x[1].authenticated ? ' [authenticated]' : ' [unauthenticated]'}${x[1].occupied ? ' [occupied]' : ' [unoccupied]'}`).join('\n');
    message += "\n\n=> open ports:\n";
    message += itelexServer.listPorts().sort((a, b) => a - b).map(x => `  - ${(x + '').padStart(10)}`).join('\n');
    message += "\n\n=> port timeouts:\n";
    message += Array.from(portTimeouts).sort((a, b) => a[0] - b[0]).map(x => `  - ${(x[0] + '').padStart(10)}: time to timeout: ${timeLeft(x[1])} seconds`).join('\n');
    message += "\n\n=> saved reject codes:\n";
    message += Array.from(savedRejectCodes).sort((a, b) => a[0] - b[0]).map(x => `  - ${(x[0] + '').padStart(10)}: '${x[1]}'`).join('\n');
    // message += "\n\n=> constants:";
    // message += `\n  - AUTH_TIMEOUT: ${AUTH_TIMEOUT}`;
    // message += `\n  - CALL_ACK_TIMEOUT: ${CALL_ACK_TIMEOUT}`;
    // message += `\n  - PING_INTERVAL: ${PING_INTERVAL}`;
    // message += `\n  - TIMEOUT_DELAY: ${TIMEOUT_DELAY}`;
    // message += `\n  - PORT_TIMEOUT: ${PORT_TIMEOUT}`;
    message += "\n\n=> problems:\n";
    message += getStateProblems().map(x => '  - ' + x).join("\n");
    let header = "";
    header += `HTTP/1.0 200 OK\n`;
    header += `Content-Type: text/plain\n`;
    header += `Content-Length: ${Buffer.byteLength(message)}\n`;
    header += `Date: ${new Date().toUTCString()}\n`;
    socket.write(header);
    socket.write("\n");
    socket.end(message);
});
debugServer.listen(4885, () => {
    console.log("debug server listening on port %d", 4885);
});
