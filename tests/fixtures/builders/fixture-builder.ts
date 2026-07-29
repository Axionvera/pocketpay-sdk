/**
 * Base fixture builder class
 * Provides common functionality for all fixture builders
 */
export abstract class FixtureBuilder<T> {
  protected data: Partial<T> = {};

  /**
   * Build the fixture
   */
  abstract build(): T;

  /**
   * Reset the builder to defaults
   */
  reset(): this {
    this.data = {};
    return this;
  }

  /**
   * Set a specific value
   */
  set<K extends keyof T>(key: K, value: T[K]): this {
    this.data[key] = value;
    return this;
  }

  /**
   * Merge with another builder
   */
  merge(other: Partial<T>): this {
    this.data = { ...this.data, ...other };
    return this;
  }

  /**
   * Clone the builder
   */
  clone(): this {
    const clone = new (this.constructor as any)();
    clone.data = { ...this.data };
    return clone;
  }

  /**
   * Validate the fixture
   */
  abstract validate(): boolean;

  /**
   * Get validation errors
   */
  abstract getErrors(): string[];
}
