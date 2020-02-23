<template>
    <div :class="{'codex-mq-root': true, 'codex-mq-focused': isFocused}">
        <div :class="{'mq-editable-field': true, 'mq-math-mode': true, 'border-top': borderBottom !== 'mq', border: borderBottom === 'mq'}" ref="mqMount" @focusin='focused' @focusout='unfocused'></div>
        <div :class="{'mq-result-bar': true, 'text-right': true, 'border-bottom': borderBottom === 'error'}" v-show="error !== null">
            {{error}}
        </div>
        <template v-show="error === null">
            <div :class="{'mq-result-bar': true, 'border-bottom': borderBottom === 'result'}" v-show="result !== null">
                <FractionSVG @click='toggleRenderFormat()' v-if="renderFormat === 'dec'" />
                <DecimalSVG @click='toggleRenderFormat()' v-else />
                <span class="mq-result-view" ref="mqResult">
                </span>
            </div>
            <div :class="{'mq-result-bar': true, 'border-bottom': borderBottom === 'fnBar'}" v-if="resultFn !== null">
                <GraphSVG @click='toggleGraph()' />
            </div>
            <div :class="{'border-bottom': borderBottom === 'graph'}" ref="graph" v-show="showGraph">

            </div>
        </template>
        <mq-paste-data :renderFormat="renderFormat" :showGraph="showGraph" :latex="latex">
        </mq-paste-data>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import * as mathjs from "mathjs";
import * as utensils from "latex-utensils";

import FractionSVG from "@/assets/frac.svg?inline";
import DecimalSVG from "@/assets/decimal.svg?inline";
import GraphSVG from "@/assets/graph.svg?inline";

import { SanitizerConfig } from '@editorjs/editorjs';

type TypeWithGeneric<T> = Partial<T>;
type extractGeneric<Type> = Type extends TypeWithGeneric<infer X> ? X : never

let math: typeof import('mathjs');
async function loadMath() {
    const mathjs = await import('mathjs');
    math = mathjs.create(mathjs.all, {}) as any;
    math.import(await import('mathjs-simple-integral' as any), {});
}

declare const d3: any;

function attachProto(obj: any, proto: any) {
    const objKeys = Object.keys(obj);
    Object.keys(proto).filter(k => !objKeys.includes(k)).forEach(key => {
        obj[key] = proto[key];
    });
}

let passiveSupported = false;

try {
  const options = {
    get passive() { // This function will be called when the browser
                    //   attempts to access the passive property.
      passiveSupported = true;
      return false;
    }
  };

  window.addEventListener("test" as any, null!, options);
  window.removeEventListener("test" as any, null!);
} catch(err) {
  passiveSupported = false;
}

const PASTE_DATA_TAG = 'mq-paste-data';

Vue.config.ignoredElements.push(PASTE_DATA_TAG);

