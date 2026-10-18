export function reloadQueue(read: () => Promise<void>): () => Promise<void> {
  let running = Promise.resolve();
  let active = false;
  let dirty = false;
  return () => {
    dirty = true;
    if (!active) {
      active = true;
      running = (async () => {
        try {
          while (dirty) {
            dirty = false;
            await read();
          }
        } finally {
          active = false;
        }
      })();
    }
    return running;
  };
}
