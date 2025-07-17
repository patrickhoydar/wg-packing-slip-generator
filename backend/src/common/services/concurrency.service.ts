import { Injectable } from '@nestjs/common';

class Limiter {
  private running = 0;
  private queue: ((value: unknown) => void)[] = [];

  constructor(private maxConcurrent: number) {}

  async add<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.running++;

    try {
      return await fn();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next?.(undefined);
      }
    }
  }
}

@Injectable()
export class ConcurrencyService {
  createLimiter(maxConcurrent: number) {
    return new Limiter(maxConcurrent);
  }
}