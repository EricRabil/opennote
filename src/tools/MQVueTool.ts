import { BlockTool, BlockToolConstructable, PasteConfig, PasteEvent, SanitizerConfig } from "@editorjs/editorjs";
import { VueConstructor } from "vue/types/umd";

type FirstArgument<T> = T extends new (arg1: infer U, ...args: any[]) => any ? U : any;

/**
 * Implementing a Vue component that supports this API
 * 
 * This API is entirely structured around Vue events and props.
 * 
 * The following calls within your component are supported:
 * 
 * $emit
 *  - ready = call this when your component is done initializing, after preload has completed
 *  - destroy = destroys and removes the component
 *  - insert = inserts a new block following the current block
 *  - showToolbar = shows the toolbar
 *  - hidePlusButton = hides the plus button
 *  - showPlusButton = shows the plus button
 *  - navigateNext = moves to the next block [low level]
 *  - navigatePrevious = moves to the previous block [low level]
 *  - "get:components"(resolve: (components: Vue[]) => any) = returns all vue components wrapped around this tool
 *  - downOutOf = moves to the next block, with added functionality to ensure proper toolbar placement
 *  - upOutOf = moves to the previous block, with added checks for editor functionality
 *  - set* = these allow you to define certain EditorJS-defined properties on the tool wrapper
 *      - setIgnoreBackspace(fn: () => boolean) = return true/false depending on if backspace should be ignored
 *      - setIsEmpty(fn: () => boolean) = return whether component is empty
 *      - setIsAtStart(fn: () => boolean) = return whether caret is at start of component
 *      - setIsAtEnd(fn: () => boolean) = return whether caret is at end of component
 *      - setSave(fn: () => any) = return serialized data for storage
 *      - setSanitizer(config: SanitizerConfig) = set sanitizer config
 *      - setRenderSettings(fn: () => HTMLElement) = set the function that renders the settings element
 *  
 * $on
 *  - preload = called when component should initialize, following the EditorJS lifecycle
 *  - parsePaste(ev: PasteEvent) = called when component was just pasted
 *  - moved = called when the component was moved within the editor
 *  - rendered = called when EditorJS has rendered the component
 *  - [any] = The tool wrapper has a function called send(message: string, ...data: any[], resolve) which passes its arguments to the component in an $emit event. Please call resolve once handling is complete.
 */
