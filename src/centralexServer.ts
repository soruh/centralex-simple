import { Server } from "net";
import { log } from "./util";
import Client from "./Client";
import ChunkPackages from "./ChunkPackages";
import { PKG_END, PKG_REJECT, PKG_REM_CONNECT, PKG_REM_ACK } from "./constants";
import { ports, savedRejectCodes, clients } from "./globals";


const centralexServer = new Server(socket => {
    const client = new Client(socket, true);
    log("new centralex client '%s' from ip %s", client.id, socket.remoteAddress);

    socket.on('error', (error: Error & { code: string }) => {
        if (error.code === "ECONNRESET") {
            console.error("client " + client.id + " reset the socket");
        } else if (error.code === "EPIPE" || error.code === "ERR_STREAM_WRITE_AFTER_END") {
            console.error("tried to write data to " + client.id + " which is closed");
        } else {
            console.error('centralex socket error:', error);
            log("error code: ", error.code);
        }
    });

    socket.on('close', () => {
        log('centralex client %s disconnected', client.id);
    });


    client.enableCentralex();


    const chunker = new ChunkPackages();

    chunker.on('data', async pkg => {
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
                        log("saving exit code \x1b[32m'%s'\x1b[0m for port \x1b[36m%i\x1b[0m", code, port);
                        savedRejectCodes.set(port, code);
                    }
                }
                client.close();
                // log('client reject:', content.readNullTermString());
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
                            } else {
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

export default centralexServer;
