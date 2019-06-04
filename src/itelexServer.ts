import MultiPortServer from "./multiPortServer";
import Client from "./Client";
import { log } from "./util";
import { clients, savedRejectCodes } from "./globals";

const itelexServer = new MultiPortServer(async (socket, port: Port) => {
    const caller = new Client(socket, false);
    log("new centralex caller '%s' from ip %s", caller.id, socket.remoteAddress);

    socket.on('error', error => {
        socket.on('error', (error: Error & { code: string }) => {
            if (error.code === "ECONNRESET") {
                console.error("client " + caller.id + " reset the socket");
            } else if (error.code === "EPIPE" || error.code === "ERR_STREAM_WRITE_AFTER_END") {
                console.error("tried to write data to " + caller.id + " which is closed");
            } else {
                console.error('itelex socket error:', require('util').inspect(error));
            }
        });
    });

    socket.on('close', error => {
        log('caller %s disconnected', caller.id);
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
        } else if (called.occupied) {
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

export default itelexServer;