function functionsFromContext(context: any): {[key: string]: string} {
    return Object.values(context).filter(g => typeof g === 'function').reduce((acc: any, c: any) => {acc[c.syntax] = c.original.substring(c.syntax.length + 1); return acc;},{}) as any;
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const pending: {
    [nonce: string]: Function;
} = {};

function onmessage(event: MessageEvent) {
    const { nonce, result } = event.data;
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
    resolve(result);
}

function runAlgebraOnWorker(content: any, context: any): Promise<string> {
    const worker = (window as any).AlgebraWorker;
    if (worker.onmessage === null) {
        worker.onmessage = onmessage;
    }
    return new Promise((resolve, reject) => {
        const functions = functionsFromContext(context);
        const nonce = uuidv4();
        pending[nonce] = resolve;
        worker.postMessage({
            evaluate: content,
            functions,
            nonce
        });
    });
}

@Component({
    components: {
        FractionSVG,
        DecimalSVG,
        GraphSVG
    }
})
export default class MathQuillComponent extends Vue {
    renderFormat: 'dec' | 'frac' = 'dec';
    isFocused: boolean = false;
    latex: string | null = null;
    lastScope: any = {};
    resultFn: Function | null = null;
    result: string | null = null;
    showGraph: boolean = false;
    chart: ReturnType<typeof import('function-plot/lib/index.js')> | null = null;
    error: string | null = null;

    @Prop()
    savedData: {
        latex: string | null;
        renderFormat: 'dec' | 'frac';
        showGraph: boolean;
    }

    $refs: {
        mqMount: HTMLDivElement;
        mqResult: HTMLSpanElement;
        graph: HTMLDivElement;
    };

    mathField: MathQuill.MathField;
    resultView: MathQuill.StaticMath;

    mounted() {
        this.mathField = new MathQuill.MathField(this.$refs.mqMount, {
            handlers: {
                edit: (field) => {
                    this.latex = field.latex();
                    this.updateQuills();
                },
                upOutOf: () => this.$emit('upOutOf'),
                downOutOf: () => this.$emit('downOutOf'),
                moveOutOf: (dir, field) => {
                    if (dir == '1') {
                        // move right
                        this.$emit('navigateNext');
                    } else {
                        // move left
                        this.$emit('navigatePrevious');
                    }
                },
                enter: (field) => {
                    this.$emit('insert');
                }
            },
            autoCommands: "int pi sqrt sum"
        });

        this.resultView = new MathQuill.StaticMath(this.$refs.mqResult);

        Object.keys(this.savedData).forEach((key) => {
            Vue.set(this, key, (this.savedData as any)[key]);
        });

        this.mathField.write(this.latex || '');

        this.$on('preload', () => {
            this.$emit('setIgnoreBackspace', () => (this.latex || '').length > 0);
            this.$emit('setIsEmpty', () => (this.latex || '').length === 0);
            this.$emit('setIsAtStart', () => this.mqRootBlock.firstElementChild && this.mqRootBlock.firstElementChild.classList.contains('mq-cursor'));
            this.$emit('setIsAtEnd', () => this.mqRootBlock.lastElementChild && this.mqRootBlock.lastElementChild.classList.contains('mq-cursor'));
            this.$emit('setSave', () => ({latex: this.latex, renderFormat: this.renderFormat, showGraph: this.showGraph}));
            this.$emit('setPasteConfig', {tags: [PASTE_DATA_TAG]});

            this.$emit('ready');
        });

        this.$on('updateQuills', (resolve?: (value: void) => any) => this.updateQuills().then(resolve));
        this.$on('moved', () => this.updateQuills());

        this.$on('parsePaste', (e: CustomEvent) => {
            const data: HTMLElement = e.detail.data;
            const renderFormat = data.getAttribute('renderFormat');
            const latex = data.getAttribute('latex');
            const showGraph = data.getAttribute('showGraph');

            this.mathField.write(latex || '');
            this.updateQuills().then(() => {
                this.renderFormat = (renderFormat as any) || this.renderFormat;
                this.showGraph = Boolean(showGraph);
            });
        });

        this.$watch('renderFormat', () => {
            if (!this.result) return;
            this.updateResultView(this.result);
        });

        this.$watch('result', (result) => {
            this.updateResultView(result);
        });

        this.$watch('resultFn', (resultFn) => {
            if (!resultFn) return this.removeGraph();
            if (!this.showGraph) return;
            this.updateGraph();
        });

        this.$watch('showGraph', (showGraph: boolean) => {
            if (showGraph) {
                this.updateGraph();
            } else {
                this.removeGraph();
            }
        });
    }

    get mqRootBlock(): HTMLSpanElement {
        return this.$refs.mqMount.querySelector('.mq-root-block') as any;
    }

    /**
     * Returns true if block has focused class
     */
    get isActive() {
        try {
            return this.$el.parentElement!.parentElement!.classList.contains('ce-block--focused');
        } catch {
            return false;
        }
    }

    get borderBottom() {
        if (this.result !== null) return 'result';
        else if (this.showGraph && this.chart !== null) return 'graph';
        else if (this.resultFn !== null) return 'fnBar';
        else if (this.error !== null) return 'error';
        else return 'mq';
    }

    /**
     * Converts latex to math and returns it
     */
    async math() {
        if (!this.latex) return null;
        const parsed = utensils.latexParser.parse(this.latex);
        const expression = await runAlgebraOnWorker(parsed.content, this.lastScope);
        return expression.toString();
    }

    /**
     * Quill was focused.
     */
    focused() {
        this.isFocused = true;
        this.$emit('hidePlusButton');
        this.$emit('showToolbar');
    }

    /**
     * Quill was unfocused.
     */
    unfocused() {
        this.isFocused = false;
        if (this.isActive) return;
        this.$emit('showToolbar');
    }

    /**
     * Updates quills in their DOM order
     */
    async updateQuills() {
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

    async updateGraph() {
        if (!this.resultFn) return;
        if (this.chart) this.removeGraph();

        const { default: plot } = await import('function-plot/lib/index.js');

        this.chart = plot({
            target: this.$refs.graph,
            tip: {
                xLine: true,
                yLine: true,
                renderer: (x, y) => `(${x}, ${y})`
            },
            data: [
                {
                    fn: 'fn',
                    scope: {
                        fn: this.resultFn
                    },
                    nSamples: 1000,
                    sampler: 'mathjs',
                    graphType: 'polyline'
                }
            ],
            width: this.$refs.mqMount.clientWidth
        });

        this.fixChart();
    }

    /**
     * Fixes inconsistencies in the function-plot chart object
     */
    fixChart() {
        if (!this.chart) return;
        const options = this.chart.options;
        const prototype = d3.select(options.target).selectAll('svg')
            .data([options]).__proto__;
        attachProto(this.chart!.root, prototype);
        attachProto(this.chart!.canvas, prototype);
        Object.defineProperty(this.chart, 'content', {
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

    /**
     * Calculates the result of this quill using the given scope
     */
    async calc(scope: any) {
        if (!math) await loadMath();
        this.lastScope = Object.assign({}, scope);
        this.error = null;

        let result, mathStr = await this.math();

        if (!mathStr) return this.result = null;

        try {
            const compiled = math.parse(mathStr).compile();
            result = compiled.evaluate(scope);
        } catch (e) {
            result = mathStr;
            console.debug(`couldn't evaluate math, treating it as an expression`, {
                scope,
                result,
                error: e
            });
        } finally {
            if (typeof result !== 'function') this.resultFn = null;
            if (typeof result === 'function' || typeof result === 'undefined') {
                if (typeof result === 'function') {
                    try {
                        result(0);
                    } catch (e) {
                        this.error = e.message;
                        result = null;
                    }
                    if (result) {
                        result['original'] = mathStr;
                    }
                    this.resultFn = result;
                }
                result = null;
            }
        }

        this.result = result;

        return result;
    }

    toggleGraph() {
        this.showGraph = !this.showGraph;
    }

    async updateResultView(result: any) {
        if (!math) await loadMath();
        switch (this.renderFormat) {
            case 'frac':
                var frac = await this.fraction(result);
                if (frac) {
                    this.resultView.latex(frac);
                    break;
                }
            case 'dec':
            default:
                try {
                    result = math.simplify(result);
                    if (typeof result.toLatex === "function") result = result.toLatex();
                    if (typeof result.toTex === "function") result = result.toTex();
                } catch(e) {
                    console.debug('failed to render result', {
                        result
                    });
                    result = 'error';
                }
                this.resultView.latex(result);
                break;
        }
    }

    /**
     * Returns a fraction representation
     */
    async fraction(result: string) {
        if (!math) await loadMath();
        try {
            return (math.fraction(result) as any).toLatex();
        } catch {
            return null;
        }
    }

    toggleRenderFormat() {
        this.renderFormat = this.renderFormat === 'dec' ? 'frac' : 'dec';
    }

    /**
     * Gets all Vue components of this tool from the Editor layer
     */
    components(): Promise<MathQuillComponent[]> {
        return new Promise((resolve) => this.$emit('get:components', resolve));
    }
}
</script>

<style lang="scss">
.codex-mq-root {
    display: flex;
    flex-flow: column;
    justify-content: center;
    transition: border 0.5s linear;
    padding: 10px 0;

    .border-bottom {
        border-radius: 0 0 5px 5px !important;

        svg {
            border-radius: 0 0 5px 5px !important;
        }
    }

    .border-top {
        border-radius: 5px 5px 0 0 !important;
    }

    .border {
        border-radius: 5px !important;
    }

    .mq-editable-field {
        @extend %bg0;
        border: none;
        padding: 10px;

        .mq-sup, .mq-sub, .mq-sup-inner {
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
    }

    svg.function-plot {
        @extend %bg2;
        width: 100%;
    }

    .mq-result-bar {
        @extend %bg1;
        font-family: Symbola,"Times New Roman",serif;
        display: flex;
        flex-flow: row;
        align-items: center;
        height: 36px;

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

        & > .mq-result-view {
            text-align: right;
            flex-grow: 1;
            display: flex;
            flex-flow: row-reverse;
            align-items: center;
            margin-right: 10px;

            & > .mq-root-block {
                width: min-content !important;
                font-size: 60% !important;
            }

            &:not(.mq-math-mode) {
                &::after {
                    margin-right: 5px;
                }
            }

            &::after {
                content: '= ';
            }
        }
    }
}
</style>