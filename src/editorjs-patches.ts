import EditorJS, { EditorConfig, SanitizerConfig, PasteEvent } from "@editorjs/editorjs";
const List = require('@editorjs/list');
const CheckList = require('@editorjs/checklist');
const janitor = require("html-janitor");
const Code = require('@editorjs/code');
const Raw = require('@editorjs/raw');
const Paragraph = require('@editorjs/paragraph');

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

        const eventForIndex = (specialIndex: number) => {
            const content = specials[specialIndex].children[0];
            return {
                content,
                isBlock: true,
                tool: this.toolsTags[content.tagName].tool,
                event: this.composePasteEvent('tag', {
                    data: content,
                })
            }
        }

        let newResults: any[] = [];

        // translate the results to their specialdata
        result.forEach((ev: any) => {
            const details = ev.content;
            const content = details instanceof HTMLElement && details.innerText;
            if (!content) return newResults.push(ev);
            const contents = content.split(prefix).map(i => parseInt(i)).filter(i => !isNaN(i));
            if (contents.length === 0) return newResults.push(ev);
            contents.forEach(c => newResults.push(eventForIndex(c)));
        });

        newResults = newResults.filter(r => !!r);

        return newResults;
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
function loadToolPatches(editor: EditorJS) {
    // properly gets out of list because the plugin is fucking stupid
    hook(List.prototype, 'getOutofList', old => function (event: KeyboardEvent) {
        old.call(this, event);
        if (!event.defaultPrevented) return;
        this.api.caret.setToBlock(this.api.blocks.getCurrentBlockIndex());
    });

    // Fixes checklist exit list bug because stupid
    hook(CheckList.prototype, 'appendNewElement', old => function(event: KeyboardEvent) {
        const oldStopPropogation = event.stopPropagation;

        let propogationStopped: boolean = false;

        event.stopPropagation = function() {
            propogationStopped = true;
            oldStopPropogation.call(this);
        }

        const insertNewBlock = (editor as any).core.moduleInstances.BlocksAPI.insertNewBlock;
        let shouldInsert: boolean = false;
        (editor as any).core.moduleInstances.BlocksAPI.insertNewBlock = () => shouldInsert = true;

        old.call(this, event);

        (editor as any).core.moduleInstances.BlocksAPI.insertNewBlock = insertNewBlock;

        setTimeout(() => {
            if (!propogationStopped) return;

            this._elements.items[this._elements.items.length - 1].remove();
            this._elements.items.splice(this._elements.items.length - 1, 1);

            if (shouldInsert) {
                let needsFocus = this.Editor.moduleInstances.BlockManager.insert();
                this.Editor.moduleInstances.Caret.setToBlock(needsFocus, this.Editor.moduleInstances.Caret.positions.END)
            }
        }, 0);
    });

    Paragraph.prototype.onTab = function(event: KeyboardEvent) {
        if (!this._suggestions) {
            return false;
        }

        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (typeof this.selectedSuggestion === 'undefined') this.selectedSuggestion = 0;
        else this.selectedSuggestion++;
        const oldSuggestion = this.suggestions[this.selectedSuggestion - 1];
        let suggestion = this.suggestions[this.selectedSuggestion];
        if (!suggestion) suggestion = this.suggestions[this.selectedSuggestion = 0];

        if (oldSuggestion) (oldSuggestion as HTMLElement).classList.remove('active');
        if (suggestion) suggestion.classList.add('active');

        return true;
    }

    Paragraph.prototype.teardownSuggestions = function() {
        if (this._suggestions) (this._suggestions as HTMLElement).remove();
        delete this._suggestions;
        delete this.suggestions;
        delete this.selectedSuggestion;
    }

    Paragraph.prototype.focused = function(newVal: boolean) {
        if (!newVal && this._suggestions) {
            console.log('tearing down suggestions');
            this.teardownSuggestions();
        }
    }

    Paragraph.prototype.selectSuggestion = function(suggestion: HTMLElement) {
        const selected = suggestion.innerText;

        const block = (editor as any).core.moduleInstances.BlockManager.composeBlock(selected, {});
        const currentIndex = (editor as any).core.moduleInstances.BlockManager._blocks.indexOf(this.block);
        (editor as any).core.moduleInstances.BlockManager._blocks.insert(currentIndex, block, true);

        (editor as any).core.moduleInstances.Caret.setToBlock(block);

        this.teardownSuggestions();
    }

    Paragraph.prototype.onEnter = function(event: KeyboardEvent) {
        if (!this._suggestions) {
            return false;
        }

        event.preventDefault();
        event.stopPropagation();
        
        this.selectSuggestion(this.suggestions[this.selectedSuggestion]);

        return true;
    }

    Paragraph.prototype.removed = function() {
        this.teardownSuggestions();
    }

    hook(Paragraph.prototype, 'onKeyUp', old => function(event: KeyboardEvent) {
        old.call(this, event);

        const {textContent} = this._element as HTMLElement;
        if (!textContent!.startsWith('/') || textContent!.substring(1).split(' ').length > 1 || textContent === '/') {
            if (this._suggestions) {
                console.debug('paragraph is tearing down suggestions');
                this.teardownSuggestions();
            }
            return;
        }
        const [ command ] = textContent!.substring(1).split(' ');
        const tools = Object.keys((editor as any).core.moduleInstances.Tools.blockTools);
        const possible = tools.filter(t => t.startsWith(command)).sort((a, b) => a.length - b.length);
        const match = possible.find(t => t === command);

        if (possible.length === tools.length) return;
        
        const wantsExec = event.code === 'Enter';
        const wantsCompletion = event.code === 'Tab';

        if (wantsCompletion) return;

        const suggestions = this.suggestions = possible.map(s => {
            const elm = document.createElement('span');
            elm.innerText = s;
            elm.classList.add('tool-suggestion');
            elm.addEventListener('click', () => this.selectSuggestion(elm));
            return elm;
        });

        if (this._suggestions) (this._suggestions as HTMLElement).remove();
        const suggestionContainer = this._suggestions = document.createElement('span');
        suggestionContainer.style.position = 'absolute';
        suggestionContainer.classList.add('tool-suggestion-container');
        const range = window.getSelection()!.getRangeAt(0).cloneRange();
        range.collapse(true);
        suggestionContainer.style.left = range.getClientRects()[0].left + 'px';

        const getPxStyle = (style: string) => parseFloat((getComputedStyle(this._element) as any)[style].split('px')[0]);

        suggestionContainer.style.top = this._element.getBoundingClientRect().top + getPxStyle('padding-top') + 'px';
        suggestions.forEach(s => suggestionContainer.appendChild(s));

        document.body.appendChild(suggestionContainer);

        this.onTab();
    });

    Code.prototype.ignoreBackspace = Raw.prototype.ignoreBackspace = function(e: KeyboardEvent) {
        const empty = this.block.holder.querySelector('textarea').value.length === 0
        if (empty) {
            const index = this.Editor.moduleInstances.BlockManager.currentBlockIndex;
            this.Editor.moduleInstances.BlockManager.removeBlock(index);
            const previousBlock = this.Editor.moduleInstances.BlockManager.blocks[index];
            let needsFocus = previousBlock;
            if (!previousBlock) {
                needsFocus = this.Editor.moduleInstances.BlockManager.insert(undefined, undefined, undefined, index);
            }
            this.Editor.moduleInstances.Caret.setToBlock(needsFocus, this.Editor.moduleInstances.Caret.positions.END)
            return true;
        }
        return false;
    }
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

    hookSet(Block, 'focused', old => function(newVal) {
        old.call(this, newVal);
        this.call('focused', newVal);
    });

    hookSet(Block, 'selected', old => function(newVal) {
        old.call(this, newVal);
        this.call('selected', newVal);
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



function hasAncestor(node: Node, ancestor: Node) {
    let parent = node;
    if (!parent) return false;
    while (parent) {
        if (parent.isEqualNode(ancestor)) return true;
        parent = parent.parentNode!;
    }
    return false;
}

/**
 * Allows tools to override various events, and exposes keydown to the global event namespace
 * @param editor editor
 */
function loadBlockEventPatches(editor: EditorJS) {
    const core = (editor as any).core;
    const { BlockEvents, BlockManager, Events, Caret, UI } = core.moduleInstances;

    hook(BlockEvents, 'tabPressed', old => function(event: KeyboardEvent) {
         /**
         * Clear blocks selection by tab
         */
        this.Editor.BlockSelection.clearSelection(event);

        const { BlockManager } = this.Editor;
        const currentBlock = BlockManager.currentBlock;

        if (!currentBlock) {
            return;
        }

        const shouldHandoffTabEvent = currentBlock.call('onTab', event);
        if (shouldHandoffTabEvent) return;

        old.call(this, event);
    });

    /**
     * Allows tool to override backspace
     */
    hook(BlockEvents, 'backspace', old => function (event: KeyboardEvent) {
        const currentBlock = BlockManager.currentBlock;

        if (currentBlock.call('ignoreBackspace', event) === true) return;

        old.call(this, event);
    });

    function ancestorHasClass(node: HTMLElement, className: string) {
        let ancestor = node;
        if (!ancestor) return false;
        while (ancestor) {
            if (!ancestor.classList) {
                ancestor = ancestor.parentElement!;
                continue;
            }
            if (ancestor.classList.contains(className)) return true;
            ancestor = ancestor.parentElement!;
        }
        return false;
    }

    hook(BlockManager, 'highlightCurrentNode', old => function() {
        old.call(this);
        setTimeout(() => {
            const focusNode = window.getSelection()!.focusNode;
            const needsFocus = !ancestorHasClass(focusNode as HTMLElement, 'ce-block') || !hasAncestor(focusNode!, BlockManager.currentBlock.holder);
            if (needsFocus) {
                Caret.setToBlock(BlockManager.currentBlock, Caret.positions.END)
            }
        });
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

    hook(BlockEvents, 'enter', old => function(event: KeyboardEvent) {
        const { BlockManager } = this.Editor;
        const { currentBlock } = BlockManager;
        const shouldHandoffEnterEvent = currentBlock.call('onEnter', event);
        if (shouldHandoffEnterEvent) return;
        old.call(this, event);
    });

    hook(UI, 'enterPressed', old => function(event: KeyboardEvent) {
        const { BlockManager, BlockSelection, Caret } = this.Editor;
        const hasPointerToBlock = BlockManager.currentBlockIndex >= 0;

        if (BlockSelection.anyBlockSelected) {
            return old.call(this, event);
        }

        const currentBlock = BlockManager.currentBlock;
        if (currentBlock && currentBlock.tool) {
            if (currentBlock.call('onEnter', event)) return;
        }

        return old.call(this, event);
    })

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

function loadUsabilityPatches(editor: EditorJS) {
    const core = (editor as any).core;
    const { BlockSelection, BlockManager, Caret, Toolbox, Dom: {constructor: $}, RectangleSelection, Selection, Toolbar, UI, Tooltip: { lib: Tooltip } } = core.moduleInstances;

    hook(BlockSelection, 'handleCommandA', old => function(event: KeyboardEvent): void {
        /** allow default selection on native inputs */
        if ($.isNativeInput(event.target) && !this.readyToBlockSelection) {
            return old.call(this, event);
        }

        const workingBlock = this.Editor.BlockManager.getBlock(event.target as HTMLElement);
        if (workingBlock.holder.innerText.trim().length === 0) {
            this.needToSelectAll = true;
        }

        return old.call(this, event);
    });

    hook(RectangleSelection, 'genInfoForMouseSelection', old => function() {
        if (!this.Editor.BlockManager.lastBlock) {
            // insert new block to prevent errors and unexpected functionality
            const block = BlockManager.insert();
            Caret.setToBlock(block);
        }
        return old.call(this);
    });

    // ignore if touchMoving is true
    hook(Toolbox, 'toolButtonActivate', old => function(...args: any[]) {
        if ((editor as any).VueEditor) {
            if ((editor as any).VueEditor.touchMoving) {
                return;
            }
        }
        return old.call(this, ...args);
    });

    function hasTouch() {
        return 'ontouchstart' in document.documentElement
               || navigator.maxTouchPoints > 0
               || navigator.msMaxTouchPoints > 0;
    }

    hook(Tooltip, 'show', old => function(...args: any[]) {
        if (hasTouch()) return;
        old.call(this, ...args);
    })

    hook(UI, 'documentClicked', old => function(...args: any[]) {
        if ((editor as any).VueEditor) {
            if ((editor as any).VueEditor.touchMoving) {
                return;
            }
        }
        return old.call(this, ...args);
    });

    hook(Toolbar, 'move', old => function(forceClose: boolean = true) {
        if (forceClose) {
            /** Close Toolbox when we move toolbar */
            this.Editor.Toolbox.close();
            this.Editor.BlockSettings.close();
        }

        const currentBlock = this.Editor.BlockManager.currentBlock;
        
        if (!currentBlock) {
            return;
        }

        return old.call(this, forceClose);
    });

    hook(UI, 'redactorClicked', old => function(event: MouseEvent) {
        const selection = window.getSelection();

        const collapsed = selection ? selection.isCollapsed : null;
        if (!collapsed) {
            return;
        }
    
        if (!this.Editor.BlockManager.currentBlock) {
            const block = this.Editor.BlockManager.insert();
            Caret.setToBlock(block);
            Toolbar.move(true);
        }

        return old.call(this, event);
    })

    hook(UI, 'removeLoader', old => function() {
        if ((editor as any).VueEditor) {
            return (editor as any).VueEditor.$once('ready', old.bind(this));
        }
        old.call(this);
    });

    hook(BlockManager, 'clearFocused', () => function(skipCurrentBlock: boolean = false) {
        (this.blocks as any[]).forEach( (block, index) => {
            if (skipCurrentBlock && index === this.currentBlockIndex) return;
            block.focused = false
        });
    });

    hook(Toolbar, 'move', old => function(...args: any[]) {
        const currentBlock = BlockManager.currentBlock.holder;
        if (!currentBlock) return;

        BlockManager.clearFocused(true);
        currentBlock.focused = true

        old.call(this, ...args);
    });
}

/**
 * Loads various patches to EditorJS to better integrate
 * @param editor editor
 */
export default async function patchEditorJS(editor: EditorJS) {
    (editor as any).core.editor = editor;

    hook((editor as any).core, 'start', old => async function() {
        await old.call(this).then(() => {
            loadClipboardPatches(editor);
            loadToolPatches(editor);
            loadBlockPatches(editor);
            loadBlockEventPatches(editor);
            loadCaretPatches(editor);
            loadBlockManagerPatches(editor);
            loadUsabilityPatches(editor);
        })
    });
}