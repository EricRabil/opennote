import JSZip from "jszip";
import saver from "file-saver";

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

    /**
     * Programatically saves a file to the browser
     * @param data the data to save
     * @param name name of file
     * @param type MIME type
     */
    export function saveFile(data: any, name: string, type: string = 'text/plain') {
        const blob = new Blob([data], {type});
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
            input.addEventListener('change', function(ev) {
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
                        reader.addEventListener('load', function() {
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
        return Object.keys(obj).filter(k => filter(k, (obj as any)[k])).reduce((a,c) => {a[c] = (obj as any)[c]; return a;}, {} as any);
    }

    export async function zipFilesAndDownload(zipName: string, files: Array<{name: string, text: string}>): Promise<void> {
        const zip = new JSZip();
        files.forEach(({name, text}) => zip.file(name, text));
        const content = await zip.generateAsync({type: "blob"});
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
}

export default _;