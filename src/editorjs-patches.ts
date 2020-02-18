import EditorJS, { EditorConfig, SanitizerConfig, PasteEvent } from "@editorjs/editorjs";
const List = require('@editorjs/list');
const CheckList = require('@editorjs/checklist');
const janitor = require("html-janitor");

function hook(lib: any, meth: string, replacement: (old: Function) => (this: any, ...args: any[]) => any) {
    const oldMeth = lib[meth] || (() => void 0);
    const newMeth = replacement(oldMeth);
    lib[meth] = function (...args: any[]) {
        return newMeth.apply(this, args);
    }
}

function hookGet(lib: any, prop: string, replacement: (old: Function) => (this: any) => any) {
    const oldGet = Object.getOwnPropertyDescriptor(lib, prop)!.get!;
    const newGet = replacement(oldGet);
    Object.defineProperty(lib, prop, {
        get() {
            return newGet.call(this);
        }
    });
}

function hookSet(lib: any, prop: string, replacement: (old: Function) => (this: any, newVal: any) => any) {
    const oldSet = Object.getOwnPropertyDescriptor(lib, prop)!.set!;
    const newSet = replacement(oldSet);
    Object.defineProperty(lib, prop, {
        set(newVal) {
            return newSet.call(this, newVal);
        }
    });
}

/**
 * Loads patches to be applied to the EditorJS clipboard system, allows complex tools to easily serialize/deserialize
 * @param editor editorjs instance
 */
