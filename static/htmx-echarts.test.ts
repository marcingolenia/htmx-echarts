import { describe, test, expect, beforeAll, beforeEach, afterAll } from "bun:test";

type Dataset = Record<string, string>;
type ChartEl = {
  dataset: Dataset;
  _sseSource: any;
  _pollIntervalId?: any;
  _chartInstance: any;
  _resizeObserver: any;
};

function el(dataset: Dataset): ChartEl {
  return { dataset, _sseSource: null, _pollIntervalId: null, _chartInstance: null, _resizeObserver: null };
}

describe("static/htmx-echarts.js", () => {
  const original = {
    window: (globalThis as any).window,
    fetch: (globalThis as any).fetch,
    EventSource: (globalThis as any).EventSource,
    ResizeObserver: (globalThis as any).ResizeObserver,
    setInterval: (globalThis as any).setInterval,
    clearInterval: (globalThis as any).clearInterval,
    htmx: (globalThis as any).htmx,
    echarts: (globalThis as any).echarts,
    consoleError: console.error,
  };

  let ext: { onEvent: (name: string, evt: any) => void };

  // Per-test call logs (reset in beforeEach)
  let fetchUrls: string[] = [];
  let consoleErrors: any[][] = [];
  let intervals: { id: number; ms: number; cb: () => void; cleared: boolean }[] =
    [];
  let nextIntervalId = 0;

  beforeAll(async () => {
    (globalThis as any).window = globalThis as any;

    // Capture extension definition during module import.
    let extName: any = null;
    let extDef: any = null;
    (globalThis as any).htmx = {
      defineExtension: (name: string, def: any) => {
        extName = name;
        extDef = def;
      },
    };

    await import("./htmx-echarts.js");

    expect(extName).toBe("echarts");
    expect(typeof extDef?.onEvent).toBe("function");
    ext = extDef;
  });

  beforeEach(() => {
    fetchUrls = [];
    consoleErrors = [];
    intervals = [];
    nextIntervalId = 0;

    console.error = (...args: any[]) => {
      consoleErrors.push(args);
    };

    (globalThis as any).fetch = async (url: string) => {
      fetchUrls.push(url);
      return {
        json: async () => ({ series: [{ type: "line", data: [1, 2, 3] }] }),
      };
    };

    class EventSourceStub {
      listeners = new Map<string, (ev: { data: string }) => void>();
      closeCalled = 0;
      constructor(public url: string) {}
      addEventListener(name: string, cb: (ev: { data: string }) => void) {
        this.listeners.set(name, cb);
      }
      emit(name: string, data: string) {
        this.listeners.get(name)?.({ data });
      }
      close() {
        this.closeCalled++;
      }
    }
    (globalThis as any).EventSource = EventSourceStub;

    class ResizeObserverStub {
      observeCalled = 0;
      disconnectCalled = 0;
      constructor(_cb: () => void) {}
      observe(_el: any) {
        this.observeCalled++;
      }
      disconnect() {
        this.disconnectCalled++;
      }
    }
    (globalThis as any).ResizeObserver = ResizeObserverStub;

    (globalThis as any).echarts = {
      init: (_el: any) => {
        let setOptionCalls: any[] = [];
        let disposeCalled = 0;
        let resizeCalled = 0;
        return {
          setOption: (opt: any) => setOptionCalls.push(opt),
          dispose: () => {
            disposeCalled++;
          },
          resize: () => {
            resizeCalled++;
          },
          __calls: () => ({ setOptionCalls, disposeCalled, resizeCalled }),
        };
      },
    };

    (globalThis as any).setInterval = (cb: () => void, ms: number) => {
      const id = ++nextIntervalId;
      intervals.push({ id, ms, cb, cleared: false });
      return id;
    };
    (globalThis as any).clearInterval = (id: number) => {
      const it = intervals.find((x) => x.id === id);
      if (it) it.cleared = true;
    };
  });

  afterAll(() => {
    (globalThis as any).window = original.window;
    (globalThis as any).fetch = original.fetch;
    (globalThis as any).EventSource = original.EventSource;
    (globalThis as any).ResizeObserver = original.ResizeObserver;
    (globalThis as any).setInterval = original.setInterval;
    (globalThis as any).clearInterval = original.clearInterval;
    (globalThis as any).htmx = original.htmx;
    (globalThis as any).echarts = original.echarts;
    console.error = original.consoleError;
  });

  test("htmx:load initializes charts; fetch path when no data-sse-event", async () => {
    const c = el({ url: "/initial.json", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.onEvent("htmx:load", { detail: { elt: root }, target: root });

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchUrls).toEqual(["/initial.json"]);
    expect(c._sseSource).toBe(null);
    expect(c._pollIntervalId).toBe(null);
    expect(c._chartInstance).toBeTruthy();
    expect(c._resizeObserver).toBeTruthy();
  });

  test("polling: parses poll:1000ms and refetches on interval tick", async () => {
    const c = el({ url: "/poll.json poll:1000ms", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.onEvent("htmx:load", { detail: { elt: root }, target: root });

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchUrls).toEqual(["/poll.json"]);
    expect(intervals.map((i) => i.ms)).toEqual([1000]);
    expect(typeof intervals[0]?.cb).toBe("function");

    // simulate one poll tick
    intervals[0]!.cb();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchUrls).toEqual(["/poll.json", "/poll.json"]);
  });

  test("polling: poll token is ignored when SSE is used", () => {
    const c = el({
      url: "/sse poll:1000ms",
      sseEvent: "point",
      chartType: "line",
    });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.onEvent("htmx:load", { detail: { elt: root }, target: root });

    expect(c._sseSource).toBeTruthy();
    expect(intervals).toHaveLength(0);
  });

  test("htmx:load initializes charts; SSE path when data-sse-event present", () => {
    const c = el({ url: "/sse", sseEvent: "point", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.onEvent("htmx:load", { detail: { elt: root }, target: root });

    expect(c._sseSource).toBeTruthy();
    c._sseSource.emit("point", JSON.stringify({ xAxis: { type: "value" } }));

    const { setOptionCalls } = c._chartInstance.__calls();
    expect(setOptionCalls).toHaveLength(1);
  });

  test("bad SSE JSON is logged and ignored", () => {
    const c = el({ url: "/sse", sseEvent: "point", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.onEvent("htmx:load", { detail: { elt: root }, target: root });

    expect(() => c._sseSource.emit("point", "{not json")).not.toThrow();

    expect(consoleErrors.length).toBeGreaterThan(0);
    const { setOptionCalls } = c._chartInstance.__calls();
    expect(setOptionCalls).toHaveLength(0);
  });

  test("initializes all [data-chart-type] elements under the root", () => {
    const a = el({ url: "/a", chartType: "line" });
    const b = el({ url: "/b", chartType: "bar", sseEvent: "tick" });

    const root = {
      querySelectorAll: (sel: string) => {
        expect(sel).toBe("[data-chart-type]");
        return [a, b];
      },
    };

    ext.onEvent("htmx:load", { detail: { elt: root }, target: root });

    expect(a._chartInstance).toBeTruthy();
    expect(b._chartInstance).toBeTruthy();
    expect(b._sseSource).toBeTruthy();
  });

  test("htmx:beforeCleanupElement cleans up charts", () => {
    const c = el({ url: "/sse", sseEvent: "tick", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.onEvent("htmx:load", { detail: { elt: root }, target: root });

    const src = c._sseSource;
    const chart = c._chartInstance;
    const ro = c._resizeObserver;

    ext.onEvent("htmx:beforeCleanupElement", { target: root });

    expect(c._sseSource).toBe(null);
    expect(c._pollIntervalId).toBe(null);
    expect(c._chartInstance).toBe(null);
    expect(c._resizeObserver).toBe(null);

    expect(src.closeCalled).toBe(1);
    expect(chart.__calls().disposeCalled).toBe(1);
    expect(ro.disconnectCalled).toBe(1);
  });

  test("cleanup clears polling interval", () => {
    const c = el({ url: "/poll.json poll:1s", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.onEvent("htmx:load", { detail: { elt: root }, target: root });

    expect(intervals).toHaveLength(1);
    expect(c._pollIntervalId).toBe(intervals[0]!.id);

    ext.onEvent("htmx:beforeCleanupElement", { target: root });

    expect(intervals[0]!.cleared).toBe(true);
    expect(c._pollIntervalId).toBe(null);
  });
});

