export class RingBuffer<T> {
  private readonly items: T[];
  private readonly capacity: number;
  private index = 0;
  private size = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.items = new Array<T>(capacity);
  }

  push(item: T): void {
    this.items[this.index] = item;
    this.index = (this.index + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }

  toArray(): T[] {
    const output: T[] = [];
    for (let i = 0; i < this.size; i += 1) {
      const pos = (this.index - 1 - i + this.capacity) % this.capacity;
      const value = this.items[pos];
      if (value !== undefined) {
        output.push(value);
      }
    }
    return output;
  }
}
