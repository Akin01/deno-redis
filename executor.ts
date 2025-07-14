import type { Connection } from "./connection.ts";
import { ConnectionClosedError, EOFError } from "./errors.ts";
import { sendCommand } from "./protocol/mod.ts";
import type { RedisReply, RedisValue } from "./protocol/mod.ts";

export interface CommandExecutor {
	readonly connection: Connection;
	exec(
		command: string,
		...args: RedisValue[]
	): Promise<RedisReply>;

	/**
	 * Closes a redis connection.
	 */
	close(): void;
}

type QueuedCommand = {
	command: string;
	args: RedisValue[];
	promise: Promise<RedisReply>;
	resolve: (value: RedisReply) => void;
	reject: (reason?: unknown) => void;
};

function isRetriableError(error: unknown, connection: Connection): boolean {
	if (connection.isClosed) {
		// Connection was explicitly closed, so don't retry.
		return false;
	}
	return (
		error instanceof Deno.errors.BadResource ||
		error instanceof Deno.errors.BrokenPipe ||
		error instanceof Deno.errors.ConnectionAborted ||
		error instanceof Deno.errors.ConnectionRefused ||
		error instanceof Deno.errors.ConnectionReset ||
		error instanceof EOFError
	);
}

export class MuxExecutor implements CommandExecutor {
	private queue: QueuedCommand[] = [];
	private isProcessing = false;

	constructor(readonly connection: Connection) {}

	exec(
		command: string,
		...args: RedisValue[]
	): Promise<RedisReply> {
		if (this.connection.isClosed) {
			return Promise.reject(new ConnectionClosedError("Connection is closed"));
		}

		const { promise, resolve, reject } = Promise.withResolvers<RedisReply>();
		this.queue.push({ command, args, promise, resolve, reject });
		if (!this.isProcessing) {
			this.dequeue();
		}
		return promise;
	}

	close(): void {
		this.connection.close();
	}

	private async dequeue(): Promise<void> {
		if (this.isProcessing) return;

		const item = this.queue[0];
		if (!item) {
			this.isProcessing = false;
			return;
		}

		this.isProcessing = true;

		try {
			const reply = await sendCommand(
				this.connection.writer,
				this.connection.reader,
				item.command,
				...item.args,
			);
			item.resolve(reply);
			this.queue.shift(); // Command succeeded, remove from queue.
		} catch (error) {
			if (
				this.connection.maxRetryCount > 0 &&
				isRetriableError(error, this.connection)
			) {
				try {
					await this.connection.reconnect();
					// Don't shift the item from the queue, we will retry it.
				} catch (reconnectError) {
					item.reject(reconnectError);
					this.queue.shift(); // Reconnect failed, reject and remove.
				}
			} else {
				item.reject(error);
				this.queue.shift(); // Non-retriable error, reject and remove.
			}
		} finally {
			this.isProcessing = false;
			// Process next item in queue, which might be the retried item or a new one.
			if (this.queue.length > 0) {
				this.dequeue();
			}
		}
	}
}
