const shouldLog = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

function createLogger(fn: (...args: any[]) => void) {
  return (...args: any[]) => {
    if (shouldLog) {
      fn(...args);
    }
  };
}

export const logger = {
  info: createLogger(console.info.bind(console)),
  warn: createLogger(console.warn.bind(console)),
  error: createLogger(console.error.bind(console)),
};