export function toolForVueComponent(Component: VueConstructor, toolbox: BlockToolConstructable["toolbox"], pasteConfig: PasteConfig = {}) {
  return class VueTool implements BlockTool {
    constructor(private config: FirstArgument<BlockToolConstructable>) {
    }
    
        static toolbox = toolbox;
        static pasteConfig = pasteConfig;
    
        root: HTMLElement;
        component: Vue;
        pendingPasteEvent: PasteEvent | null = null;
        sanitize: SanitizerConfig;
        enableToolbarAPI: boolean = false;
        ignoreBackspace: () => boolean;
        isEmpty: () => boolean;
        isAtStart: () => boolean;
        isAtEnd: () => boolean;
        toPasteFragment: () => HTMLElement;
        renderSettings: () => HTMLElement;
    
        get keyOverrides() {
          return ["up", "down", "left", "right"]
        }
    
        get customEnter() {
          return true;
        }
    
        // internal API >:)
        Editor: any;
        block: any;
    
        save(block: HTMLElement): object {
          return {};
        }

        willSelect() {
          if (!this.component) return;
          this.component.$emit("willSelect");
        }

        willUnselect() {
          if (!this.component) return;
          this.component.$emit("willUnselect");
        }
    
        render(): HTMLElement {
          this.component = new Component({
            parent: this.Editor.editor.VueEditor,
            propsData: {
              savedData: (this.config as any).data || {},
              api: this.config.api,
              internal: this.Editor
            }
          });
            
          this.component.$mount();
    
          this.component.$on("insert", () => {
            this.Editor.moduleInstances.Caret.setToBlock(this.Editor.moduleInstances.BlockManager.insert());
            this.showToolbar();
            this.Editor.moduleInstances.Toolbar.plusButton.show();
          });

          this.component.$on("destroy", () => {
            this.Editor.moduleInstances.BlockManager.removeBlock(this.blockIndex);
          });
    
          this.component.$on("showToolbar", () => {
            this.showToolbar();
          });

          this.component.$on("enableToolbarAPI", () => this.enableToolbarAPI = true);
    
          this.component.$on("hidePlusButton", () => {
            this.Editor.moduleInstances.Toolbar.plusButton.hide();
          });
    
          this.component.$on("showPlusButton", () => {
            this.Editor.moduleInstances.Toolbar.plusButton.show();
          });
    
          this.component.$on("navigateNext", () => {
            if (this.settingsOpened) return;
            let { nextContentfulBlock } = this.Editor.moduleInstances.BlockManager;
            if (!nextContentfulBlock) {
              nextContentfulBlock = this.Editor.moduleInstances.BlockManager.insert();
            }
            this.Editor.moduleInstances.Caret.setToBlock(nextContentfulBlock, this.Editor.moduleInstances.Caret.positions.START);
          });
    
          this.component.$on("navigatePrevious", () => {
            if (this.settingsOpened) return;
            const { previousContentfulBlock } = this.Editor.moduleInstances.BlockManager;
            if (!previousContentfulBlock) return;
            this.Editor.moduleInstances.Caret.setToBlock(previousContentfulBlock, this.Editor.moduleInstances.Caret.positions.END);
          });
    
          this.component.$on("get:components", (cb: (components: Vue[]) => any) => {
            cb(this.Editor.moduleInstances.BlockManager.blocks.filter((block: any) => block.name === this.block.name).map((block: any) => block.tool.component));
          });
    
          this.component.$on("downOutOf", () => {
            if (this.settingsOpened) return;
            if (this.blockIndex === this.Editor.moduleInstances.BlockManager.blocks.length - 1) return;
            this.Editor.moduleInstances.Caret.navigateNext(true);
            const { currentBlock, currentBlockIndex, blocks } = this.Editor.moduleInstances.BlockManager;
            if (currentBlockIndex !== blocks.length - 1) return;
            if (!currentBlock.isEmpty) return;
            this.Editor.moduleInstances.Events.once("caretChanged", () => {
              this.Editor.moduleInstances.Toolbar.plusButton.show();
            });
          });
    
          this.component.$on("upOutOf", () => {
            if (this.settingsOpened) return;
            if (this.blockIndex === 0) return;
            this.Editor.moduleInstances.Caret.navigatePrevious(true);
          });
    
          this.component.$on("setIgnoreBackspace", (ignoreBackspace: () => boolean) => this.ignoreBackspace = ignoreBackspace);
          this.component.$on("setIsEmpty", (isEmpty: () => boolean) => this.isEmpty = isEmpty);
          this.component.$on("setIsAtStart", (isAtStart: () => boolean) => this.isAtStart = isAtStart);
          this.component.$on("setIsAtEnd", (isAtEnd: () => boolean) => this.isAtEnd = isAtEnd);
          this.component.$on("setSave", (save: (block: HTMLElement) => any) => this.save = save);
          this.component.$on("setSanitizer", (sanitize: SanitizerConfig) => this.sanitize = sanitize);
          this.component.$on("setRenderSettings", (render: () => HTMLElement) => this.renderSettings = render);

          // run this at the end
          this.component.$emit("preload");

          this.component.$once("ready", () => {
            if (this.pendingPasteEvent) {
              this.component.$emit("parsePaste", this.pendingPasteEvent);
              this.pendingPasteEvent = null;
            }
          })
    
          return this.root = document.createElement("div");
        }
    
        moved() {
          this.component.$emit("moved");
        }
    
        removed() {
          this.component.$destroy();
        }
    
        rendered() {
          this.root.replaceWith(this.component.$el);
          this.component.$emit("rendered", this.root);
        }

        onPaste(e: PasteEvent) {
          if (!this.component) return this.pendingPasteEvent = e;
          this.component.$emit("parsePaste", e);
        }
    
        /**
         * This is not useful and errors a lot because its misused.
         * @deprecated
         */
        showToolbar() {
          if (!this.enableToolbarAPI) return;
          this.Editor.moduleInstances.Toolbar.open();
          this.Editor.moduleInstances.BlockManager.highlightCurrentNode();
        }
    
        send(message: string, ...data: any[]) {
          return new Promise((resolve, reject) => {
            this.component.$emit(message, ...data, resolve);
          });
        }
    
        /**
         * Uses internal API to get index of this tool block
         */
        get blockIndex() {
          return this.Editor.moduleInstances.BlockManager.blocks.indexOf(this.block);
        }


        get settingsOpened(): boolean {
          return this.Editor.moduleInstances.BlockSettings.opened;
        }
  }
}