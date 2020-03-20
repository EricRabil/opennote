import JSZip from "jszip";
import saver from "file-saver";
import * as mathjs from "mathjs";
import plot from "function-plot/lib/index.js";
import { latexParser } from 'latex-utensils';

declare const d3: any;
type Chart = ReturnType<typeof plot>;

export namespace _ {
    interface DisplayableErrorOptions {
        title?: string;
        message: string;
    }

    export class DisplayableError extends Error {
        constructor(message: string, public options: DisplayableErrorOptions) {
            super(message);
        }
    }

    export function uuidv4() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0,
                v = c == "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    export function clearQueryString() {
        const urlNoQuery = `${location.origin}${location.pathname}`;
        const query = new URLSearchParams(location.search);
        history.replaceState({path: urlNoQuery},'', urlNoQuery);
        return query;
    }

    /**
     * Programatically saves a file to the browser
     * @param data the data to save
     * @param name name of file
     * @param type MIME type
     */
    export function saveFile(data: any, name: string, type: string = 'text/plain') {
        const blob = new Blob([data], { type });
        const e = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            detail: 0,
            screenX: 0,
            screenY: 0,
            clientX: 0,
            clientY: 0,
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            metaKey: false,
            button: 0,
            relatedTarget: null
        });
        const a = document.createElement('a');
        a.download = name;
        a.href = window.URL.createObjectURL(blob);
        a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
        a.dispatchEvent(e);
    }

    export interface TransferOptions {
        accept: string;
        multiple: boolean;
        parseData: boolean;
    }

    export function readFiles(files: File[]): Promise<ArrayBuffer[]> {
        return Promise.all(files.map(file => new Promise((resolve, reject) => {
            if (!file.name.endsWith('.onote')) {
                reject(new DisplayableError(`bad filename: ${file.name}`, {
                    title: 'Unsupported File',
                    message: `The file '${file.name}' is unsupported. Please upload .onote files only.`
                }));
            }
            const reader = new FileReader();
            reader.readAsArrayBuffer(file);
            reader.addEventListener('load', function () {
                resolve(this.result as ArrayBuffer);
            });
        }) as any));
    }

    export function promptForFiles(options: Partial<TransferOptions>): Promise<ArrayBuffer[] | File[]> {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = options.accept!;
            input.multiple = options.multiple!;
            input.addEventListener('change', function(ev) {
                if (!this.files) return reject(new Error('missing files property'));
                const files = Array.from(this.files);
                if (!options.parseData) return resolve(files);
                readFiles(files).then(resolve);
            });
            input.click();
        });
    }

    /**
     * Prompts a user for a file and returns the raw data
     */
    export function getFiles(options: Partial<Exclude<TransferOptions, "parseData">>): Promise<ArrayBuffer[]> {
        return promptForFiles({...options, parseData: true}) as any;
    }

    /**
     * Prompts a user for a file and decodes it to a string
     */
    export function getFilesAsString(options: Partial<Exclude<TransferOptions, "parseData">>): Promise<string[]> {
        return getFiles(options).then(files => {
            const decoder = new TextDecoder('utf-8');
            return files.map(file => decoder.decode(file));
        });
    }

    export function registerDevModule(data: any) {
        Object.assign(window, data);
    }

    export function filterObject<T>(obj: T, filter: (key: string, value: any) => boolean): T {
        return Object.keys(obj).filter(k => filter(k, (obj as any)[k])).reduce((a, c) => { a[c] = (obj as any)[c]; return a; }, {} as any);
    }

    export async function zipFilesAndDownload(zipName: string, files: Array<{ name: string, text: string }>): Promise<void> {
        const zip = new JSZip();
        files.forEach(({ name, text }) => zip.file(name, text));
        const content = await zip.generateAsync({ type: "blob" });
        await saver.saveAs(content, zipName);
    }

    let _mediaRules: MediaList[], originalMedia: string[];

    function computeMediaRules() {
        if (_mediaRules) return _mediaRules;
        _mediaRules = Array.from(document.styleSheets).map((s) => {
            try {
                return Array.from((s as CSSStyleSheet).rules) as any as StyleSheet[];
            } catch {
                return null;
            }
        }).filter(s => !!s).map(s => s!.filter(r => (r as StyleSheet).media).map(r => r.media).filter(r => r.mediaText.includes("prefers-color-scheme"))).reduce((a, c) => a.concat(c), []);
        originalMedia = _mediaRules.map(r => r.mediaText);
        return _mediaRules;
    }

    export function mediaRules() {
        return _mediaRules || computeMediaRules();
    }

    export function ensureDefaults() {
        if (!_mediaRules || !originalMedia) {
            computeMediaRules();
        }
    }

    export function resetPreferredColorScheme() {
        mediaRules().forEach((rule, index) => {
            rule.mediaText = originalMedia[index];
        });
    }

    export function setPreferredColorScheme(mode: 'light' | 'dark' | null) {
        resetPreferredColorScheme();
        if (!mode) return;
        mediaRules().forEach(rule => {
            try {
                switch (mode) {
                    case "light":
                        if (rule.mediaText.includes("light")) rule.deleteMedium("(prefers-color-scheme: light)");
                        if (rule.mediaText.includes("dark")) rule.deleteMedium("(prefers-color-scheme: dark)");
                        break;
                    case "dark":
                        if (rule.mediaText.includes("light") && !rule.mediaText.includes("dark")) {
                            // dark code, fucking kill it
                            rule.deleteMedium("(prefers-color-scheme: light)");
                            rule.appendMedium("speechsexyt");
                        }
                        if (rule.mediaText.includes("dark") && !rule.mediaText.includes("light")) {
                            rule.deleteMedium("(prefers-color-scheme: dark)");
                        }
                        break;
                }
            } catch (e) {
                return;
            }
        });
    }

    export namespace Tooltips {
        export function showTooltip(tooltipLib: any, ev: MouseEvent) {
            const leftOffset = 0;

            if (!tooltipLib) return;
            // no tooltips on mobile, please. its fucking ugly
            if (document.body.clientWidth <= 500) return;
            const tip = (ev.target! as HTMLElement).getAttribute("data-tooltip");
            const placement =
            (ev.target! as HTMLElement).getAttribute("data-placement") || "bottom";
            if (!tip) return;

            const content = document.createTextNode(tip);

            const observer = new MutationObserver(mutation => {
            content.textContent = (ev.target! as HTMLElement).getAttribute(
                "data-tooltip"
            );
            });

            observer.observe(ev.target as HTMLElement, {
            attributes: true,
            attributeFilter: ["data-tooltip"],
            childList: false,
            characterData: false
            });

            tooltipLib.show(ev.target as HTMLElement, content, { placement });
            const tooltipContainers = Array.from(
            document.querySelectorAll(".ct.ct--bottom")
            ) as HTMLElement[];
            tooltipContainers.forEach(tooltipContainer => {
            tooltipContainer.style.left = `${(parseInt(
                tooltipContainer.style.left!.split("px")[0]
            ) || 0) + leftOffset}px`;
            });
        }

        export function hideTooltip(tooltipLib: any, ev: MouseEvent) {
            if (!tooltipLib) return;
            tooltipLib.hide();
        }
    }

    export namespace Graph {
        interface DomainConfiguration {
            xDomain: [number, number],
            yDomain: [number, number]
        }

        /**
         * Creates a standard Graph instance
         */
        export function createGraph(element: HTMLElement, step: number, { xDomain, yDomain }: DomainConfiguration, fn: Function | Function[], { width, height }: { width: number, height: number } = { width: NaN, height: NaN }) {
            if (!Array.isArray(fn)) fn = [fn];
            return applyChartFixes(plot({
                target: element,
                tip: {
                    xLine: true,
                    yLine: true,
                    renderer: (x, y) => `(${x.toFixed(3)}, ${y.toFixed(3)})`
                },
                data: fn.map(fn => ({
                    fn: "fn",
                    step,
                    scope: {
                        fn
                    },
                    nSamples: 1000,
                    sampler: "mathjs",
                    graphType: "polyline"
                })),
                grid: true,
                xAxis: {
                    domain: xDomain
                },
                yAxis: {
                    domain: yDomain
                },
                width,
                height
            }));
        }


        /**
         * Adds strangely missing prototype functions to d3 objects
         */
        function applyChartFixes(chart: Chart) {
            const options = chart.options;
            const prototype = d3
                .select(options.target)
                .selectAll("svg")
                .data([options]).__proto__;

            _.Inheritance.attachProto(chart.root, prototype);
            _.Inheritance.attachProto(chart.canvas, prototype);

            Object.defineProperty(chart, "content", {
                get() {
                    return this._content;
                },
                set(content) {
                    _.Inheritance.attachProto(content, prototype);
                    this._content = content;
                    return true;
                }
            });

            return chart;
        }
    }

    export namespace Inheritance {
        /**
         * Merges a prototype with an object
         * @param obj object
         * @param proto prototype to merge
         */
        export function attachProto(obj: any, proto: any) {
            const objKeys = Object.keys(obj);
            Object.keys(proto)
                .filter(k => !objKeys.includes(k))
                .forEach(key => {
                    obj[key] = proto[key];
                });
        }
    }

    export namespace Dom {
        export function getCaretPosition(target: HTMLElement) {
            try {
                let _range = document.getSelection()!.getRangeAt(0);
                let range = _range.cloneRange();
                range.selectNodeContents(target);
                range.setEnd(_range.endContainer, _range.endOffset);
                const pos = range.toString().length;
                return pos;
            } catch {
                return 0;
            }
        }

        export function hasAncestor(node: Node, ancestor: Node) {
            let parent = node;
            if (!parent) return false;
            while (parent) {
                if (parent.isEqualNode(ancestor)) return true;
                parent = parent.parentNode!;
            }
            return false;
        }

        /**
         * https://stackoverflow.com/a/37285344
         */
        export function isElementVisibleRelativeToParent(element: HTMLElement, partial: boolean = false) {
            const container = element.parentElement!;

            //Get container properties
            let cTop = container.scrollTop;
            let cBottom = cTop + container.clientHeight;

            //Get element properties
            let eTop = element.offsetTop;
            let eBottom = eTop + element.clientHeight;

            //Check if in view    
            let isTotal = (eTop >= cTop && eBottom <= cBottom);
            let isPartial = partial && (
                (eTop < cTop && eBottom > cTop) ||
                (eBottom > cBottom && eTop < cBottom)
            );

            //Return outcome
            return (isTotal || isPartial);
        }

        export function isElementVisible(el: HTMLElement) {
            const rect = el.getBoundingClientRect();
            const { top: elemTop, bottom: elemBottom } = rect;
            const isVisible = ((elemTop) >= 0) && ((elemBottom) <= window.innerHeight);

            return isVisible;
        }

        function createRange(
            node: Node,
            chars: { count: number },
            range?: Range
        ): Range {
            if (!range) {
                range = document.createRange();
                range.selectNode(node);
                range.setStart(node, 0);
            }

            if (chars.count === 0) {
                range.setEnd(node, chars.count);
            } else if (node && chars.count > 0) {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.textContent!.length < chars.count) {
                        chars.count -= node.textContent!.length;
                    } else {
                        range.setEnd(node, chars.count);
                        chars.count = 0;
                    }
                } else {
                    for (var lp = 0; lp < node.childNodes.length; lp++) {
                        range = createRange(node.childNodes[lp], chars, range);

                        if (chars.count === 0) {
                            break;
                        }
                    }
                }
            }

            return range;
        }

        export function setCurrentCursorPosition(index: number, node: Node) {
            if (index >= 0) {
                const selection = window.getSelection()!;

                if (!node.parentNode) {
                    console.warn('No parent node was set.');
                    return;
                }

                const range = createRange(node, { count: index });

                if (range) {
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        }
    }

    /**
     * Copies supplied text to the clipboard
     * @param text text to copy
     */
    export function copyTextToClipboard(text: string) {
        const el = document.createElement('div');
        el.className = 'codex-editor-clipboard';
        el.innerText = text;

        document.body.appendChild(el);

        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNode(el);

        window.getSelection()!.removeAllRanges();
        selection!.addRange(range);

        document.execCommand('copy');
        document.body.removeChild(el);
    }

    export namespace MathKit {
        const inputFunctions = ['sin', 'cos', 'tan', 'sec', 'cot', 'csc'];
        const outputFunctions = ['asin', 'acos', 'atan', 'atan2', 'acot', 'acsc', 'asec'];

        function patchFunctions(math: mathjs.MathJsStatic, functions: string[], state: () => string, mutator: (fn: (x: number) => number) => (x: number) => number) {
            return functions.reduce((acc: any, cur) => {
                const original = math[cur as keyof typeof math];

                const fnNumber = mutator(original);

                acc[cur] = math.typed(cur, {
                    'number': fnNumber,
                    'Array | Matrix': x => math.map(x, fnNumber)
                });

                return acc;
            }, {});
        }

        function patchInputFunctions(math: mathjs.MathJsStatic, state: () => TrigState) {
            return patchFunctions(math, inputFunctions, state, fn => function (x: number) {
                // convert from configured type of angles to radians
                switch (state()) {
                    case 'deg':
                        return fn(x / 360 * 2 * Math.PI);
                    case 'grad':
                        return fn(x / 400 * 2 * Math.PI);
                    default:
                        return fn(x);
                }
            });
        }

        function patchOutputFunctions(math: mathjs.MathJsStatic, state: () => TrigState) {
            return patchFunctions(math, outputFunctions, state, fn => function (x) {
                const result = fn(x)

                if (typeof result === 'number') {
                    // convert to radians to configured type of angles
                    switch (state()) {
                        case 'deg': return result / 2 / Math.PI * 360
                        case 'grad': return result / 2 / Math.PI * 400
                        default: return result
                    }
                }

                return result
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

        function runAlgebraOnWorker(content: any, context: any): Promise<{ result: string, flags: { noVarSubInPostProcessing: boolean } }> {
            const worker = (window as any).AlgebraWorker;
            if (worker.onmessage === null) {
                worker.onmessage = onmessage;
            }
            return new Promise((resolve) => {
                const functions = _.MathKit.functionsFromContext(context);
                const variables = _.MathKit.variablesFromContext(context);
                const nonce = _.uuidv4();
                pending[nonce] = resolve;
                worker.postMessage({
                    evaluate: content,
                    functions,
                    variables,
                    nonce
                });
            });
        }

        function extractSymbolsFromMathString(str: string, mathJS: mathjs.MathJsStatic) {
            const parsed = mathJS.parse(str);
            return parsed
                .filter(n => n.isSymbolNode)
                .map(n => n.toString())
                .filter(n => !(mathJS as any)[n])
                .filter((n, i, a) => a.indexOf(n) === i);
        }

        export function calculateMathFromLatex(latex: string, scope: any) {
            const { content } = latexParser.parse(latex);
            return runAlgebraOnWorker(content, scope);
        }

        export async function calculateWithScope(latex: string, scope: any, mathJS: mathjs.MathJsStatic) {

            let retVal: { result: string | null, resultFn: (Function & { original: string }) | null } = {
                result: null,
                resultFn: null
            }

            const { flags: parserFlags, result: mathStr } = await calculateMathFromLatex(latex, scope);
            let compiled;
            if (!mathStr) return retVal;

            try {
                compiled = mathJS.parse(mathStr).compile();
            } catch (e) {
                console.debug(`failed to parse result from algebra slave`, {
                    e,
                    mathStr,
                    scope,
                    latex
                });
                return retVal;
            }

            console.debug("compiled expression", {
                latex,
                mathStr,
                compiled
            });

            let result = mathStr;

            if (!parserFlags.noVarSubInPostProcessing) {
                try {
                    result = compiled.evaluate(scope);
                } catch (e) {
                    result = mathStr;
                }
            }

            // try to create a function from this IF THERES ONLY ONE VARIABLE
            if (typeof result === "string") {
                const symbols = extractSymbolsFromMathString(result, mathJS);
                if (symbols.length === 1) {
                    const [symbol] = symbols;
                    const template = `f(${symbol})=${result}`;
                    let fn: Function | null = mathJS.parse(template).compile().evaluate({});

                    try {
                        fn!(0);
                    } catch {
                        fn = null;
                    }

                    if (fn) {
                        (fn as any)["original"] = template;
                        retVal.resultFn = fn as any;
                    }
                }
            }
            // append original string to functions in context
            else if (typeof result === "function") {
                (result as any)["original"] = mathStr;
                retVal.resultFn = result;
            }
            // round results to 10th decimal
            else if (typeof result === "number") {
                result = mathJS.round(result, 10);
            }

            if (typeof result !== "function") retVal.result = result;

            return retVal;
        }

        /**
         * Implements patched trig functions that are configurable for deg/grad/rad
         * @param math mathjs instance
         * @param state function that returns the current output statae
         */
        export function loadPatchedMathFunctions(math: mathjs.MathJsStatic, state: () => TrigState) {
            const replacements = Object.assign({}, patchInputFunctions(math, state), patchOutputFunctions(math, state));
            math.import(replacements, { override: true });

            return math;
        }

        /**
         * Determines the minimum and maximum value of the function given the bounds
         */
        export function minMaxOfFn(fn: Function, step: number, xMin: number, xMax: number): [number, number] {
            if (!fn) return [NaN, NaN];

            let values: number[] = [];

            let result;
            for (let i = xMin; i < xMax; i += step) {
                try {
                    result = fn(i);
                } catch (e) {
                    result = NaN;
                }
                values.push(result);
            }

            values = values.sort((a, b) => a - b);

            const range = [values[0], values[values.length - 1]];

            return range as [number, number];
        }

        /**
         * Returns a fraction representation
         */
        export function toFracLatex(math: string) {
            try {
                return (mathjs.fraction(math) as any).toLatex();
            } catch {
                return null;
            }
        }

        /**
         * Extracts functions from the context, returning a JSON object
         * @param context mathjs context
         */
        export function functionsFromContext(context: any): { [key: string]: string } {
            return Object.values(context)
                .filter(g => typeof g === "function")
                .reduce((acc: any, c: any) => {
                    acc[c.syntax] = c.original.substring(c.syntax.length + 1);
                    return acc;
                }, {}) as any;
        }

        /**
         * Extracts variables from the context, returning a JSON object
         * @param context mathjs context
         */
        export function variablesFromContext(context: any): { [key: string]: number } {
            return Object.keys(context)
                .filter(g => typeof context[g] === "number")
                .reduce((acc: any, c: any) => {
                    acc[c] = context[c];
                    return acc;
                }, {});
        }

        export type TrigState = 'deg' | 'grad' | 'rad';
    }
}

export default _;