<template>
  <div
    :class="{'codex-mq-root': true, 'codex-mq-focused': isFocused, 'codex-mq-popout': bigPopout}"
    v-resize="handleResize"
  >
    <math-field
      ref="mathField"
      @focused="focused"
      @unfocused="unfocused"
      :value="savedData.latex"
      :renderFormat="renderFormat"
      :trigState="trigState"
    ></math-field>
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
    <div class="graph-container" v-show="resultFn !== null && showGraph">
      <graph
        ref="graph"
        :visible="resultFn !== null && showGraph"
        :fn="resultFn"
        :step="step"
        :xDomain="xDomain"
        :yDomain="yDomain"
        :disableScroll="shouldGraphDisableScroll"
      ></graph>
    </div>
    <GraphSVG ref="graphSVG" v-show="false" />
    <mq-paste-data :renderFormat="renderFormat" :showGraph="showGraph" :latex="latestLatex"></mq-paste-data>
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
import MathField, { RenderFormat } from "@/components/MathField.vue";

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
    Graph,
    MathField
  }
})
export default class MathQuillComponent extends Vue {
  renderFormat: RenderFormat = "dec";
  isFocused: boolean = false;
  showGraph: boolean = false;
  chart: ReturnType<typeof import("function-plot/lib/index.js")> | null = null;
  graphFailed: boolean = false;
  trigState: _.MathKit.TrigState | null = null;
  settingsButtons: HTMLSpanElement[] = [];
  bigPopout: boolean = false;
  shouldGraphDisableScroll: boolean = false;

  GRAPH_DEFAULTS = GRAPH_DEFAULTS;

  @Prop()
  savedData: {
    latex: string | null;
    renderFormat: RenderFormat;
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
    graph: Graph;
    mathField: MathField;
    graphSVG: SVGSVGElement;
  };

  fracToggleButton: HTMLElement;
  graphControlButton: HTMLElement;

  resultFn: Function | null = null;
  latestLatex: string | null = null;

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

  lastWidth: number = NaN;

  handleResize(args: any) {
    if (isNaN(this.lastWidth)) this.lastWidth = this.$el.clientWidth;
    else if (this.lastWidth === this.$el.clientWidth) return;
    else this.lastWidth = this.$el.clientWidth;
    this.$refs.graph.updateGraph(true);
  }

  get trigStateWithOverrides() {
    return this.trigState || this.$store.state.preferences.defaultTrigState;
  }

  created() {
    Object.keys(this.savedData).forEach(key => {
      if (key === "latex") return;
      Vue.set(this, key, (this.savedData as any)[key]);
    });
  }

  mounted() {
    this.$refs.mathField.$on("get:components", (resolve: (c: any[]) => any) =>
      this.mathFields().then(resolve)
    );

    this.$refs.mathField.$on("upOutOf", () => this.$emit("upOutOf"));
    this.$refs.mathField.$on("downOutOf", () => this.$emit("downOutOf"));
    this.$refs.mathField.$on("navigateNext", () => this.$emit("navigateNext"));
    this.$refs.mathField.$on("navigatePrevious", () =>
      this.$emit("navigatePrevious")
    );
    this.$refs.mathField.$on("insert", () => this.$emit("insert"));

    this.$refs.mathField.$on("update:result", (result: string | null) => this.latestLatex = result);
    this.$refs.mathField.$on("update:resultFn", (resultFn: Function | null) => this.resultFn = resultFn);

    this.$on("preload", () => {
      this.$emit("setIgnoreBackspace", () => !this.$refs.mathField.isEmpty);
      this.$emit("setIsEmpty", () => this.$refs.mathField.isEmpty);
      this.$emit("setIsAtStart", () => this.$refs.mathField.atStart);
      this.$emit("setIsAtEnd", () => this.$refs.mathField.atEnd);
      this.$emit("setSave", () => ({
        latex: this.$refs.mathField.serialized().value,
        renderFormat: this.renderFormat,
        showGraph: this.showGraph,
        xDomain: this.xDomain,
        yDomain: this.yDomain,
        step: this.step,
        trigState: this.trigState
      }));
      this.$emit("setPasteConfig", { tags: [PASTE_DATA_TAG] });

      this.$on('willSelect', () => this.shouldGraphDisableScroll = true);
      this.$on('willUnselect', () => this.shouldGraphDisableScroll = false);

      this.$emit("setRenderSettings", () => {
        const holder = document.createElement("div");

        const createButton = (...children: Node[]) => {
          const button = document.createElement("span");
          button.classList.add(this.api.styles.settingsButton);
          button.classList.add("mq-trig-mode-control");

          children.forEach(c => ((c as HTMLElement).style.display = "unset"));

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
          .appendChild(
            (this.graphControlButton = createButton(
              this.$refs.graphSVG.cloneNode(true)
            ))
          )
          .addEventListener("click", () => this.toggleGraph());
        this.updateGraphToggleButton();

        return holder;
      });
    });

    this.$on("updateFields", (resolve?: (value: void) => any) =>
      this.$refs.mathField.updateFields().then(resolve)
    );

    this.$on("moved", () => this.$refs.mathField.updateFields());
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

      this.$refs.mathField.$emit("set:latex", latex || "");

      this.renderFormat = (renderFormat as any) || this.renderFormat;
      this.showGraph = Boolean(showGraph);
    });

    this.$on("rendered", (el: HTMLElement) => {
      this.$el.parentElement!.classList.add("codex-mq-holder");
    });

    this.$watch("renderFormat", () => {
      this.updateFracToggleButton();
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
    });
  }

  updated() {
    this.reflow();
  }

  reflow() {
    this.$refs.mathField.$emit("reflow");
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

  toggleGraph() {
    if (!this.canToggleGraph) return;
    this.showGraph = !this.showGraph;
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

  /**
   * Gets all MathField children of components()
   */
  mathFields(): Promise<MathField[]> {
    return this.components().then(c => c.map(c => c.$refs.mathField));
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

  .graph-container {
    height: 350px;
  }

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

  &.strikethrough {
    position: relative;

    &::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 0;
      width: 100%;
      height: 1px;
      background: black;
      transform: rotate(-7deg);
    }
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
  box-shadow: 0 3px 15px 6px rgba(13, 20, 33, 0.13);

  svg {
    @extend %fill;
  }

  .cdx-settings-button,
  .ce-settings__button {
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