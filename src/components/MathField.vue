<template>
  <div class="mq-calc-root">
    <div
      :class="{'mq-editable-field': true, 'mq-math-mode': true}"
      ref="mqMount"
      @focusin="focused"
      @focusout="unfocused"
    ></div>
    <span class="mq-result-view" ref="mqResult" v-show="result !== null"></span>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import _ from "../util";
import { MathJsStatic } from "mathjs";
import nerdamer from "nerdamer";

const mathjs = require("mathjs");

function isTeXer<T>(obj: T): obj is T & { toTeX: () => string } {
  return typeof (obj as any)["toTeX"] === "function";
}

export type RenderFormat = "dec" | "frac";

/**
 * Shell component for MathQuill-style fields, with support for context
 * 
 * To fully implement this component:
 * 
 * Props
 * - value: initial latex value
 * - renderFormat: control the renderFormat in the resultView
 * - trigState: rad/grad/deg for their relevant mathJS functions
 * 
 * Events
 * - $emit:
 *  - reflow = reflow inner mathquill elements
 *  - "set:latex"(latex: string) = overwrite the current latex value
 * - $on:
 *  - upOutOf = MathQuill upOutOf event
 *  - downOutOf = MathQuill downOutOf event
 *  - navigateNext = navigate to next item
 *  - navigatePrevious = navigate to previous item
 *  - insert = should create next item
 *  - "update:result"(result: string) = the mathstr result did change
 *  - "update:resultFn"(resultFn: Function | null) = the resultFn did change
 *  - "get:components"(resolve: (components: MathField[]) => any) = query from mathfield for all MathField siblings
 */
@Component
export default class MathField extends Vue {
  latex: string | null = null;
  lastLatex: string | null = null;
  lastScope: any = {};
  resultFn: Function | null = null;
  result: string | number | null = null;

  $refs: {
    mqMount: HTMLDivElement;
    mqResult: HTMLSpanElement;
  };

  mathField: MathQuill.MathField = null as any;
  resultView: MathQuill.StaticMath = null as any;
  mathJS: MathJsStatic = null as any;
  frozen: boolean = false;

  /**
   * Initial latex value
   */
  @Prop({ default: "" })
  value: string;

  @Prop({ default: "dec" })
  renderFormat: RenderFormat;

  @Prop({ default: null })
  trigState: _.MathKit.TrigState | null;

  @Prop({ default: false })
  isInitialReady: boolean;

  created() {
    const math = mathjs.create(
      mathjs.all,
      {}
    ) as any as MathJsStatic;
    const Observer = (new Vue()).$data
                                .__ob__
                                .constructor;
    (math as any).__ob__ = new Observer({});

    delete (math as any).expression.docs;
    math.import(require("mathjs-simple-integral"), {});
    this.mathJS = math;
    _.MathKit.loadPatchedMathFunctions(math, () => this._trigState);
  }

  mounted() {
    this.mathField = new MathQuill.MathField(this.$refs.mqMount, {
      handlers: {
        edit: field => {
          if (this.latex === field.latex()) return;
          this.latex = field.latex();
          this.updateFields();
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
        deleteOutOf: () => this.$emit("deleteOutOf"),
        enter: field => {
          this.$emit("insert");
        }
      },
      autoCommands: "int pi sqrt sum"
    });

    this.resultView = new MathQuill.StaticMath(this.$refs.mqResult);

    this.mathField.latex(this.latex = this.value);
    this.$watch("value", newValue =>
      this.mathField.latex((this.latex = newValue))
    );
    this.$watch("trigState", mode => this.updateFields());
    this.$watch("renderFormat", () => this.updateResultView());
    this.$watch("result", () => this.updateResultView());

    this.$watch("result", (result, oldResult) => {
      if (result == oldResult) return;
      this.$emit("update:result", result);
    });

    this.$watch("resultFn", resultFn => {
      this.$emit("update:resultFn", resultFn);
    });

    this.$on("reflow", () => this.reflow());
    this.$on("set:latex", (latex: string | null) => this.latex = latex);
  }

  async setBusy(busy: boolean) {
    const fields = await this.components();
    fields.forEach(f => f.frozen = busy);
  }

  reflow() {
    this.resultView && this.resultView.reflow();
    this.mathField && this.mathField.reflow();
  }

  async updateFields(force: boolean = false) {
    if (this.frozen) return;
    if (!this.isInitialReady && !force) return;

    // tell the parent to lock all math fields (preventing them from infinitely updating)
    await this.setBusy(true);

    this.$emit('recalc:start');

    nerdamer.clearVars();
    const components = await this.components();
    const scope = {};

    for (let c of components) {
      try {
        await c.calc(scope);
      } catch (e) {
        console.debug(`Couldn't update MathField`, e);
      }
    }
    
    this.$emit('recalc:complete');

    // unlock the math fields
    await this.setBusy(false);
  }

  /**
   * Calculates the result of this quill using the given scope
   */
  async calc(scope: any) {
    if (!this.latex) {
      // reset the component, its empty
      this.result = this.resultFn = this.lastLatex = null;
      return;
    }

    if (this.latex === this.lastLatex) {
      return;
    }

    this.lastLatex = this.latex;

    this.lastScope = Object.assign({}, scope);

    const { result, resultFn } = await _.MathKit.calculateWithScope(
      this.latex,
      scope,
      this.mathJS
    );

    this.resultFn = resultFn;

    return (this.result = result);
  }

  /**
   * Gets all Vue components of this tool from the parent layer
   */
  components(): Promise<MathField[]> {
    return new Promise(resolve => this.$emit("get:components", resolve));
  }

  updateResultView() {
    let { result } = this;
    if (!result) {
      this.resultView.latex("");
      return;
    }
    switch (this.renderFormat) {
      case "frac":
        var frac = _.MathKit.toFracLatex(result as string);
        if (frac) {
          this.resultView.latex(frac);
          this.reflow();
          break;
        }
      case "dec":
      default:
        try {
          if (isNaN(result as number)) {
            const oldResult = result;
            result = nerdamer(oldResult as string).toTeX();
          }
          if (isTeXer(result)) result = result.toTeX();
        } catch (e) {
          console.debug("failed to render result", e, {
            result,
            latex: this.latex
          });
          result = null;
          break;
        }
        this.resultView.latex(result as string);
        this.reflow();
        break;
    }
  }

  focused() {
    this.$emit("focused");
  }

  unfocused() {
    this.$emit("unfocused");
  }

  serialized() {
    return {
      value: this.latex,
      renderFormat: this.renderFormat
    };
  }

  get atStart() {
    return (
      this.mqRootBlock.firstElementChild &&
      this.mqRootBlock.firstElementChild.classList.contains("mq-cursor")
    );
  }

  get atEnd() {
    return (
      this.mqRootBlock.lastElementChild &&
      this.mqRootBlock.lastElementChild.classList.contains("mq-cursor")
    );
  }

  get mqRootBlock(): HTMLSpanElement {
    return this.$refs.mqMount.querySelector(".mq-root-block") as any;
  }

  get isEmpty(): boolean {
    return (this.latex || "").length === 0;
  }

  /**
   * Returns prop trig state or the default if null
   */
  get _trigState() {
    return this.trigState || this.$store.state.preferences.defaultTrigState;
  }
}
</script>

<style lang="scss">
.mq-calc-root {
  @extend %bg0;
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(min-content, 1fr);
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
</style>