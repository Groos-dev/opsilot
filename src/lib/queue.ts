type Job<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

/** Per-wallet serial queue so settle txs do not collide on nonce. */
export class WalletQueue {
  private readonly tails = new Map<string, Promise<unknown>>();

  enqueue<T>(walletKey: string, run: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(walletKey) ?? Promise.resolve();
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const result = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const next = prev
      .catch(() => undefined)
      .then(run)
      .then(resolve, reject);
    this.tails.set(
      walletKey,
      next.finally(() => {
        if (this.tails.get(walletKey) === next) this.tails.delete(walletKey);
      }),
    );
    return result;
  }
}

export const settleQueue = new WalletQueue();