function loadClipboardPatches(editor: EditorJS) {
    const core = (editor as any).core;
    const { Dom: { constructor: Dom } , Sanitizer, Paste, BlockSelection, } = (editor as any).core.moduleInstances;

    /**
     * Patched janitor generator, accounts for overrides from EditorJS
     * @param config sanitizer config
     */
    function createHTMLJanitorInstance(config: { tags: SanitizerConfig }) {
        var janet = null;
        if (config) {
            const blockElements: string[] = core.configuration.blockElements || [];
            const inlineElements: string[] = core.configuration.inlineElements || [];
            const specialElements: string[] = core.configuration.specialElements || [];
            blockElements.forEach(block => config.tags[block] = true);
            inlineElements.forEach(inline => config.tags[inline] = true);
            janet = new janitor(Object.assign({}, config, {
                blockElements: blockElements.map((str: string) => str.toUpperCase()),
                inlineElements: inlineElements.map((str: string) => str.toUpperCase()),
                specialElements: specialElements.map((str: string) => str.toUpperCase()),
                keepNestedBlockElements: true
            }));
        }
        return janet;
    }

    hook(Sanitizer.__proto__, 'createHTMLJanitorInstance', old => createHTMLJanitorInstance);

    /**
     * Returns true if and only if the node or its descendants contain a special element.
     * @param node node to search
     */
    function hasSpecial(node: Node): boolean {
        if (core.configuration.specialElements.includes(node.nodeName.toLowerCase())) return true;
        const childs = Array.from(node.childNodes);
        return childs.some(child => hasSpecial(child));
    }

    /**
     * If special elements are present, ensure processText knows to treat it as HTML
     */
    hook(Paste, 'processText', old => function (...args: any[]) {
        const [data] = args;

        const sandbox = document.implementation.createHTMLDocument();
        const host = sandbox.createElement('div');
        host.innerHTML = data;

        if (hasSpecial(host)) {
            return old.call(this, host.innerHTML, true);
        }

        return old.call(this, ...args);
    });

    /**
     * If the node is special, never treat it as empty
     */
    hook(Dom, 'isEmpty', old => function(node: Node): boolean {
        if (core.configuration.specialElements.includes(node.nodeName.toLowerCase())) {
            return false;
        }
        return old.call(this, node);
    })

    /**
     * Ensures special nodes are translated to the correct tool event
     */
    hook(Paste, 'processHTML', old => function (innerHTML: string) {
        const wrapper: HTMLDivElement = Dom.make('DIV');

        wrapper.innerHTML = innerHTML;

        /**
         * Specials are replaced with a text fragment containing a unique string that maps back to the specials data
         */
        const specials: any[] = [];
        const specialTexts: string[] = [];
        let children = Array.from(wrapper.children);

        const prefix = '_32@!#+_'

        children.forEach((child, index) => {
            if (!hasSpecial(child)) return;
            specials[index] = child;
            const text = `${prefix}${index}`;
            specialTexts[index] = text;
            const replacement = document.createTextNode(text);
            wrapper.replaceChild(replacement, child);
        });

        /**
         * The mangled children are then passed to the original code, and then we replace the text fragment events with tool events
         */
        let result: any[] = old.call(this, wrapper.innerHTML);

        result = result.map((ev: any) => {
            const specialIndex = ev.content && specialTexts.indexOf(ev.content.innerText);
            if (specialIndex === -1) return ev;
            const content = specials[specialIndex].children[0];
            if (!children) return ev;
            return {
                content,
                isBlock: true,
                tool: this.toolsTags[content.tagName].tool,
                event: this.composePasteEvent('tag', {
                    data: content,
                })
            }
        });

        return result;
    });

    /**
     * Copies supplied text to the clipboard
     * @param text text to copy
     */
    function copyTextToClipboard(text: string) {
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

    /**
     * Ensures the correct sanitizer is used (which will take into account special elements)
     */
    hook(BlockSelection, 'copySelectedBlocks', old => function () {
        const fakeClipboard = document.createElement('div');

        this.selectedBlocks.forEach((block: any) => {
            /**
             * Make <p> tag that holds clean HTML
             */

            const cleanHTML = this.Editor.Sanitizer.clean(block.holder.innerHTML, this.sanitizerConfig);
            const fragment = document.createElement('p');

            fragment.innerHTML = cleanHTML;
            fakeClipboard.appendChild(fragment);
        });

        copyTextToClipboard(fakeClipboard.innerHTML);
    });

    hookGet(Dom, 'blockElements', old => function() {
        const elements = old.call(this);
        core.configuration.specialElements.forEach((e: string) => elements.push(e.toLowerCase()));
        return elements;
    });
}

/**
 * Patches bugs in tools to make them work properly/in an expected behavior
 */
function loadToolPatches() {
    // properly gets out of list because the plugin is fucking stupid
    hook(List.prototype, 'getOutofList', old => function (event: KeyboardEvent) {
        old.call(this, event);
        if (!event.defaultPrevented) return;
        this.api.caret.setToBlock(this.api.blocks.getCurrentBlockIndex());
    });
    
    hook(KeyboardEvent.prototype, 'stopPropogation', old => function(...args: any[]) {
        old.call(this, ...args);
        this.propogationStopped = true;
    });

    // Fixes checklist exit list bug because stupid
    hook(CheckList.prototype, 'appendNewElement', old => function (event: KeyboardEvent) {
        old.call(this, event);
        if (!(event as any).propogationStopped) return;
        const lastChild: Element = this._elements.items[this._elements.items.length - 1].querySelector(`.${this.CSS.textField}`);
        lastChild.parentElement!.remove();
        this.api.caret.setToBlock(this.api.blocks.getCurrentBlockIndex());
    });
}

/**
 * Better integrates tools into the EditorJS API
 * @param editor editor
 */
function loadBlockPatches(editor: EditorJS) {
    const core = (editor as any).core;

    const Block = core.moduleInstances.BlockManager.composeBlock(core.config.initialBlock, {}, {}).__proto__;

    /**
     * Allows tools to implement the isEmpty check
     */
    hookGet(Block, 'isEmpty', old => function () {
        const result = this.call('isEmpty');
        if (typeof result === 'boolean') return result;
        return old.call(this);
    });

    /**
     * Allows calls to be passed to the tool
     */
    Block.call = function (this: typeof Block, methodName: string, params?: object) {
        if (this.tool[methodName] && this.tool[methodName] instanceof Function) {
            try {
                return this.tool[methodName](params);
            } catch (e) {
                console.warn(`Error during '${methodName}' call: ${e.message}`);
            }
        }
    }

    /**
     * Expose the core and block to the tool
     */
    hook(Block, 'compose', old => function (this: typeof Block) {
        this.tool.Editor = core;
        this.tool.block = this;
        return old.call(this);
    });
}

/**
 * Allows tools to override various events, and exposes keydown to the global event namespace
 * @param editor editor
 */
function loadBlockEventPatches(editor: EditorJS) {
    const core = (editor as any).core;
    const { BlockEvents, BlockManager, Events } = core.moduleInstances;

    /**
     * Allows tool to override backspace
     */
    hook(BlockEvents, 'backspace', old => function (event: KeyboardEvent) {
        const currentBlock = BlockManager.currentBlock;

        if (currentBlock.call('ignoreBackspace', event) === true) return;

        old.call(this, event);
    });

    /**
     * Allows tool to override enter
     */
    hook(BlockEvents, 'enter', old => function(event: KeyboardEvent) {
        const currentBlock = BlockManager.currentBlock;

        if (currentBlock.call('ignoreEnter', event) === true) return;

        old.call(this, event);
    });

    /**
     * Allows tool to override arrow keys
     */
    hook(BlockEvents, 'arrowLeftAndUp', old => function (event: KeyboardEvent) {
        const { currentBlock } = this.Editor.BlockManager;
        const direction = event.keyCode === 38 ? 'up' : 'left';
        if (currentBlock.tool && currentBlock.tool.keyOverrides && currentBlock.tool.keyOverrides.indexOf(direction) > 0) return;
        old.call(this, event);
    });

    /**
     * Allows tool to override arrow keys
     */
    hook(BlockEvents, 'arrowRightAndDown', old => function (event: KeyboardEvent) {
        const { currentBlock } = this.Editor.BlockManager;
        const direction = event.keyCode === 40 ? 'down' : 'right';
        if (currentBlock.tool && currentBlock.tool.keyOverrides && currentBlock.tool.keyOverrides.indexOf(direction) > 0) return;
        old.call(this, event);
    });

    /**
     * Allows tool to override enter key
     */
    hook(BlockEvents, 'enter', old => function (event: KeyboardEvent) {
        const { BlockManager } = this.Editor;
        const { tool } = BlockManager.currentBlock;
        if (tool && tool.customEnter === true) return;
        old.call(this, event);
    });

    /**
     * Dispatch keydown to the main events world
     */
    hook(BlockEvents, 'keydown', old => function (...args) {
        old.call(this, ...args);
        Events.emit('keydown', ...args);
    });
}

/**
 * Allows tools to implement their own position logic, and dispatches changes to the event world
 * @param editor editor
 */
function loadCaretPatches(editor: EditorJS) {
    const core = (editor as any).core;
    const { Caret, Events } = core.moduleInstances;
    const CaretProto = Caret.__proto__;

    /**
     * Prevent caret selection of null
     */
    hook(Caret, 'setToBlock', old => function (block: any, position: string, offset: number) {
        if (block === null) return;
        old.call(this, block, position, offset);
    });

    /**
     * Dispatches caret changes to the main events world
     */
    hook(Caret, 'set', old => function (...args: any[]) {
        old.call(this, ...args);
        Events.emit('caretChanged', ...args);
    });

    /**
     * Allows tools to implement their own isAtStart logic
     */
    hookGet(CaretProto, 'isAtStart', old => function () {
        const currentBlock = this.Editor.BlockManager.currentBlock;
        const blockSaysAtStart = currentBlock.call('isAtStart');
        if (typeof blockSaysAtStart === 'boolean') return blockSaysAtStart;
        return old.call(this);
    });

    /**
     * Allows tools to implement their own isAtEnd logic
     */
    hookGet(CaretProto, 'isAtEnd', old => function () {
        const currentBlock = this.Editor.BlockManager.currentBlock;
        const blockSaysAtEnd = currentBlock.call('isAtEnd');
        if (typeof blockSaysAtEnd === 'boolean') return blockSaysAtEnd;
        return old.call(this);
    });
}

/**
 * Notifies tools when moved, allows tools to deny paste, attaches to blockIndexChanged listener
 * @param editor editor
 */
function loadBlockManagerPatches(editor: EditorJS) {
    const core = (editor as any).core;
    const { BlockManager } = core.moduleInstances;

    /**
     * Allows tools to implement checks for whether pastes are valid
     */
    BlockManager.paste = function (toolName: string, pasteEvent: PasteEvent, replace: boolean = false) {
        let block;

        if (replace) {
            block = this.replace(toolName);
        } else {
            block = this.insert(toolName);
        }

        if (block.call('canPaste', pasteEvent) === false) {
            this.removeBlock(this.blocks.indexOf(block));
            return null;
        }

        try {
            block.call('onPaste', pasteEvent);
        } catch (e) {
            console.error(`${toolName}: onPaste callback call is failed`, e);
        }

        return block;
    }

    /**
     * Notify tools that they were moved
     */
    hook(BlockManager._blocks, 'swap', old => function (first: number, second: number) {
        const firstBlock = this.blocks[first];
        const secondBlock = this.blocks[second];
        old.call(this, first, second);
        firstBlock.call('moved', 1);
        secondBlock.call('moved', 2);
    });

    /**
     * Dispatches that the block index changed if there is a listener registered on the editor instance
     */
    hookSet(BlockManager.__proto__, 'currentBlockIndex', old => function (newVal) {
        old.call(this, newVal);
        const updateHandler = (editor as any).blockIndexDidChange;
        if (typeof updateHandler === 'function') updateHandler(newVal);
    });
}

/**
 * Loads various patches to EditorJS to better integrate
 * @param editor editor
 */
export default function patchEditorJS(editor: EditorJS) {
    (editor as any).core.editor = editor;

    loadClipboardPatches(editor);
    loadToolPatches();
    loadBlockPatches(editor);
    loadBlockEventPatches(editor);
    loadCaretPatches(editor);
    loadBlockManagerPatches(editor);
}