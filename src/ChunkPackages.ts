import { Transform, TransformOptions } from "stream";

class ChunkPackages extends Transform {
	public buffer = Buffer.alloc(0);
	constructor(options?: TransformOptions) {
		super(options);
	}
	public _transform(chunk: Buffer, encoding: string, callback: (err?: Error, data?: Buffer) => void) {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		let packageLength = (this.buffer[1] + 2) || Infinity;

		while (packageLength <= this.buffer.length) {
			this.push(this.buffer.slice(0, packageLength));
			this.buffer = this.buffer.slice(packageLength);

			packageLength = (this.buffer[1] + 2) || Infinity;
		}
		callback();
	}
}
export default ChunkPackages;
