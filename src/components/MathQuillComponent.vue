<template>
  <div
    :class="{'codex-mq-root': true, 'codex-mq-focused': isFocused, 'codex-mq-popout': bigPopout}"
    v-resize="handleResize"
  >
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
      <div :class="{'mq-result-bar': true}" v-if="resultFn !== null && showGraph && !graphFailed">
        <div class="graph-controls">
          <span class="graph-control-range" style="--variable: 'x';">
            <span
              class="graph-control-input"
              contenteditable="true"
              @input="domainOverrideChanged('x', 0, $event)"
              :data-placeholder="+GRAPH_DEFAULTS.x[0].toFixed(3)"
            >{{xDomain[0] || ''}}</span>
            <span
              class="graph-control-input"
              contenteditable="true"
              @input="domainOverrideChanged('x', 1, $event)"
              :data-placeholder="+GRAPH_DEFAULTS.x[1].toFixed(3)"
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
              :data-placeholder="GRAPH_DEFAULTS.step"
            >{{step || ''}}</span>
          </span>
        </div>
      </div>
      <graph
        ref="graph"
        class="graph-container"
        :visible="resultFn !== null && showGraph"
        :fn="resultFn"
        :step="step"
        :xDomain="xDomain"
        :yDomain="yDomain"
      ></graph>
      <GraphSVG ref="graphSVG" v-show="false" />
    <mq-paste-data :renderFormat="renderFormat" :showGraph="showGraph" :latex="latex"></mq-paste-data>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import * as utensils from "latex-utensils";

import "mathquill/build/mathquill.js";
import "@/mathquill-patches";

import GraphSVG from "@/assets/graph.svg?inline";
import FullscreenSVG from "@/assets/fullscreen.svg?inline";

import { SanitizerConfig, API } from "@editorjs/editorjs";
import _ from "../util";
import { MathJsStatic } from "mathjs";

import Graph, { GRAPH_DEFAULTS } from "@/components/Graph.vue";

type TypeWithGeneric<T> = Partial<T>;
type extractGeneric<Type> = Type extends TypeWithGeneric<infer X> ? X : never;

const mathjs = require("mathjs");

const nerdamer = require("nerdamer");
const PASTE_DATA_TAG = "mq-paste-data";

Vue.config.ignoredElements.push(PASTE_DATA_TAG);

