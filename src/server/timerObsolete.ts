export class TimerObsoleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimerObsoleteError";
  }
}
