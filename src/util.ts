import JSZip from "jszip";
import saver from "file-saver";
import * as mathjs from "mathjs";

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

    /**
     * Prompts a user for a file and returns the raw data
     */
    export function getFiles(): Promise<ArrayBuffer[]> {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.onote';
            input.multiple = true;
            input.addEventListener('change', function (ev) {
                if (!this.files) return reject(new Error('missing files property'));
                resolve(Promise.all(Array.from(this.files).map(file => {
                    return new Promise((resolve, reject) => {
                        if (!file.name.endsWith('.onote')) {
                            return reject(new DisplayableError(`bad filename: ${file.name}`, {
                                title: 'Unsupported File',
                                message: `The file '${file.name}' is unsupported. Please upload .onote files only.`
                            }));
                        }
                        const reader = new FileReader();
                        reader.readAsArrayBuffer(file);
                        reader.addEventListener('load', function () {
                            resolve(this.result as ArrayBuffer);
                        });
                    }) as Promise<ArrayBuffer>;
                })));
            });
            input.click();
        });
    }

    /**
     * Prompts a user for a file and decodes it to a string
     */
    export function getFilesAsString(): Promise<string[]> {
        return getFiles().then(files => {
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

    export function setPreferredColorScheme(mode: 'light' | 'dark') {
        resetPreferredColorScheme();
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

    export namespace Dom {
        export function getCaretPosition(target: HTMLElement) {
            let _range = document.getSelection()!.getRangeAt(0);
            let range = _range.cloneRange();
            range.selectNodeContents(target);
            range.setEnd(_range.endContainer, _range.endOffset);
            const pos = range.toString().length;
            return pos;
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

                const range = createRange(node, { count: index });

                if (range) {
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        }
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

        export type TrigState = 'deg' | 'grad' | 'rad';
    }
}

export default _;