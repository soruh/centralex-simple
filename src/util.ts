function makePackageSkeleton(type: number, length = 0) {
    let buffer = Buffer.alloc(length + 2);
    buffer[0] = type;
    buffer[1] = length;

    return buffer;
}


function log(...args: any[]) {
    const timestamp = new Date(Date.now() + new Date().getTimezoneOffset() * (-60 * 1000))
        .toISOString()
        .replace('T', ' ')
        .slice(0, -1);
    if (typeof args[0] === "string") {
        args[0] = timestamp + ': ' + args[0];
    } else {
        args.unshift(timestamp + ':');
    }
    console.log(...args);
}


export {
    makePackageSkeleton,
    log,
};
