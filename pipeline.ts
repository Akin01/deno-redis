import type { Connection } from "./connection.ts";
import { CommandExecutor } from "./executor.ts";
import {
	okReply,
	RawOrError,
	RedisReply,
	RedisValue,
	sendCommands,
} from "./protocol/mod.ts";
import { create, Redis } from "./redis.ts";

export interface RedisPipeline extends Redis {
	flush(): Promise<RawOrError[]>;
}

export function createRedisPipeline(
	connection: Connection,
	tx = false,
): RedisPipeline {
	const executor = new PipelineExecutor(connection, tx);
	const client = create(executor);
	return Object.assign(client, {
		flush: () => executor.flush(),
	});
}

interface QueuedCommand {
	command: string;
	args: RedisValue[];
}

export class PipelineExecutor implements CommandExecutor {
	private commands: QueuedCommand[] = [];

	constructor(
		readonly connection: Connection,
		private tx: boolean,
	) {}

	exec(command: string, ...args: RedisValue[]): Promise<RedisReply> {
		this.commands.push({ command, args });
		return Promise.resolve(okReply);
	}

	close(): void {
		this.connection.close();
	}

	async flush(): Promise<RawOrError[]> {
		let commandsToFlush: QueuedCommand[] = [...this.commands];
		this.commands = [];

		if (this.tx) {
			commandsToFlush = [
				{ command: "MULTI", args: [] },
				...commandsToFlush,
				{ command: "EXEC", args: [] },
			];
		}

		if (commandsToFlush.length === 0) {
			return [];
		}

		try {
			const replies = await sendCommands(
				this.connection.writer,
				this.connection.reader,
				commandsToFlush,
			);
			return replies;
		} catch (error) {
			throw error;
		}
	}
}
