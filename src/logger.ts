/**
 * Simple logger that only outputs if debug mode is enabled.
 */
export class Logger {
  private debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  log(...args: any[]): void {
    if (this.debug) {
      console.log(...args);
    }
  }

  warn(...args: any[]): void {
    if (this.debug) {
      console.warn(...args);
    }
  }

  error(...args: any[]): void {
    if (this.debug) {
      console.error(...args);
    }
  }
}
