import { performance } from "perf_hooks";

const mockQueueStore = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    remove: async (id: string) => {
        return new Promise<void>(resolve => setTimeout(resolve, 10)); // simulate 10ms I/O
    }
};

async function original(items: {id: string}[]) {
    const start = performance.now();
    for (const item of items) {
        await mockQueueStore.remove(item.id);
    }
    return performance.now() - start;
}

async function optimized(items: {id: string}[]) {
    const start = performance.now();
    const promises = [];
    for (const item of items) {
        promises.push(mockQueueStore.remove(item.id));
    }
    await Promise.all(promises);
    return performance.now() - start;
}

async function run() {
    const items = Array.from({length: 50}, (_, i) => ({id: String(i)}));

    const origTime = await original(items);
    console.log(`Original: ${origTime.toFixed(2)}ms`);

    const optTime = await optimized(items);
    console.log(`Optimized: ${optTime.toFixed(2)}ms`);
}

run();
