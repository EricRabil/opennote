<template>
  <div :class="{'codex-mq-root': true, 'codex-mq-focused': isFocused, 'codex-mq-popout': bigPopout}" v-resize="handleResize">
    <div class="mq-calc-root">
      <div
        :class="{'mq-editable-field': true, 'mq-math-mode': true}"
        ref="mqMount"
        @focusin="focused"
        @focusout="unfocused"
      ></div>
      <span class="mq-result-view" ref="mqResult" v-show="result !== null"></span>
    </div>
    <div class="mq-result-bar text-right mq-result-error" v-show="error !== null">{{error}}</div>
    <template v-show="error === null">
      <div :class="{'mq-result-bar': true}" v-show="result !== null && resultFn === null">
        <FractionSVG @click="toggleRenderFormat()" v-if="renderFormat === 'dec'" />
        <DecimalSVG @click="toggleRenderFormat()" v-else />
      </div>
      <div :class="{'mq-result-bar': true}" v-if="resultFn !== null">
        <GraphSVG @click="toggleGraph()" />
        <div class="graph-controls" v-if="showGraph && !graphFailed">
          <span class="graph-control-range" style="--variable: 'x';">
            <span
              class="graph-control-input"
              contenteditable="true"
              @input="domainOverrideChanged('x', 0, $event)"
              :data-placeholder="+defaultXBounds[0].toFixed(3)"
            >{{xDomain[0] || ''}}</span>
            <span
              class="graph-control-input"
              contenteditable="true"
              @input="domainOverrideChanged('x', 1, $event)"
              :data-placeholder="+defaultXBounds[1].toFixed(3)"
            >{{xDomain[1] || ''}}</span>
          </span>
          <span class="graph-control-range" style="--variable: 'y';">
            <span
              class="graph-control-input"
              contenteditable="true"
              @input="domainOverrideChanged('y', 0, $event)"
              :data-placeholder="+yBoundsWithOverrides[0].toFixed(3)"
            >{{yDomain[0] || ''}}</span>
            <span
              class="graph-control-input"
              contenteditable="true"
              @input="domainOverrideChanged('y', 1, $event)"
              :data-placeholder="+yBoundsWithOverrides[1].toFixed(3)"
            >{{yDomain[1] || ''}}</span>
          </span>
          <span class="graph-control-number" style="--variable: 'step';">
            <span
              class="graph-control-input"
              contenteditable="true"
              @input="stepOverrideChanged"
              :data-placeholder="defaultStep"
            >{{step || ''}}</span>
          </span>
        </div>
      </div>
      <div ref="graph" class="graph-container" v-show="showGraph"></div>
    </template>
    <mq-paste-data :renderFormat="renderFormat" :showGraph="showGraph" :latex="latex"></mq-paste-data>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import * as utensils from "latex-utensils";

import "mathquill/build/mathquill.js";
import "@/mathquill-patches";

import FractionSVG from "@/assets/frac.svg?inline";
import DecimalSVG from "@/assets/decimal.svg?inline";
import GraphSVG from "@/assets/graph.svg?inline";
import FullscreenSVG from "@/assets/fullscreen.svg?inline";

import { SanitizerConfig, API } from "@editorjs/editorjs";
import _ from "../util";
import { MathJsStatic } from "mathjs";

type TypeWithGeneric<T> = Partial<T>;
type extractGeneric<Type> = Type extends TypeWithGeneric<infer X> ? X : never;

const mathjs = require("mathjs");

declare const d3: any;

function attachProto(obj: any, proto: any) {
  const objKeys = Object.keys(obj);
  Object.keys(proto)
    .filter(k => !objKeys.includes(k))
    .forEach(key => {
      obj[key] = proto[key];
    });
}

let passiveSupported = false;

