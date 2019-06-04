import "./prototypes/Buffer";
import "./prototypes/Map";

import itelexServer from "./itelexServer";
import centralexServer from "./centralexServer";
import debugServer from "./debugServer";
import { log } from "./util";



// itelexServer.on('listening', (port: number) => {
//     log('new itelex server on port: \x1b[36m%i\x1b[0m', port);
// });


itelexServer.on('close', (port: number) => {
    log('\x1b[31mclosed\x1b[0m port: \x1b[36m%i\x1b[0m', port);
});

centralexServer.listen(49491, () => {
    log("centralex server listening on port %d", 49491);
});

debugServer.listen(4885, () => {
    log("debug server listening on port %d", 4885);
});
