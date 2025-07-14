import type * as types from "./types.ts";
import { EOFError, ErrorReplyError, InvalidStateError } from "../errors.ts";
import { decoder, encoder } from "../utils.ts";
import { Buffer } from "@std/streams";

// Enhanced buffered reader using @std/streams Buffer for better performance
class StreamBuffer {
  private buffer = new Buffer();
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;

  constructor(reader: ReadableStreamDefaultReader<Uint8Array>) {
    this.reader = reader;
    this.writer = this.buffer.writable.getWriter();
  }

  async readLine(): Promise<Uint8Array | null> {
    while (true) {
      // Check if we have a complete line in buffer using optimized approach
      const data = this.buffer.bytes();
      const crlfIndex = this.findCRLF(data);

      if (crlfIndex !== -1) {
        const line = data.subarray(0, crlfIndex);
        const remaining = data.subarray(crlfIndex + 2);
        await this.resetBuffer(remaining);
        return line;
      }

      // Need more data
      const { value, done } = await this.reader.read();
      if (done) {
        if (this.buffer.length > 0) {
          const remaining = this.buffer.bytes();
          await this.resetBuffer();
          return remaining;
        }
        return null;
      }

      if (value) {
        await this.writer.write(value);
      }
    }
  }

  async readBytes(length: number): Promise<Uint8Array> {
    // Ensure we have enough data in buffer efficiently
    await this.ensureBufferSize(length);

    const data = this.buffer.bytes();
    if (data.length < length) {
      throw new InvalidStateError("Unexpected end of stream");
    }

    const result = data.subarray(0, length);
    const remaining = data.subarray(length);
    await this.resetBuffer(remaining);
    return result;
  }

  async peek(length: number): Promise<Uint8Array | null> {
    // Try to fill buffer to at least the requested length
    await this.ensureBufferSize(length);

    const data = this.buffer.bytes();
    if (data.length === 0) {
      return null;
    }

    return data.subarray(0, Math.min(length, data.length));
  }

  // Efficient method to ensure buffer has at least `minSize` bytes
  private async ensureBufferSize(minSize: number): Promise<void> {
    while (this.buffer.length < minSize) {
      const { value, done } = await this.reader.read();
      if (done) {
        break; // Can't read more data
      }
      if (value) {
        await this.writer.write(value);
      }
    }
  }

  // Optimized CRLF finder
  private findCRLF(data: Uint8Array): number {
    // Look for \r\n (13, 10) - Redis protocol uses CRLF line endings
    for (let i = 0; i < data.length - 1; i++) {
      if (data[i] === 13 && data[i + 1] === 10) {
        return i;
      }
    }
    return -1;
  }

  private async resetBuffer(data?: Uint8Array): Promise<void> {
    // Release the current writer
    this.writer.releaseLock();
    // Reset the buffer efficiently using Buffer's built-in reset method
    this.buffer.reset();
    // Get a new writer
    this.writer = this.buffer.writable.getWriter();
    // Write the remaining data if provided
    if (data && data.length > 0) {
      await this.writer.write(data);
    }
  }
}

const IntegerReplyCode = ":".charCodeAt(0);
const BulkReplyCode = "$".charCodeAt(0);
const SimpleStringCode = "+".charCodeAt(0);
const ArrayReplyCode = "*".charCodeAt(0);
const ErrorReplyCode = "-".charCodeAt(0);

