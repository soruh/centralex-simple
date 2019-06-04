import { clients, ports, portTimeouts, savedRejectCodes } from "./globals";
import { Server } from "net";
import itelexServer from "./itelexServer";


function timeLeft(timeout: NodeJS.Timer) {
    let remaining = timeout["_idleTimeout"] + timeout["_idleStart"] - Math.floor(process.uptime() * 1000);
    if (remaining < 0) remaining = 0;
    return (remaining / 1000).toFixed(3);
}

function getStateProblems(): string[] {
    let openPorts = itelexServer.listPorts();

    let problems: string[] = [];
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


    for (let port of openPorts as Port[]) {
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

const debugServer = new Server(socket => {
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

export default debugServer;