@Component({
  components: {
    FullscreenSVG,
    GraphSVG,
    Graph
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

  GRAPH_DEFAULTS = GRAPH_DEFAULTS;

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

  @Prop()
  internal: any;

  $refs: {
    mqMount: HTMLDivElement;
    mqResult: HTMLSpanElement;
    graph: Graph;
    graphSVG: SVGSVGElement;
  };

  mathField: MathQuill.MathField;
  resultView: MathQuill.StaticMath;
  mathJS: MathJsStatic;
  fracToggleButton: HTMLElement;
  graphControlButton: HTMLElement;

  oldWidth: number | null = null;

  updateFracToggleButton() {
    let innerText;
    if (this.renderFormat === "dec") {
      innerText = "&frac12;";
    } else {
      innerText = "1.23";
    }

    this.fracToggleButton.innerHTML = innerText;
  }

  updateGraphToggleButton() {
    if (!this.graphControlButton) return;

    if (!this.canToggleGraph) {
      this.graphControlButton.classList.toggle("disabled", true);
      return;
    }
    this.graphControlButton.classList.toggle("disabled", !this.resultFn);
    // this.graphControlButton.classList.toggle('graph-disabled', this.showGraph);
  }

  get canToggleGraph() {
    return (
      !!this.resultFn &&
      ((this.resultFn as any) as { syntax: string }).syntax.split(",")
        .length === 1
    );
  }

  handleResize(args: any) {
    if (this.oldWidth !== null && args.width === this.oldWidth) return;
    this.oldWidth = args.width;
    console.log(args.height);
    if (this.showGraph) {
      this.$refs.graph.$emit("resize");
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

        const createButton = (...children: Node[]) => {
          const button = document.createElement("span");
          button.classList.add(this.api.styles.settingsButton);
          button.classList.add("mq-trig-mode-control");

          children.forEach(c => (c as HTMLElement).style.display = 'unset');

          button.append(...children);

          return button;
        };

        ["deg", "rad", "grad"].forEach(mode => {
          const selector = createButton();

          if (this.trigStateWithOverrides === mode) {
            selector.classList.add(this.api.styles.settingsButtonActive);
          }

          selector.innerText = mode.toUpperCase();
          selector.dataset.mode = mode;

          selector.addEventListener("click", () => {
            this.trigState = mode as _.MathKit.TrigState;
          });

          holder.appendChild(selector);
          this.settingsButtons.push(selector);
        });

        holder
          .appendChild((this.fracToggleButton = createButton()))
          .addEventListener("click", () => this.toggleRenderFormat());
        this.updateFracToggleButton();

        holder
          .appendChild((this.graphControlButton = createButton(this.$refs.graphSVG.cloneNode(true))))
          .addEventListener("click", () => this.toggleGraph());
        this.updateGraphToggleButton();

        return holder;
      });

      this.$emit("ready");
    });

    this.$on("updateQuills", (resolve?: (value: void) => any) =>
      this.updateQuills().then(resolve)
    );
    this.$on("moved", () => this.updateQuills());
    this.$on("reflow", () => this.reflow());

    this.$refs.graph.$on(
      "fail-state-change",
      (failed: boolean) => (this.graphFailed = failed)
    );

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

    this.$on("rendered", (el: HTMLElement) => {
      this.$el.parentElement!.classList.add("codex-mq-holder");
    });

    this.$watch("renderFormat", () => {
      if (!this.result) return;
      this.updateResultView(this.result);
      this.updateFracToggleButton();
    });

    this.$watch("result", result => {
      this.updateResultView(result);
    });

    this.$watch("resultFn", fn => {
      this.updateGraphToggleButton();
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

  /**
   * User-set overrides, can be NaN in any configuration
   */
  xDomain: [number, number] = [NaN, NaN];
  yDomain: [number, number] = [NaN, NaN];
  step: number = NaN;

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

    const setVal = (val: any) =>
      this[`${domain}Domain` as "xDomain" | "yDomain"].splice(minMax, 1, val);

    if (!override) {
      setVal(NaN);
      return;
    }

    if (
      !isNaN(override) &&
      rawValue.trim().length > 0 &&
      !rawValue.endsWith(".")
    ) {
      target.innerText = override.toString();

      if (override !== previousBound) {
        setVal(override);
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

    const [low, high] = this.$refs.graph.xBoundsWithOverrides;
    let range = Math.abs(low - high);

    if ((low >= 0 && high < 0) || (low < 0 && high >= 0)) range += 1;

    if (
      !isNaN(override) &&
      rawValue.trim().length > 0 &&
      override < range &&
      override > 0 &&
      !rawValue.endsWith(".")
    ) {
      target.innerText = override.toString();

      if (override !== lastStep && override > 0) {
        this.step = override;
      }
    } else {
      this.step = NaN;
    }

    this.$nextTick(() => {
      _.Dom.setCurrentCursorPosition(pos, target);
    });
  }

  get yBoundsWithOverrides() {
    return this.$refs.graph.yBoundsWithOverrides;
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

    const { result, resultFn } = await _.MathKit.calculateWithScope(
      this.latex,
      scope,
      this.mathJS
    );

    this.resultFn = resultFn;

    return (this.result = result);
  }

  toggleGraph() {
    if (!this.canToggleGraph) return;
    this.showGraph = !this.showGraph;
  }

  updateResultView(result: any) {
    switch (this.renderFormat) {
      case "frac":
        var frac = _.MathKit.toFracLatex(result);
        if (frac) {
          this.resultView.latex(frac);
          this.reflow();
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
          result = null;
          break;
        }
        this.resultView.latex(result);
        this.reflow();
        break;
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
    grid-template-columns: minmax(0, 3fr) min-content;
    padding: 10px;

    @media print {
      @include schemeResponsive("border-bottom", "border");
    }

    .mq-math-mode {
      display: inline-flex;
      align-items: center;
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
      display: block;
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
      padding-left: 10px;
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
  align-items: center;

  & svg {
    height: 75%;
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.5;

    &:hover {
      background: none !important;
    }
  }
}

.ce-toolbar {
  z-index: 10;
}

.ce-settings {
  @extend %bgAlt1;
  @extend %text;
  @extend %border;
  box-shadow: 0 3px 15px 6px rgba(13,20,33,.13);

  svg {
    @extend %fill;
  }

  .cdx-settings-button, .ce-settings__button {
    @extend %text;
    &:hover {
      @extend %bgAlt2;
    }

    &.cdx-settings-button--active {
      color: #388ae5;
    }
  }
}
</style>