try {
  const options = {
    get passive() {
      // This function will be called when the browser
      //   attempts to access the passive property.
      passiveSupported = true;
      return false;
    }
  };

  window.addEventListener("test" as any, null!, options);
  window.removeEventListener("test" as any, null!);
} catch (err) {
  passiveSupported = false;
}

const nerdamer = require("nerdamer");
const PASTE_DATA_TAG = "mq-paste-data";

Vue.config.ignoredElements.push(PASTE_DATA_TAG);

function functionsFromContext(context: any): { [key: string]: string } {
  return Object.values(context)
    .filter(g => typeof g === "function")
    .reduce((acc: any, c: any) => {
      acc[c.syntax] = c.original.substring(c.syntax.length + 1);
      return acc;
    }, {}) as any;
}

function variablesFromContext(context: any): { [key: string]: number } {
  return Object.keys(context)
    .filter(g => typeof context[g] === "number")
    .reduce((acc: any, c: any) => {
      acc[c] = context[c];
      return acc;
    }, {});
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const pending: {
  [nonce: string]: Function;
} = {};

function onmessage(event: MessageEvent) {
  const { nonce, result, flags } = event.data;
  const { [nonce]: resolve } = pending;
  if (!resolve) {
    console.debug(`unknown nonce from worker response`, {
      event,
      data: event.data,
      nonce,
      result,
      pending
    });
    return;
  }
  resolve({ result, flags });
}

function runAlgebraOnWorker(content: any, context: any): Promise<{result: string, flags: {noVarSubInPostProcessing: boolean}}> {
  const worker = (window as any).AlgebraWorker;
  if (worker.onmessage === null) {
    worker.onmessage = onmessage;
  }
  return new Promise((resolve, reject) => {
    const functions = functionsFromContext(context);
    const variables = variablesFromContext(context);
    const nonce = uuidv4();
    pending[nonce] = resolve;
    worker.postMessage({
      evaluate: content,
      functions,
      variables,
      nonce
    });
  });
}

@Component({
  components: {
    FractionSVG,
    DecimalSVG,
    GraphSVG,
    FullscreenSVG
  }
})
export default class MathQuillComponent extends Vue {
  renderFormat: "dec" | "frac" = "dec";
  isFocused: boolean = false;
  latex: string | null = null;
  lastScope: any = {};
  resultFn: Function | null = null;
  result: string | null = null;
  showGraph: boolean = false;
  chart: ReturnType<typeof import("function-plot/lib/index.js")> | null = null;
  error: string | null = null;
  graphFailed: boolean = false;
  trigState: _.MathKit.TrigState | null = null;
  settingsButtons: HTMLSpanElement[] = [];
  bigPopout: boolean = false;

  @Prop()
  savedData: {
    latex: string | null;
    renderFormat: "dec" | "frac";
    showGraph: boolean;
    xDomain: [number, number];
    yDomain: [number, number];
    step: number;
    trigState: _.MathKit.TrigState;
  };

  @Prop()
  api: API;

  $refs: {
    mqMount: HTMLDivElement;
    mqResult: HTMLSpanElement;
    graph: HTMLDivElement;
  };

  mathField: MathQuill.MathField;
  resultView: MathQuill.StaticMath;
  mathJS: MathJsStatic;

  flaggedForDeletion: {
    [token: string]: number;
  } = {};

  static startGarbageWatcher(interval: number, lifetime: number) {
    this.garbageTimer = setInterval(() => {
      console.debug("🗑 time to take out the trash, bitches");
      this.garbageClients.forEach(client => {
        const scopeToken = client.scopeToken;
        const tokens = Array.from(client.mathCache.keys())
          .concat(Array.from(client.calcCache.keys()))
          .filter((t, i, a) => a.indexOf(t) === i);
        tokens.forEach(token => {
          if (token === scopeToken) return;

          if (typeof client.flaggedForDeletion[token] === "undefined")
            client.flaggedForDeletion[token] = Date.now();
          else if (Date.now() - client.flaggedForDeletion[token] > lifetime) {
            const mathCache = client.mathCache.get(token);
            const calcCache = client.calcCache.get(token);
            console.debug("🗑 purging expired caches for component", {
              mathCache: {
                keys: mathCache && mathCache.keys(),
                values: mathCache && mathCache.values()
              },
              calcCache: {
                keys: calcCache && calcCache.keys(),
                values: calcCache && calcCache.values()
              },
              token,
              flaggedAt: client.flaggedForDeletion[token]
            });
            mathCache && mathCache.clear();
            calcCache && calcCache.clear();
            client.mathCache.delete(token);
            client.calcCache.delete(token);
          }
        });
      });
    }, interval);
  }

  static stopGarbageWatcher() {
    clearTimeout(this.garbageTimer);
    delete this.garbageTimer;
  }

  private static garbageTimer: NodeJS.Timer;
  private static garbageClients: MathQuillComponent[] = [];

  private static registerWithGarbageMan(component: MathQuillComponent) {
    if (this.garbageClients.includes(component)) return;
    this.garbageClients.push(component);
  }

  private static deregisterWithGarbageMan(component: MathQuillComponent) {
    if (!this.garbageClients.includes(component)) return;
    this.garbageClients.splice(this.garbageClients.indexOf(component), 1);
  }

  oldWidth: number | null = null;

  handleResize(args: any) {
    if (this.oldWidth !== null && args.width === this.oldWidth) return;
    this.oldWidth = args.width;
    console.log(args.height);
    if (this.showGraph) {
      this.updateGraph();
    }
  }

  created() {
    const math = (this.mathJS = mathjs.create(mathjs.all, {}) as any);
    math.import(require("mathjs-simple-integral" as any), {});
    _.MathKit.loadPatchedMathFunctions(math, () => this.trigStateWithOverrides);
  }

  get trigStateWithOverrides() {
    return this.trigState || this.$store.state.preferences.defaultTrigState;
  }

  mounted() {
    var ready: boolean = false;
    MathQuillComponent.registerWithGarbageMan(this);
    this.mathField = new MathQuill.MathField(this.$refs.mqMount, {
      handlers: {
        edit: field => {
          this.latex = field.latex();
          if (!ready) return;
          this.updateQuills();
        },
        upOutOf: () => this.$emit("upOutOf"),
        downOutOf: () => this.$emit("downOutOf"),
        moveOutOf: (dir, field) => {
          if (dir == "1") {
            // move right
            this.$emit("navigateNext");
          } else {
            // move left
            this.$emit("navigatePrevious");
          }
        },
        enter: field => {
          this.$emit("insert");
        }
      },
      autoCommands: "int pi sqrt sum"
    });

    this.resultView = new MathQuill.StaticMath(this.$refs.mqResult);

    Object.keys(this.savedData).forEach(key => {
      Vue.set(this, key, (this.savedData as any)[key]);
    });

    this.mathField.write(this.latex || "");

    this.$on("preload", () => {
      this.$emit("setIgnoreBackspace", () => (this.latex || "").length > 0);
      this.$emit("setIsEmpty", () => (this.latex || "").length === 0);
      this.$emit(
        "setIsAtStart",
        () =>
          this.mqRootBlock.firstElementChild &&
          this.mqRootBlock.firstElementChild.classList.contains("mq-cursor")
      );
      this.$emit(
        "setIsAtEnd",
        () =>
          this.mqRootBlock.lastElementChild &&
          this.mqRootBlock.lastElementChild.classList.contains("mq-cursor")
      );
      this.$emit("setSave", () => ({
        latex: this.latex,
        renderFormat: this.renderFormat,
        showGraph: this.showGraph,
        xDomain: this.xDomain,
        yDomain: this.yDomain,
        step: this.step,
        trigState: this.trigState
      }));
      this.$emit("setPasteConfig", { tags: [PASTE_DATA_TAG] });

      this.$emit("setRenderSettings", () => {
        const holder = document.createElement("div");

        ["deg", "rad", "grad"].forEach(mode => {
          const selector = document.createElement("span");

          selector.classList.add(this.api.styles.settingsButton);
          selector.classList.add("mq-trig-mode-control");

          if (this.trigStateWithOverrides === mode) {
            selector.classList.add(this.api.styles.settingsButtonActive);
          }

          selector.innerText = mode.toUpperCase();
          selector.dataset.mode = mode;

          selector.addEventListener("click", () => {
            console.log("clakc");
            this.trigState = mode as _.MathKit.TrigState;
          });

          holder.appendChild(selector);
          this.settingsButtons.push(selector);
        });

        return holder;
      });

      this.$emit("ready");
    });

    this.$on("updateQuills", (resolve?: (value: void) => any) =>
      this.updateQuills().then(resolve)
    );
    this.$on("moved", () => this.updateQuills());
    this.$on("reflow", () => this.reflow());

    this.$on("parsePaste", (e: CustomEvent) => {
      const data: HTMLElement = e.detail.data;
      const renderFormat = data.getAttribute("renderFormat");
      const latex = data.getAttribute("latex");
      const showGraph = data.getAttribute("showGraph");

      this.mathField.write(latex || "");
      this.updateQuills().then(() => {
        this.renderFormat = (renderFormat as any) || this.renderFormat;
        this.showGraph = Boolean(showGraph);
      });
    });

    this.$on('rendered', (el: HTMLElement) => {
      this.$el.parentElement!.classList.add('codex-mq-holder');
    })

    this.$watch("renderFormat", () => {
      if (!this.result) return;
      this.updateResultView(this.result);
    });

    this.$watch("result", result => {
      this.updateResultView(result);
    });

    this.$watch("resultFn", resultFn => {
      if (!resultFn) return this.removeGraph();
      if (!this.showGraph) return;
      this.updateGraph();
    });

    this.$watch("showGraph", (showGraph: boolean) => {
      if (showGraph) {
        this.updateGraph();
      } else {
        this.removeGraph();
      }
    });

    this.$watch("trigState", async mode => {
      this.settingsButtons.forEach(button => {
        button.classList.toggle(
          this.api.styles.settingsButtonActive,
          button.dataset.mode === mode
        );
      });
      await this.updateQuills();
    });

    this.$once("ready", () => {
      ready = true;
    });

    this.xDomain;
    this.yDomain;
    this.step;

    this.$watch("xDomain", () => this.updateGraph());
    this.$watch("yDomain", () => this.updateGraph());
    this.$watch("step", () => this.updateGraph());
  }

  destroyed() {
    this.calcCache.clear();
    this.mathCache.clear();
    MathQuillComponent.deregisterWithGarbageMan(this);
  }

  updated() {
    if (this.resultView) {
      this.resultView.reflow();
    }
  }

  reflow() {
    this.resultView && this.resultView.reflow();
    this.mathField && this.mathField.reflow();
  }

  get mqRootBlock(): HTMLSpanElement {
    return this.$refs.mqMount.querySelector(".mq-root-block") as any;
  }

  /**
   * Returns true if block has focused class
   */
  get isActive() {
    try {
      return this.$el.parentElement!.parentElement!.classList.contains(
        "ce-block--focused"
      );
    } catch {
      return false;
    }
  }

  mathCache: Map<string, Map<string, { result: string, flags: any }>> = new Map();

  get scopeToken() {
    return JSON.stringify(
      Object.assign({}, this.lastScope, functionsFromContext(this.lastScope))
    );
  }

  private resolveCachedLatex(latex: string) {
    const token = this.scopeToken;
    if (!this.mathCache.has(token)) this.mathCache.set(token, new Map());
    return this.mathCache.get(token)!.get(latex);
  }

  private cacheLatex(latex: string, expression: { result: string, flags: any}): void {
    const token = this.scopeToken;
    if (!this.mathCache.has(token)) this.mathCache.set(token, new Map());
    this.mathCache.get(token)!.set(latex, expression);
  }

  /**
   * Converts latex to math and returns it
   */
  async math() {
    if (!this.latex) return { flags: {}, result: null };
    var expression = this.resolveCachedLatex(this.latex);
    var parsed;
    if (!expression) {
      parsed = utensils.latexParser.parse(this.latex);
      const response = await runAlgebraOnWorker(parsed.content, this.lastScope);
      this.cacheLatex(this.latex, response);
      return response;
    }
    return expression;
  }

  /**
   * Quill was focused.
   */
  focused() {
    this.isFocused = true;
    this.$emit("hidePlusButton");
    this.$emit("showToolbar");
  }

  /**
   * Quill was unfocused.
   */
  unfocused() {
    this.isFocused = false;
    if (this.isActive) return;
    this.$emit("showToolbar");
  }

  /**
   * Updates quills in their DOM order
   */
  async updateQuills() {
    nerdamer.clearVars();
    const components = await this.components();
    const scope = {};
    for (let c of components) {
      await c.calc(scope);
    }
  }

  removeGraph() {
    if (!this.chart) return;

    this.chart.root.remove();
    this.chart = null;
  }

  get defaultXBounds(): [number, number] {
    return [-10, 10];
  }

  get defaultStep(): number {
    return 1;
  }

  /**
   * User-set overrides, can be NaN in any configuration
   */
  xDomain: [number, number] = [NaN, NaN];
  yDomain: [number, number] = [NaN, NaN];
  step: number = NaN;

  /**
   * Determines the minimum and maximum value of the function given the bounds
   */
  minMaxOfFn(xMin: number, xMax: number): [number, number] {
    if (!this.resultFn) return [NaN, NaN];

    let values: number[] = [];

    for (let i = xMin; i < xMax; i += this.stepWithOverride) {
      values.push(this.resultFn(i));
    }

    values = values.sort((a, b) => a - b);

    const range = [values[0], values[values.length - 1]];
    
    return range as [number, number];
  }

  get xBoundsWithOverrides() {
    const range = this.xDomain
      .map(i => (typeof i === "number" ? i : NaN))
      .map((i, idx) => (isNaN(i) ? this.defaultXBounds[idx] : i)) as [
      number,
      number
    ];

    if (range.length < 2 || (range[0] === range[1])) return [-10, 10] as [number, number];

    return range;
  }

  get yBoundsWithOverrides() {
    if (!this.resultFn) return null;
    let yDomain = this.yDomain.map(i => (typeof i === "number" ? i : NaN));
    if (yDomain.some(i => isNaN(i))) {
      const bounds = this.minMaxOfFn(...this.xBoundsWithOverrides);
      yDomain = yDomain.map((i, idx) => (isNaN(i) ? bounds[idx] : i)) as [
        number,
        number
      ];
    }
    
    yDomain.sort((a, b) => a - b);

    if (yDomain.length < 2 || (yDomain[0] === yDomain[1])) return this.minMaxOfFn(...this.xBoundsWithOverrides);

    return yDomain;
  }

  get stepWithOverride() {
    return this.step || this.defaultStep;
  }

  /**
   * Recalculates the bounds of the graph
   */
  get computedBounds() {
    if (!this.resultFn) return null;

    const xDomain = this.xBoundsWithOverrides;
    const yDomain = this.yBoundsWithOverrides!;

    return {
      xDomain,
      yDomain
    };
  }

  /**
   * Called when a domain override field is modified by the user
   */
  domainOverrideChanged(domain: "x" | "y", minMax: 0 | 1, event: InputEvent) {
    const target = event.target as HTMLSpanElement;
    const pos = _.Dom.getCaretPosition(target);
    const { innerText: rawValue } = target;
    let override = parseFloat(rawValue);

    const keyPath = `${domain}Domain` as "xDomain" | "yDomain";
    const previousBound = this[keyPath][minMax];

    if (!isNaN(override) && rawValue.trim().length > 0 && !rawValue.endsWith('.')) {
      target.innerText = override.toString();
      
      if (override !== previousBound) {
        this[`${domain}Domain` as "xDomain" | "yDomain"].splice(
          minMax,
          1,
          override
        );
      }
    }

    this.$nextTick(() => {
      _.Dom.setCurrentCursorPosition(pos, target);
    });
  }

  stepOverrideChanged(event: InputEvent) {
    const target = event.target as HTMLSpanElement;
    const pos = _.Dom.getCaretPosition(target);
    const { innerText: rawValue } = target;
    let override = parseFloat(rawValue);
    const lastStep = this.step;

    const [low, high] = this.xBoundsWithOverrides;
    let range = Math.abs(low - high);

    if ((low >= 0 && high < 0) || (low < 0 && high >= 0)) range += 1;

    if (!isNaN(override) && rawValue.trim().length > 0 && override < range && override > 0 && !rawValue.endsWith('.')) {
      target.innerText = override.toString();

      if ((override !== lastStep) && override > 0) {
        this.step = override;
      }
    }

    this.$nextTick(() => {
      _.Dom.setCurrentCursorPosition(pos, target);
    });
  }

  async updateGraph() {
    if (!this.resultFn) return;
    if (this.chart) this.removeGraph();
    if (!this.showGraph) return;

    const { default: plot } = await import("function-plot/lib/index.js");

    const { xDomain, yDomain } = this.computedBounds!;

    console.debug(`calculated bounds for function`, {
      resultFn: this.resultFn,
      xDomain,
      yDomain
    });

    try {
      this.chart = plot({
        target: this.$refs.graph,
        tip: {
          xLine: true,
          yLine: true,
          renderer: (x, y) => `(${x.toFixed(3)}, ${y.toFixed(3)})`
        },
        data: [
          {
            fn: "fn",
            step: this.stepWithOverride,
            scope: {
              fn: this.resultFn
            },
            nSamples: 1000,
            sampler: "mathjs",
            graphType: "polyline"
          }
        ],
        grid: true,
        xAxis: {
          domain: xDomain
        },
        yAxis: {
          domain: yDomain
        },
        width: this.$el.clientWidth,
        height: +getComputedStyle(this.$refs.graph).height!.split('px')[0]
      });
    } catch (e) {
      console.warn("failed to update graph", e);
      this.graphFailed = true;
      return;
    }

    this.graphFailed = false;

    this.fixChart();
  }

  /**
   * Fixes inconsistencies in the function-plot chart object
   */
  fixChart() {
    if (!this.chart) return;
    const options = this.chart.options;
    const prototype = d3
      .select(options.target)
      .selectAll("svg")
      .data([options]).__proto__;
    attachProto(this.chart!.root, prototype);
    attachProto(this.chart!.canvas, prototype);
    Object.defineProperty(this.chart, "content", {
      get() {
        return this._content;
      },
      set(content) {
        attachProto(content, prototype);
        this._content = content;
        return true;
      }
    });
  }

  calcCache: Map<string, Map<string, any>> = new Map();

  private resolveCachedCalc(latex: string) {
    const token = this.scopeToken;
    if (!this.calcCache.has(token)) this.calcCache.set(token, new Map());
    return this.calcCache.get(token)!.get(latex);
  }

  private cacheCalc(latex: string, result: any): void {
    const token = this.scopeToken;
    if (!this.calcCache.has(token)) this.calcCache.set(token, new Map());
    this.calcCache.get(token)!.set(latex, result);
  }

  /**
   * Calculates the result of this quill using the given scope
   */
  async calc(scope: any) {
    if (!this.latex) {
      // reset the component, its empty
      this.result = this.resultFn = null;
      return;
    }

    this.lastScope = Object.assign({}, scope);
    this.error = null;

    let cachedResult = this.latex && this.resolveCachedCalc(this.latex);
    let compiled;
    if (cachedResult) {
      compiled = cachedResult;
    } else {
      const { flags: parserFlags, result: mathStr } = await this.math();
      if (!mathStr) return (this.result = null);
      try {
        compiled = this.mathJS.parse(mathStr).compile();
      } catch (e) {
        console.debug(`failed to parse result from algebra slave`, {
          e,
          mathStr,
          scope,
          latex: this.latex
        });
        compiled = "error";
      }
      this.cacheCalc(this.latex, compiled);
      console.debug("compiled expression", {
        latex: this.latex,
        mathStr,
        compiled
      });
    }

    let result: any,
      { flags, result: mathStr } = this.resolveCachedLatex(this.latex)!;

    try {
      if (flags.noVarSubInPostProcessing) {
        result = mathStr;
      } else {
        result = compiled.evaluate(scope);
      }
    } catch (e) {
      result = mathStr;
    } finally {
      if (typeof result === "string" && !flags.noVarSubInPostProcessing) {
        try {
          const parsed = this.mathJS.parse(result);
          const symbols = parsed
            .filter(n => n.isSymbolNode)
            .map(n => n.toString())
            .filter(n => !(this.mathJS as any)[n])
            .filter((n,i,a) => a.indexOf(n) === i);
          if (symbols.length === 1 && symbols[0] === 'x') {
            let resultFn = this.mathJS.parse(`f(x)=${mathStr}`).compile().evaluate({});

            try {
              resultFn(0);
            } catch (e) {
              resultFn = null;
            }

            if (resultFn) {
              this.resultFn = resultFn;
            }
          } else this.resultFn = null;
        } catch { this.resultFn = null; }
      } else if (
        typeof result === "function" ||
        typeof result === "undefined"
      ) {
        if (typeof result === "function") {
          try {
            result(0);
          } catch (e) {
            this.error = e.message;
            result = null;
          }
          if (result) {
            result["original"] = mathStr;
          }
          this.resultFn = result;
        }
      } else this.resultFn = null;
    }

    if (typeof result === "number") {
      result = this.mathJS.round(result, 10);
    }

    console.debug('calculation complete', {
      scope,
      cachedResult,
      compiled,
      flags,
      result,
      resultFn: this.resultFn
    });

    this.result = result;

    return result;
  }

  toggleGraph() {
    this.showGraph = !this.showGraph;
  }

  async updateResultView(result: any) {
    switch (this.renderFormat) {
      case "frac":
        var frac = await this.fraction(result);
        if (frac) {
          this.resultView.latex(frac);
          break;
        }
      case "dec":
      default:
        try {
          if (isNaN(result)) {
            const oldResult = result;
            result = nerdamer(oldResult).toTeX();
          }
          if (typeof result.toTeX === "function") result = result.toTeX();
          if (typeof result.toTex === "function") result = result.toTex();
        } catch (e) {
          console.debug("failed to render result", e, {
            result,
            latex: this.latex
          });
          result = "error";
        }
        this.resultView.latex(result);
        break;
    }
  }

  /**
   * Returns a fraction representation
   */
  async fraction(result: string) {
    try {
      return (this.mathJS.fraction(result) as any).toLatex();
    } catch {
      return null;
    }
  }

  toggleRenderFormat() {
    this.renderFormat = this.renderFormat === "dec" ? "frac" : "dec";
  }

  /**
   * Gets all Vue components of this tool from the Editor layer
   */
  components(): Promise<MathQuillComponent[]> {
    return new Promise(resolve => this.$emit("get:components", resolve));
  }
}

MathQuillComponent.startGarbageWatcher(15000, 30000);
</script>

<style lang="scss">
.codex-mq-holder {
  padding: 10px 0;
}

.codex-mq-root {
  display: flex;
  flex-flow: column;
  justify-content: center;
  transition: border 0.5s linear;
  border-radius: 5px;
  overflow: hidden;

  &.codex-mq-popout {
    height: 75vh;
    width: 75vw;
    z-index: 10000;
    position: fixed;
    top: 12.5vh;
    left: 12.5vw;

    & .graph-container {
      height: stretch;
    }
  }

  .resize-observer {
    position: initial;
  }

  @media print {
    @include schemeResponsive("border", "border");
  }

  .mq-calc-root {
    @extend %bg0;
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    padding: 10px;

    @media print {
      @include schemeResponsive("border-bottom", "border");
    }

    & > .mq-result-view {
      text-align: right;
      display: flex;
      flex-flow: row-reverse;
      align-items: center;
      margin-right: 10px;
      z-index: 10;

      @include customPropSuffixedResponsive(
        "box-shadow",
        -10px 0px 3px 0px,
        "box-shadow-color"
      );

      @media print {
        box-shadow: none;
      }

      & > .mq-root-block {
        @include scrollbar();
        width: min-content !important;
        overflow-x: scroll;
      }

      &:not(.mq-math-mode) {
        &::after {
          margin-right: 5px;
        }
      }

      &::after {
        content: "= ";
      }
    }
  }

  .mq-editable-field {
    @include scrollbar();

    flex-grow: 1;
    border: none;
    overflow-x: scroll;
    overflow-y: hidden;

    .mq-sup,
    .mq-sub,
    .mq-sup-inner {
      &.mq-empty {
        @extend %borderAlt1;
        background: none;
        &::after {
          font-size: 10px;
        }
      }
    }

    &.mq-focused {
      box-shadow: none !important;
    }

    .mq-root-block .mq-cursor {
      @extend %borderLeftAlt;
    }

    & > .mq-root-block {
      overflow: scroll;
      display: unset;
    }
  }

  svg.function-plot {
    @extend %bg2;
    width: 100%;
  }

  .mq-result-bar {
    @extend %bg1;
    font-family: Symbola, "Times New Roman", serif;
    display: flex;
    flex-flow: row;
    align-items: center;
    height: 36px;

    .graph-controls {
      flex-grow: 1;
      display: flex;
      flex-flow: row;
      margin-left: auto;
      padding-right: 10px;
      padding-bottom: 6px;
      margin-right: 5px;
      flex-wrap: nowrap;
      overflow-x: scroll;
      overflow-y: hidden;

      .graph-control-range,
      .graph-control-number {
        @extend %border1;
        padding: 2.5px;
        white-space: nowrap;

        &::before {
          content: var(--variable) " range:";
          padding: 0 5px;
        }

        .graph-control-input {
          @extend %bg2;
          min-width: 25px;
          display: inline-block;
          padding: 0 5px;

          &:empty:after {
            @extend %textAlt;
            content: attr(data-placeholder) !important;
            cursor: text;
          }

          &:first-child {
            border-radius: 5px 0 0 5px;
            margin-left: 5px;
          }

          &:last-child {
            border-radius: 0 5px 5px 0;

            @extend %borderLeft;
          }

          &:only-child {
            border: 0;
            border-radius: 5px;
          }
        }
      }

      .graph-control-number {
        &::before {
          content: var(--variable) !important;
        }
      }
    }

    @media print {
      display: none !important;
    }

    &.text-right {
      flex-flow: row-reverse;
      padding-right: 10px;
    }

    & > svg {
      max-height: 24px;
      width: 24px;
      transition: fill 0.125s linear;
      cursor: pointer;
      margin: 10px;

      &:hover {
        @extend %fill;
      }
    }
  }
}

.mq-trig-mode-control {
  font-size: 12px;
  justify-content: center;
}
</style>