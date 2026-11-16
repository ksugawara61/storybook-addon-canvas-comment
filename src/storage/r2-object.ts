/** The subset of Cloudflare's `R2Bucket` the R2 stores use, so Node code can type it too. */
export type R2BucketLike = {
  get(key: string): Promise<{ etag: string; text(): Promise<string> } | null>;
  /** Resolves to null when the `onlyIf` precondition fails. */
  put(
    key: string,
    value: string,
    options?: {
      httpMetadata?: { contentType?: string };
      onlyIf?: { etagDoesNotMatch?: string; etagMatches?: string };
    },
  ): Promise<unknown>;
};

const MAX_ATTEMPTS = 8;

/** `next` is null when nothing changed, so nothing is written. */
export type R2Change<T, R> = { next: T | null; result: R };

export type R2JsonCodec<T> = {
  /** The value of an object that does not exist yet. */
  empty: () => T;
  parse: (raw: unknown) => T;
  serialize: (value: T) => string;
};

/**
 * One JSON object in R2. Every write is conditional on the etag it read, so a
 * concurrent writer makes it re-read and retry instead of losing data.
 */
export class R2JsonObject<T> {
  readonly #bucket: R2BucketLike;
  readonly #codec: R2JsonCodec<T>;
  readonly #key: string;

  constructor(bucket: R2BucketLike, key: string, codec: R2JsonCodec<T>) {
    this.#bucket = bucket;
    this.#codec = codec;
    this.#key = key;
  }

  async read(): Promise<T> {
    return (await this.#load()).value;
  }

  async mutate<R>(change: (value: T) => R2Change<T, R>): Promise<R> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const { etag, value } = await this.#load();
      const { next, result } = change(value);

      if (!next) {
        return result;
      }

      const stored = await this.#bucket.put(
        this.#key,
        this.#codec.serialize(next),
        {
          httpMetadata: { contentType: "application/json" },
          // A missing object may only be created if nobody created it meanwhile.
          onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
        },
      );

      if (stored) {
        return result;
      }
    }

    throw new Error(
      `Could not save ${this.#key}: it kept changing during ${MAX_ATTEMPTS} attempts.`,
    );
  }

  async #load(): Promise<{ etag: string | null; value: T }> {
    const object = await this.#bucket.get(this.#key);

    if (!object) {
      return { etag: null, value: this.#codec.empty() };
    }

    return {
      etag: object.etag,
      value: this.#codec.parse(JSON.parse(await object.text())),
    };
  }
}
