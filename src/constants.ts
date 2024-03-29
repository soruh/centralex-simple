const PKG_END = 0x03;
const PKG_REJECT = 0x04;
const PKG_REM_CONNECT = 0x81;
const PKG_REM_CONFIRM = 0x82;
const PKG_REM_CALL = 0x83;
const PKG_REM_ACK = 0x84;

const AUTH_TIMEOUT = 30 * 1000;
const CALL_ACK_TIMEOUT = 30 * 1000
const PING_INTERVAL = 15 * 1000;
const TIMEOUT_DELAY = 35 * 1000;
const PORT_TIMEOUT = 60 * 60 * 1000


export {
    PKG_END,
    PKG_REJECT,
    PKG_REM_CONNECT,
    PKG_REM_CONFIRM,
    PKG_REM_CALL,
    PKG_REM_ACK,
    AUTH_TIMEOUT,
    CALL_ACK_TIMEOUT,
    PING_INTERVAL,
    TIMEOUT_DELAY,
    PORT_TIMEOUT,
};
