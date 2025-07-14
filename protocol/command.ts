import { Buffer } from "@std/streams/buffer";
import { readReply } from "./reply.ts";
import { ErrorReplyError } from "../errors.ts";
import { encoder } from "../utils.ts";
import type { RawOrError, RedisReply, RedisValue } from "./types.ts";

const CRLF = encoder.encode("\r\n");
const ArrayCode = encoder.encode("*");
const BulkCode = encoder.encode("$");

async function _writeCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  command: string,
  args: RedisValue[],
) {
  const _args = args.filter((v) => v !== void 0 && v !== null);

  await writer.write(ArrayCode);
  await writer.write(encoder.encode(String(1 + _args.length)));
  await writer.write(CRLF);
  await writer.write(BulkCode);
  await writer.write(encoder.encode(String(command.length)));
  await writer.write(CRLF);
  await writer.write(encoder.encode(command));
  await writer.write(CRLF);

  for (const arg of _args) {
    const bytes = arg instanceof Uint8Array ? arg : encoder.encode(String(arg));
    const bytesLen = bytes.byteLength;
    await writer.write(BulkCode);
    await writer.write(encoder.encode(String(bytesLen)));
    await writer.write(CRLF);
    await writer.write(bytes);
    await writer.write(CRLF);
  }
}

async function writeRequest(
  writableStream: WritableStreamDefaultWriter<Uint8Array>,
  command: string,
  args: RedisValue[],
) {
  const buffer = new Buffer();
  const writer = buffer.writable.getWriter();

  try {
    await _writeCommand(writer, command, args);
  } finally {
    writer.releaseLock();
  }

  // Write the entire buffer to the stream
  await writableStream.write(buffer.bytes());
}

export async function sendCommand(
  writer: WritableStream<Uint8Array>,
  reader: ReadableStream<Uint8Array>,
  command: string,
  ...args: RedisValue[]
): Promise<RedisReply> {
  const streamWriter = writer.getWriter();
  try {
    await writeRequest(streamWriter, command, args);
  } finally {
    streamWriter.releaseLock();
  }
  // Do not close the writer, connection should be reusable.

  const streamReader = reader.getReader();
  try {
    return await readReply(streamReader);
  } finally {
    streamReader.releaseLock();
  }
}

export async function sendCommands(
  writableStream: WritableStream<Uint8Array>,
  readableStream: ReadableStream<Uint8Array>,
  commands: {
    command: string;
    args: RedisValue[];
  }[],
): Promise<RawOrError[]> {
  if (commands.length === 0) {
    return [];
  }

  // Send commands sequentially to avoid stream locking issues that can occur
  // when batching commands in a single write operation followed by multiple reads.
  // While this approach is slightly less efficient than true batching, it provides
  // the pipeline API benefits while being more reliable across different Deno versions.
  const results: RawOrError[] = [];

  for (const { command, args } of commands) {
    try {
      const reply = await sendCommand(
        writableStream,
        readableStream,
        command,
        ...args,
      );
      results.push(reply.value());
    } catch (e) {
      if (e instanceof ErrorReplyError) {
        results.push(e);
      } else {
        throw e;
      }
    }
  }

  return results;
}
