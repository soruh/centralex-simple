declare global {
    interface Buffer {
        readNullTermString: (encoding?: string, start?: number, end?: number) => string;
    }
}
Buffer.prototype.readNullTermString =
    function readNullTermString(encoding: string = "utf8", start: number = 0, end: number = this.length): string {
        let firstZero = this.indexOf(0, start);
        let stop = firstZero >= start && firstZero <= end ? firstZero : end;
        return this.toString(encoding, start, stop);
    };

export default Buffer;