export async function readReply(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<types.RedisReply> {
  const bufferedReader = new StreamBuffer(reader);
  const firstByte = await bufferedReader.peek(1);

  if (!firstByte || firstByte.length === 0) {
    throw new EOFError();
  }

  const code = firstByte[0];
  if (code === ErrorReplyCode) {
    const line = await bufferedReader.readLine();
    if (line) {
      tryParseErrorReply(line);
    }
  }

  switch (code) {
    case IntegerReplyCode:
      return IntegerReply.decode(bufferedReader);
    case SimpleStringCode:
      return SimpleStringReply.decode(bufferedReader);
    case BulkReplyCode:
      return BulkReply.decode(bufferedReader);
    case ArrayReplyCode:
      return ArrayReply.decode(bufferedReader);
    default:
      throw new InvalidStateError(
        `unknown code: '${String.fromCharCode(code)}' (${code})`,
      );
  }
}

abstract class BaseReply implements types.RedisReply {
  constructor(readonly code: number) {}

  buffer(): Uint8Array {
    throw createDecodeError(this.code, "buffer");
  }

  string(): string {
    throw createDecodeError(this.code, "string");
  }

  bulk(): types.Bulk {
    throw createDecodeError(this.code, "bulk");
  }

  integer(): types.Integer {
    throw createDecodeError(this.code, "integer");
  }

  array(): types.ConditionalArray | types.BulkNil {
    throw createDecodeError(this.code, "array");
  }

  abstract value(): types.Raw;
}

class SimpleStringReply extends BaseReply {
  static async decode(reader: StreamBuffer): Promise<types.RedisReply> {
    const body = await readSimpleStringReplyBody(reader);
    return new SimpleStringReply(body);
  }

  readonly #body: Uint8Array;
  constructor(body: Uint8Array) {
    super(SimpleStringCode);
    this.#body = body;
  }

  override bulk() {
    return this.string();
  }

  override buffer() {
    return this.#body;
  }

  override string() {
    return decoder.decode(this.#body);
  }

  override value() {
    return this.string();
  }
}

class BulkReply extends BaseReply {
  static async decode(reader: StreamBuffer): Promise<types.RedisReply> {
    const body = await readBulkReplyBody(reader);
    return new BulkReply(body);
  }

  readonly #body: Uint8Array | null;
  private constructor(body: Uint8Array | null) {
    super(BulkReplyCode);
    this.#body = body;
  }

  override bulk() {
    return this.#body ? decoder.decode(this.#body) : null;
  }

  override buffer() {
    return this.#body ?? new Uint8Array();
  }

  override string() {
    return decoder.decode(this.#body ?? new Uint8Array());
  }

  override value() {
    return this.bulk();
  }
}

class IntegerReply extends BaseReply {
  static async decode(reader: StreamBuffer): Promise<types.RedisReply> {
    const body = await readIntegerReplyBody(reader);
    return new IntegerReply(body);
  }

  readonly #body: Uint8Array;
  private constructor(body: Uint8Array) {
    super(IntegerReplyCode);
    this.#body = body;
  }

  override integer() {
    return parseInt(decoder.decode(this.#body));
  }

  override string() {
    return this.integer().toString();
  }

  override value() {
    return this.integer();
  }
}

class ArrayReply extends BaseReply {
  static async decode(reader: StreamBuffer): Promise<types.RedisReply> {
    const body = await readArrayReplyBody(reader);
    return new ArrayReply(body);
  }

  readonly #body: types.ConditionalArray | types.BulkNil;
  private constructor(body: types.ConditionalArray | types.BulkNil) {
    super(ArrayReplyCode);
    this.#body = body;
  }

  override array() {
    return this.#body;
  }

  override value() {
    return this.array();
  }
}

async function readIntegerReplyBody(reader: StreamBuffer): Promise<Uint8Array> {
  const line = await reader.readLine();
  if (line == null) {
    throw new InvalidStateError();
  }

  return line.subarray(1, line.length);
}

async function readBulkReplyBody(
  reader: StreamBuffer,
): Promise<Uint8Array | null> {
  const line = await reader.readLine();
  if (line == null) {
    throw new InvalidStateError();
  }

  if (line[0] !== BulkReplyCode) {
    tryParseErrorReply(line);
  }

  const size = parseSize(line);
  if (size < 0) {
    // nil bulk reply
    return null;
  }

  // Read the bulk data more efficiently
  const bulkData = await reader.readBytes(size);
  // Read and discard the trailing CRLF
  const crlf = await reader.readBytes(2);

  // Validate CRLF
  if (crlf[0] !== 13 || crlf[1] !== 10) {
    throw new InvalidStateError("Expected CRLF after bulk data");
  }

  return bulkData;
}

async function readSimpleStringReplyBody(
  reader: StreamBuffer,
): Promise<Uint8Array> {
  const line = await reader.readLine();
  if (line == null) {
    throw new InvalidStateError();
  }

  if (line[0] !== SimpleStringCode) {
    tryParseErrorReply(line);
  }
  return line.subarray(1, line.length);
}

export async function readArrayReplyBody(
  reader: StreamBuffer,
): Promise<types.ConditionalArray | types.BulkNil> {
  const line = await reader.readLine();
  if (line == null) {
    throw new InvalidStateError();
  }

  const argCount = parseSize(line);
  if (argCount === -1) {
    // `-1` indicates a null array
    return null;
  }

  // Pre-allocate array for better performance
  const array: types.ConditionalArray = new Array(argCount);

  for (let i = 0; i < argCount; i++) {
    const peek = await reader.peek(1);
    if (peek === null) {
      throw new EOFError();
    }

    const code = peek[0];
    switch (code) {
      case SimpleStringCode: {
        const reply = await SimpleStringReply.decode(reader);
        array[i] = reply.string();
        break;
      }
      case BulkReplyCode: {
        const reply = await BulkReply.decode(reader);
        array[i] = reply.bulk();
        break;
      }
      case IntegerReplyCode: {
        const reply = await IntegerReply.decode(reader);
        array[i] = reply.integer();
        break;
      }
      case ArrayReplyCode: {
        const reply = await ArrayReply.decode(reader);
        array[i] = reply.value();
        break;
      }
      default: {
        throw new InvalidStateError(`Unknown reply code: ${code}`);
      }
    }
  }
  return array;
}

export const okReply = new SimpleStringReply(encoder.encode("OK"));

function tryParseErrorReply(line: Uint8Array): never {
  const code = line[0];
  if (code === ErrorReplyCode) {
    throw new ErrorReplyError(decoder.decode(line));
  }
  throw new Error(`invalid line: ${line}`);
}

function parseSize(line: Uint8Array): number {
  const sizeStr = line.subarray(1, line.length);
  const size = parseInt(decoder.decode(sizeStr));
  return size;
}

function createDecodeError(code: number, expectedType: string): Error {
  return new InvalidStateError(
    `cannot decode '${
      String.fromCharCode(code)
    }' type as \`${expectedType}\` value`,
  );
}
