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

  type Hook = (elt: any, detail?: any) => void;
  let ext: {
    htmx_after_process: Hook;
    htmx_before_swap: Hook;
    htmx_before_cleanup: Hook;
  };

  // Per-test call logs (reset in beforeEach)
  let fetchUrls: string[] = [];
  let htmxTriggerCalls: { elt: any; name: string; detail?: any }[] = [];
  let consoleErrors: any[][] = [];
  let intervals: { id: number; ms: number; cb: () => void; cleared: boolean }[] =
    [];
  let nextIntervalId = 0;
  let fetchResponse: () => any;

  // Drains the promise chain in remoteFetch without counting microtask hops.
  const flush = () => new Promise((r) => setTimeout(r, 0));

  beforeAll(async () => {
    (globalThis as any).window = globalThis as any;

    // Capture extension definition during module import.
    let extName: any = null;
    let extDef: any = null;
    (globalThis as any).htmx = {
      registerExtension: (name: string, def: any) => {
        extName = name;
        extDef = def;
      },
      trigger: (_elt: any, _name: string, _detail?: any) => {},
    };

    await import("./htmx-echarts.js");

    expect(extName).toBe("echarts");
    expect(typeof extDef?.htmx_after_process).toBe("function");
    expect(typeof extDef?.htmx_before_swap).toBe("function");
    expect(typeof extDef?.htmx_before_cleanup).toBe("function");
    ext = extDef;
  });

  beforeEach(() => {
    fetchUrls = [];
    htmxTriggerCalls = [];
    consoleErrors = [];
    intervals = [];
    nextIntervalId = 0;

    console.error = (...args: any[]) => {
      consoleErrors.push(args);
    };

    // Overridable per test so failure paths can be exercised.
    fetchResponse = () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ series: [{ type: "line", data: [1, 2, 3] }] }),
    });

    (globalThis as any).fetch = async (url: string) => {
      fetchUrls.push(url);
      return fetchResponse();
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
        const handlers: Record<string, ((p: any) => void)[]> = {};
        let setOptionCalls: any[] = [];
        let disposeCalled = 0;
        let resizeCalled = 0;
        let showLoadingCalled = 0;
        let hideLoadingCalled = 0;
        const chart = {
          setOption: (opt: any) => setOptionCalls.push(opt),
          showLoading: () => {
            showLoadingCalled++;
          },
          hideLoading: () => {
            hideLoadingCalled++;
          },
          dispose: () => {
            disposeCalled++;
          },
          isDisposed: () => disposeCalled > 0,
          resize: () => {
            resizeCalled++;
          },
          on: (ev: string, fn: (p: any) => void) => {
            (handlers[ev] ||= []).push(fn);
          },
          __emit: (ev: string, params: any) => {
            (handlers[ev] || []).forEach((fn) => fn(params));
          },
          __calls: () => ({
            setOptionCalls,
            disposeCalled,
            resizeCalled,
            showLoadingCalled,
            hideLoadingCalled,
          }),
        };
        return chart;
      },
    };

    (globalThis as any).htmx.trigger = (elt: any, name: string, detail?: any) => {
      htmxTriggerCalls.push({ elt, name, detail });
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

  test("htmx:after:process initializes charts; fetch path when no data-sse-event", async () => {
    const c = el({ url: "/initial.json", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.htmx_after_process(root, {});

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

    ext.htmx_after_process(root, {});

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

    ext.htmx_after_process(root, {});

    expect(c._sseSource).toBeTruthy();
    expect(intervals).toHaveLength(0);
  });

  test("htmx:after:process initializes charts; SSE path when data-sse-event present", () => {
    const c = el({ url: "/sse", sseEvent: "point", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.htmx_after_process(root, {});

    expect(c._sseSource).toBeTruthy();
    c._sseSource.emit("point", JSON.stringify({ xAxis: { type: "value" } }));

    const { setOptionCalls } = c._chartInstance.__calls();
    expect(setOptionCalls).toHaveLength(1);
  });

  test("bad SSE JSON is logged and ignored", () => {
    const c = el({ url: "/sse", sseEvent: "point", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.htmx_after_process(root, {});

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

    ext.htmx_after_process(root, {});

    expect(a._chartInstance).toBeTruthy();
    expect(b._chartInstance).toBeTruthy();
    expect(b._sseSource).toBeTruthy();
  });

  test("initializes the processed root itself when it is a chart", () => {
    // htmx 4 calls process() on each swapped-in node, so the root can be the chart.
    const c = {
      ...el({ url: "/root.json", chartType: "line" }),
      matches: (sel: string) => sel === "[data-chart-type]",
    };

    ext.htmx_after_process(c, {});

    expect(c._chartInstance).toBeTruthy();
  });

  test("does not re-initialize a chart that is processed twice", () => {
    const c = el({ url: "/initial.json", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.htmx_after_process(root, {});
    const chart = c._chartInstance;
    ext.htmx_after_process(root, {});

    expect(c._chartInstance).toBe(chart);
  });

  test("htmx:before:swap cleans up charts inside each swap target", () => {
    const c = el({ url: "/sse", sseEvent: "tick", chartType: "line" });
    const target = { querySelectorAll: (_sel: string) => [c] };

    ext.htmx_after_process(target, {});

    const src = c._sseSource;
    const chart = c._chartInstance;

    ext.htmx_before_swap(null, { tasks: [{ target }] });

    expect(c._chartInstance).toBe(null);
    expect(src.closeCalled).toBe(1);
    expect(chart.__calls().disposeCalled).toBe(1);
  });

  test("htmx:before:swap leaves charts alone for morph and none swaps", () => {
    const c = el({ url: "/sse", sseEvent: "tick", chartType: "line" });
    const target = { querySelectorAll: (_sel: string) => [c] };

    ext.htmx_after_process(target, {});
    const chart = c._chartInstance;

    // Morph preserves matching elements, so the chart div is still there afterwards.
    ext.htmx_before_swap(null, {
      tasks: [
        { target, swapSpec: { style: "innerMorph" } },
        { target, swapSpec: { style: "outerMorph" } },
        { target, swapSpec: "none" },
      ],
    });

    expect(c._chartInstance).toBe(chart);
    expect(chart.__calls().disposeCalled).toBe(0);
  });

  test("a fetch that lands after disposal does not touch the chart", async () => {
    const c = el({ url: "/slow.json", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    let release: (v: any) => void = () => {};
    fetchResponse = () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => new Promise((r) => (release = r)),
    });

    ext.htmx_after_process(root, {});
    const chart = c._chartInstance;

    // Swap disposes the chart while the request is still outstanding.
    ext.htmx_before_cleanup(root, {});
    release({ series: [] });
    await flush();

    expect(chart.__calls().setOptionCalls).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test("a non-OK response is reported and never reaches setOption", async () => {
    const c = el({ url: "/missing.json", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    fetchResponse = () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ error: "nope" }),
    });

    ext.htmx_after_process(root, {});
    await flush();

    expect(c._chartInstance.__calls().setOptionCalls).toHaveLength(0);
    expect(consoleErrors.length).toBeGreaterThan(0);
    expect(String(consoleErrors[0])).toContain("404");
  });

  test("polling skips a tick while the previous request is still in flight", async () => {
    const c = el({ url: "/slow.json poll:1000ms", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    let release: (v: any) => void = () => {};
    fetchResponse = () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => new Promise((r) => (release = r)),
    });

    ext.htmx_after_process(root, {});
    await flush();
    expect(fetchUrls).toHaveLength(1);

    // Three ticks while the first poll is unresolved must issue one request, not three.
    intervals[0]!.cb();
    await flush();
    intervals[0]!.cb();
    intervals[0]!.cb();
    await flush();

    expect(fetchUrls).toHaveLength(2);

    release({ series: [] });
    await flush();

    intervals[0]!.cb();
    await flush();
    expect(fetchUrls).toHaveLength(3);
  });

  test("htmx:before:cleanup cleans up charts", () => {
    const c = el({ url: "/sse", sseEvent: "tick", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.htmx_after_process(root, {});

    const src = c._sseSource;
    const chart = c._chartInstance;
    const ro = c._resizeObserver;

    ext.htmx_before_cleanup(root, {});

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

    ext.htmx_after_process(root, {});

    expect(intervals).toHaveLength(1);
    expect(c._pollIntervalId).toBe(intervals[0]!.id);

    ext.htmx_before_cleanup(root, {});

    expect(intervals[0]!.cleared).toBe(true);
    expect(c._pollIntervalId).toBe(null);
  });

  test("bridges ECharts click and mouseover to htmx.trigger on the chart element", async () => {
    const c = el({ url: "/initial.json", chartType: "line" });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.htmx_after_process(root, {});

    await Promise.resolve();
    await Promise.resolve();

    const chart = c._chartInstance as {
      __emit: (ev: string, params: Record<string, unknown>) => void;
    };
    chart.__emit("click", { name: "A", value: 42, seriesIndex: 0, dataIndex: 1 });
    chart.__emit("mouseover", { name: "B", value: 7 });

    expect(htmxTriggerCalls).toHaveLength(2);
    expect(htmxTriggerCalls[0]!.elt).toBe(c);
    expect(htmxTriggerCalls[0]!.name).toBe("chart-click");
    expect(htmxTriggerCalls[0]!.detail).toMatchObject({ name: "A", value: 42 });
    expect(htmxTriggerCalls[1]!.name).toBe("chart-hover");
    expect(htmxTriggerCalls[1]!.detail).toMatchObject({ name: "B", value: 7 });
  });

  test("data-chart-bridge=false disables the HTMX event bridge", async () => {
    const c = el({
      url: "/initial.json",
      chartType: "line",
      chartBridge: "false",
    });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.htmx_after_process(root, {});

    await Promise.resolve();
    await Promise.resolve();

    const chart = c._chartInstance as {
      __emit: (ev: string, params: Record<string, unknown>) => void;
    };
    chart.__emit("click", { name: "A", value: 1 });

    expect(htmxTriggerCalls).toHaveLength(0);
  });

  test("data-chart-event-click and data-chart-event-hover override event names", async () => {
    const c = el({
      url: "/initial.json",
      chartType: "line",
      chartEventClick: "slice-pick",
      chartEventHover: "slice-hover",
    });
    const root = { querySelectorAll: (_sel: string) => [c] };

    ext.htmx_after_process(root, {});

    await Promise.resolve();
    await Promise.resolve();

    const chart = c._chartInstance as {
      __emit: (ev: string, params: Record<string, unknown>) => void;
    };
    chart.__emit("click", { name: "X" });
    chart.__emit("mouseover", { name: "Y" });

    expect(htmxTriggerCalls.map((t) => t.name)).toEqual(["slice-pick", "slice-hover"]);
  });
});

