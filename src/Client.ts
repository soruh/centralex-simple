import { Socket } from "net";
import { log } from "./util";
import { AUTH_TIMEOUT, PING_INTERVAL, TIMEOUT_DELAY, PORT_TIMEOUT, CALL_ACK_TIMEOUT, PKG_REJECT, PKG_END, PKG_REM_CONFIRM, PKG_REM_CALL } from "./constants";
import { ports, savedRejectCodes, portTimeouts, clients } from "./globals";
import itelexServer from "./itelexServer";
import { dynIpUpdate } from "./ITelexServerCom";
import { makePackageSkeleton } from "./util";

class Client {

    public occupied: boolean;
    public authenticated: boolean;


    public authTimeout: NodeJS.Timer;
    public timeout: NodeJS.Timer;
    public ping: NodeJS.Timer;

    private noCloseHandle = false;


    public callbacks: {
        [index: string]: Function,
    } = {};
    public peer: Client;
    public _id: string;
    public number: CallNumber = null;

    public centralexEnabled = false;

    get id() {
        return this.idColor + this._id + '\x1b[0m';
    }

    public idColor: string;

    get available() {
        // log(this.id + ': ' + ((this.authenticated && !this.occupied) ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m available');
        return this.authenticated && !this.occupied;
    }

    public socket: Socket;
    constructor(socket: Socket, centralex: boolean) {
        this.socket = socket;
        this._id = require('crypto').randomBytes(3).toString('base64');

        this.idColor = centralex ? '\x1b[35m' : '\x1b[34m';
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
            log("client %s failed to authenticate itself in time", this.id);
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
        // log("restarted timeout for client %s", this.id);
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            log("client %s timed out", this.id);
            this.onTimeout();
        }, TIMEOUT_DELAY);
    }

    onTimeout() {
        log("client " + this.id + " timed out");
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

    async authenticate(number: CallNumber, pin: number) {
        log("client %s is trying to authenticate as \x1b[33m%d\x1b[0m", this.id, number);

        clearTimeout(this.authTimeout);

        let port = ports.get(number);
        savedRejectCodes.delete(port);

        if (port) {
            clearTimeout(portTimeouts.get(port));
            portTimeouts.delete(port);
        }

        if (!port) {
            port = await itelexServer.addFreePort() as Port;
        }
        if (!port) {
            this.socket.destroy();
            log('\x1b[31mfailed to open free port\x1b[0m');
            return;
        }

        ports.set(number, port);


        log('\x1b[32madded\x1b[0m entry for client %s on port: \x1b[36m%i\x1b[0m', this.id, port);
        clients.set(port, this);

        this.socket.once('close', () => {
            if (this.noCloseHandle) return;

            log('\x1b[31mremoved\x1b[0m entry for client %s on port: \x1b[36m%i\x1b[0m', this.id, port);
            clients.delete(port);

            clearTimeout(portTimeouts.get(port));
            portTimeouts.set(port, setTimeout(() => {
                savedRejectCodes.delete(port)


                const number = ports.findIndex(value => value === port);
                ports.delete(number);

                itelexServer.removePorts(port);
                portTimeouts.delete(port);
            }, PORT_TIMEOUT));

        });


        try {
            await dynIpUpdate(number, pin, port);
            this.authenticated = true;

            const oldId = this.id;
            this.number = number;
            this._id = number.toString();
            this.idColor = '\x1b[33m';
            const newId = this.id;

            log("authenticated %s as %s", oldId, newId);

            this.send_centralex_confirm();
        } catch (err) {
            console.error('failed to update entry:', err);

            log("\x1b[31mpurging\x1b[0m all information on client %s", this.id);

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

    call_callback(callback: string, ...args: any[]) {
        if (!this.callbacks.hasOwnProperty(callback)) return false;
        this.callbacks[callback].apply(this, args);
        this.callbacks[callback] = null;
    }


    connect(client: Client) {
        log('\x1b[1mconnecting\x1b[0m %s to %s', client.id, this.id);
        if (!(client.available && this.available)) {
            console.error('\x1b[31mfailed to connect\x1b[0m');

            // log(client.id + ': ' + (client.available ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m available');
            // log(client.id + ': ' + (client.occupied ? '\x1b[31mis' : '\x1b[32mnot') + '\x1b[0m occupied');
            // log(client.id + ': ' + (client.authenticated ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m authenticated');

            // log(this.id + ': ' + (this.available ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m available');
            // log(this.id + ': ' + (this.occupied ? '\x1b[31mis' : '\x1b[32mnot') + '\x1b[0m occupied');
            // log(this.id + ': ' + (this.authenticated ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m authenticated');
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
            // log(this.id + " socket closed");
            client.close();
        });

        client.socket.on('close', () => {
            // log(client.id + " socket closed");
            this.close();
        });

        return true;
    }

    write(buffer: Buffer, end = false) {
        // if (!(buffer.length == 2 && buffer[0] == 0 && buffer[1] == 0)) {
        //     log('sent to ' + this.id + ': ', buffer);
        // }

        try {
            if (end) {
                this.socket.write(buffer);
                setTimeout(() => {
                    this.socket.end();
                }, 5 * 1000);
            } else {
                this.socket.write(buffer);
            }
            return true;
        } catch (err) {
            return false;
        }

    }

    centralex_call() {
        if (this.callbacks.callAccept) return false;

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


    send_reject(message: string) {
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


export default Client;
