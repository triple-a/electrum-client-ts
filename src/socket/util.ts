type RecursiveParserCallback = (buffer: string) => void;

type RecursiveParserReturnType = {
  code: number;
  buffer: string;
};

type RecursiveParser = (
  n: number,
  buffer: string,
  callback: RecursiveParserCallback,
) => RecursiveParserReturnType;

function createRecursiveParser(maxDepth: number, delimiter: string) {
  const MAX_DEPTH = maxDepth;
  const DELIMITER = delimiter;

  const recursiveParser = (
    recursionDepth: number,
    buffer: string,
    callback: RecursiveParserCallback,
  ): RecursiveParserReturnType => {
    if (buffer.length === 0) {
      return { code: 0, buffer: buffer };
    }
    if (recursionDepth > MAX_DEPTH) {
      // recursiveParser restarted and  recursionDepth will be reset to 0
      return { code: 1, buffer: buffer };
    }
    const xs = buffer.split(DELIMITER);
    if (xs.length === 1) {
      return { code: 0, buffer: buffer };
    }
    callback(xs.shift() || '');
    return recursiveParser(recursionDepth + 1, xs.join(DELIMITER), callback);
  };
  return recursiveParser;
}

export class MessageParser {
  private buffer: string;
  private callback: RecursiveParserCallback;
  private recursiveParser: RecursiveParser;

  constructor(callback: RecursiveParserCallback) {
    this.buffer = '';
    this.callback = callback;
    this.recursiveParser = createRecursiveParser(20, '\n');
  }

  run(chunk: Buffer | string) {
    this.buffer += chunk;
    while (true) {
      const res = this.recursiveParser(0, this.buffer, this.callback);
      this.buffer = res.buffer;
      if (res.code === 0) {
        break;
      }
    }
  }
}
