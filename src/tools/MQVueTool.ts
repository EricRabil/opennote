import { BlockTool, BlockToolConstructable, PasteConfig, PasteEvent, SanitizerConfig } from '@editorjs/editorjs';
import MathQuillComponent from '@/components/MathQuillComponent.vue';
import { VueConstructor } from 'vue/types/umd';

type FirstArgument<T> = T extends new (arg1: infer U, ...args: any[]) => any ? U : any;

export function toolForVueComponent(Component: VueConstructor, toolbox: BlockToolConstructable['toolbox'], pasteConfig: PasteConfig = {}) {
    return class VueTool implements BlockTool {
        constructor(private config: FirstArgument<BlockToolConstructable>) {
        }
    
        static toolbox = toolbox;
        static pasteConfig = pasteConfig;
    
        root: HTMLElement;
        component: Vue;
        pendingPasteEvent: PasteEvent | null = null;
        sanitize: SanitizerConfig;
        ignoreBackspace: () => boolean;
        isEmpty: () => boolean;
        isAtStart: () => boolean;
        isAtEnd: () => boolean;
        toPasteFragment: () => HTMLElement;
        renderSettings: () => HTMLElement;
    
        get keyOverrides() {
            return ['up', 'down', 'left', 'right']
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
    
        render(): HTMLElement {
            this.component = new Component({
                parent: this.Editor.editor.VueEditor,
                propsData: {
                    savedData: (this.config as any).data || {},
                    api: this.config.api
                }
            });
            
            this.component.$mount();
    
            this.component.$on('insert', () => {
                this.Editor.moduleInstances.Caret.setToBlock(this.Editor.moduleInstances.BlockManager.insert());
                this.showToolbar();
                this.Editor.moduleInstances.Toolbar.plusButton.show();
            });
    
            this.component.$on('showToolbar', () => {
                this.showToolbar();
            });
    
            this.component.$on('hidePlusButton', () => {
                this.Editor.moduleInstances.Toolbar.plusButton.hide();
            });
    
            this.component.$on('showPlusButton', () => {
                this.Editor.moduleInstances.Toolbar.plusButton.show();
            });
    
            this.component.$on('navigateNext', () => {
                this.Editor.moduleInstances.Caret.navigateNext(true);
            });
    
            this.component.$on('navigatePrevious', () => {
                this.Editor.moduleInstances.Caret.navigatePrevious(true);
            });
    
            this.component.$on('get:components', (cb: (components: Vue[]) => any) => {
                cb(this.Editor.moduleInstances.BlockManager.blocks.filter((block: any) => block.name === this.block.name).map((block: any) => block.tool.component));
            });
    
            this.component.$on('downOutOf', () => {
                if (this.blockIndex === this.Editor.moduleInstances.BlockManager.blocks.length - 1) return;
                this.Editor.moduleInstances.Caret.navigateNext(true);
                const { currentBlock, currentBlockIndex, blocks } = this.Editor.moduleInstances.BlockManager;
                if (currentBlockIndex !== blocks.length - 1) return;
                if (!currentBlock.isEmpty) return;
                this.Editor.moduleInstances.Events.once('caretChanged', () => {
                    this.Editor.moduleInstances.Toolbar.plusButton.show();
                });
            });
    
            this.component.$on('upOutOf', () => {
                if (this.blockIndex === 0) return;
                this.Editor.moduleInstances.Caret.navigatePrevious(true);
            });
    
            this.component.$on('setIgnoreBackspace', (ignoreBackspace: () => boolean) => this.ignoreBackspace = ignoreBackspace);
            this.component.$on('setIsEmpty', (isEmpty: () => boolean) => this.isEmpty = isEmpty);
            this.component.$on('setIsAtStart', (isAtStart: () => boolean) => this.isAtStart = isAtStart);
            this.component.$on('setIsAtEnd', (isAtEnd: () => boolean) => this.isAtEnd = isAtEnd);
            this.component.$on('setSave', (save: (block: HTMLElement) => any) => this.save = save);
            this.component.$on('setSanitizer', (sanitize: SanitizerConfig) => this.sanitize = sanitize);
            this.component.$on('setRenderSettings', (render: () => HTMLElement) => this.renderSettings = render);

            // run this at the end
            this.component.$emit('preload');

            this.component.$once('ready', () => {
                if (this.pendingPasteEvent) {
                    this.component.$emit('parsePaste', this.pendingPasteEvent);
                    this.pendingPasteEvent = null;
                }
            })
    
            return this.root = document.createElement('div');
        }
    
        moved() {
            this.component.$emit('moved');
        }
    
        removed() {
            this.component.$destroy();
        }
    
        rendered() {
            this.root.replaceWith(this.component.$el);
        }

        onPaste(e: PasteEvent) {
            if (!this.component) return this.pendingPasteEvent = e;
            this.component.$emit('parsePaste', e);
        }
    
        showToolbar() {
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
    }
}