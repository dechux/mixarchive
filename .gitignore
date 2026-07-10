export class Logger {
  constructor(prefix = "MixArchive") {
    this.prefix = prefix;
    this.startTime = Date.now();
  }

  timestamp() {
    return new Date().toISOString();
  }

  info(message) {
    console.log(`[INFO] ${this.timestamp()} [${this.prefix}] ${message}`);
  }

  warn(message) {
    console.warn(`[WARN] ${this.timestamp()} [${this.prefix}] ${message}`);
  }

  error(message, error = null) {
    console.error(`[ERROR] ${this.timestamp()} [${this.prefix}] ${message}`);

    if (error) {
      console.error(error);
    }
  }

  success(message) {
    console.log(`✅ ${message}`);
  }

  finish() {
    const seconds = ((Date.now() - this.startTime) / 1000).toFixed(2);

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`MixArchive Finished`);
    console.log(`Elapsed : ${seconds} sec`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }
}