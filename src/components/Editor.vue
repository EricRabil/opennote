<template>
  <div class="editor-view">
    <div class="editor-meta-view" v-if="note">
      <span class="controls-left">
        <span v-if="showBurger" class="editor-burger" @click="$emit('burgerClick')">
          &#9776;
        </span>
        <span class="labels-control labels-control-btn" @click="exporter(noteID)">
          <span class="label-text">Export</span>
          <UploadSVG class="alt-icon icon-invert" />
        </span>
      </span>
      <span class="note-name">
        {{name}}
      </span>
      <span class="controls-right">
        <span :class="{'labels-control': true, 'hiding-labels': !showRibbon}" @click="showRibbon = !showRibbon">
          <span class="label-text no-kill">Toolbar</span>
        </span>
        <span :class="{'labels-control': true, 'hiding-labels': !showLabels}" @click="showLabels = !showLabels">
          <span class="label-text no-kill">Labels</span>
        </span>
      </span>
    </div>
    <div class="editor-ribbon-container" v-if="showRibbon">
      <div class="editor-ribbon">
        <template v-for="(value, key) in topLevelToolboxData">
          <span
            :class="{'ribbon-item': true, active: key === active}"
            :data-tooltip="showLabels ? '' : value.title"
            @mouseenter="mouseenter"
            @mouseleave="mouseleave"
            @click="switchTool(key)"
            :key="key"
          >
            <span class="ribbon-text" v-if="showLabels">{{value.title}}</span>
            <span class="ribbon-icon" v-html="value.icon"></span>
          </span>
          <span :class="['tools-drawer-slider', openDrawers.includes(key) ? '' : 'drawer-closed']" :key="`${key}-drawer`" v-if="key in toolDrawers">
            <span class="drawer-toggle" :data-tooltip="`${openDrawers.includes(key) ? 'Close' : 'Open'} ${value.title} Drawer`" @mouseenter="mouseenter" @mouseleave="mouseleave" @click="toggleDrawer(key)"></span>
            <span
              :class="{'ribbon-item': true, active: sliderItemKey === active}"
              :data-tooltip="showLabels ? '' : toolboxData[sliderItemKey].title"
              @mouseenter="mouseenter"
              @mouseleave="mouseleave"
              @click="switchTool(sliderItemKey)"
              v-for="sliderItemKey of toolDrawers[key]"
              :key="sliderItemKey"
            >
              <span class="ribbon-text" v-if="showLabels">{{toolboxData[sliderItemKey].title}}</span>
              <span class="ribbon-icon" v-html="toolboxData[sliderItemKey].icon"></span>
            </span>
          </span>
        </template>
      </div>
    </div>
    <div class="editor-container" ref="mountPoint"></div>
  </div>
</template>

<script lang="ts">
import EditorJS, { OutputData } from "@editorjs/editorjs";
import { Component, Vue, Prop } from "vue-property-decorator";
import { toolForVueComponent } from "@/tools/MQVueTool";
import MathQuillComponent from '@/components/MathQuillComponent.vue';
import UploadSVG from "@/assets/upload.svg?inline";
import TrashSVG from "@/assets/trash.svg?inline";
import ToolSVG from "@/assets/tool.svg?inline";

import patchEditorJS from "../editorjs-patches";
import _ from '../util';

const Checklist = require("@editorjs/checklist");
const Code = require("@editorjs/code");
const Delimiter = require("@editorjs/delimiter");
const Embed = require("@editorjs/embed");
const Header = require("@editorjs/header");
const InlineCode = require("@editorjs/inline-code");
const List = require("@editorjs/list");
const Marker = require("@editorjs/marker");
const Paragraph = require("@editorjs/paragraph");
const Quote = require("@editorjs/quote");
const Raw = require("@editorjs/raw");
const SimpleImage = require("@editorjs/simple-image");
const Table = require("@editorjs/table");
const Warning = require("@editorjs/warning");

/**
 * Wrapper around Codex, manages all communication with it.
 */
@Component({
  components: {
    UploadSVG,
    TrashSVG,
    ToolSVG
  }
})
export default class Editor extends Vue {
  editor: EditorJS;
  active: string = "";
  lastIndex: number = 0;
  interval: any;
  unloadListener: Function;
  hasChanges: boolean = false;

  name: string | null = null;

  overrides: {
    showRibbon: boolean | null;
    showLabels: boolean | null;
  } = {
    showRibbon: null,
    showLabels: null
  }

  ready: boolean = false;

  get showRibbon(): boolean {
    if (!this.ready) return false;
    return this.overrides.showRibbon === null ? this.$store.state.preferences.showToolbox : this.overrides.showRibbon;
  }

  set showRibbon(val: boolean) {
    this.overrides.showRibbon = val;
  }

  get showLabels(): boolean {
    return this.overrides.showLabels === null ? this.$store.state.preferences.showLabels : this.overrides.showLabels;
  }

  set showLabels(val: boolean) {
    this.overrides.showLabels = val;
  }

  @Prop({ default: false })
  showBurger: boolean;

  @Prop()
  exporter: (id: string) => any;

  @Prop()
  deleter: (id: string) => any;

  @Prop({ default: false })
  canDelete: boolean;

  toolDrawers: {[key: string]: string[]} = {
    paragraph: ['list', 'header', 'delimiter', 'quote']
  };

  openDrawers: string[] = [];

  $refs: {
    mountPoint: HTMLDivElement;
  };

  touchMoving: boolean = false;

  created() {
      // if theres no note, create it before render
    if (
      Object.keys(this.$store.state.notes).length === 0 ||
      Object.values(this.$store.state.notes).filter(n => !!n).length === 0
    ) {
      this.$store.dispatch('newNote');
    }

    window.addEventListener('beforeunload', this.unloadListener = () => this.save());
  }

  toggleDrawer(drawer: string) {
    if (this.openDrawers.includes(drawer)) return this.openDrawers.splice(this.openDrawers.indexOf(drawer));
    this.openDrawers.push(drawer);
  }

  mounted() {
      // when the noteID in store changes, save & reload the editor
    this.$watch("noteID", async (newID: string, oldID) => {
      if (!this.editor) return;

      this.save(oldID);

      this.editor.clear();

      if (!this.cachedData) return;

      const note = this.note;

      this.hasChanges = false;
      await this.renderData(this.cachedData);
    });

    this.$store.subscribe(mutation => {
      switch (mutation.type) {
        case 'updateNote':
        case 'setNote':
          this.name = this.note.name;
      }
    });

    this.name = this.note.name;

    this.$el.addEventListener('touchmove', () => this.touchMoving = true);
    this.$el.addEventListener('touchend', () => this.touchMoving = false);

    // autosaver (if changes only)
    this.interval = setInterval(() => {
      if (!this.editor) return;
      if (!this.hasChanges) return;
      this.save();
      this.hasChanges = false;
    }, 250);

    this.createEditor();
  }

  destroyed() {
    clearInterval(this.interval);
    window.removeEventListener('beforeunload', this.unloadListener as any);
  }

  mouseenter(ev: MouseEvent) {
    if (!(ev.target as HTMLElement).getAttribute('data-tooltip')) return;
    this.$parent.$emit('ct-mouseenter', ev);
  }

  mouseleave(ev: MouseEvent) {
    if (!(ev.target as HTMLElement).getAttribute('data-tooltip')) return;
    this.$parent.$emit('ct-mouseleave', ev);
  }

  async renderData(data: OutputData) {
    data = data || this.cachedData;
    if (!data || !data.blocks) return;
    await this.editor.render(data || this.cachedData);

    const quill = (this
      .editor as any).core.moduleInstances.BlockManager.blocks.find(
      (block: any) => block.name === "math"
    );
    if (quill) await quill.tool.send('updateQuills');
  }

  get quills() {
    return (this.editor as any).core.moduleInstances.BlockManager.blocks.filter((block: {name: string}) => block.name === 'math');
  }

  get notInMainToolbox() {
    return Object.values(this.toolDrawers).reduce((a,c) => a.concat(c), []);
  }

  /**
   * Returns note data of the currently selected note
   */
  get cachedData() {
    return this.note && this.note.data;
  }

  get note() {
    return this.$store.state.notes[this.noteID] || {};
  }

  /**
   * Returns the currently selected note ID
   */
  get noteID() {
    return this.$store.state.currentNote;
  }

  /**
   * Updates stored active note ID
   */
  set noteID(newVal: string) {
    this.$store.commit("setNote", newVal);
  }

  /**
   * Saves Codex data to store
   */
  async save(id: string = this.noteID) {
    if (!this.$store.state.notes[id]) return;
    if (!this.hasChanges) return;

    this.$store.commit("updateNote", {
      data: await this.editor.save(),
      id
    });
  }

  /**
   * Called when Codex is ready
   */
  async editorLoaded() {
    await this.renderData(this.cachedData);

    (this.editor as any).core.moduleInstances.Events.on('keydown', (ev: KeyboardEvent) => {
        this.hasChanges = true;
    });

    // reveal tooltip lib
    Vue.set(this.$root.$children[0], 'tooltip', this.getModule('API').methods.tooltip);

    // only show ribbon by default if we are on big screen
    await this.save();

    const redactor = (this.editor as any).core.moduleInstances.UI.nodes.redactor;

    var observer = new MutationObserver((mutation) => {
      console.debug('reflowing mathquills');
      this.quills.forEach((q: any) => q.tool.send('reflow'));
    });

    observer.observe(redactor, {
      attributes: true, 
      attributeFilter: ['class'],
      childList: false, 
      characterData: false
    });

    this.$emit("ready");

    this.ready = true;
  }

  /**
   * Creates and mounts a Codex editor, destroying the old one if it exists
   */
  createEditor(data?: any) {
    if (this.editor) {
      this.editor.destroy();
    }

    this.editor = new EditorJS({
      holder: this.$refs.mountPoint,
      tools: {
        math: toolForVueComponent(MathQuillComponent, {
            title: 'Math',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                <path d="M 4 2 C 2.895 2 2 2.895 2 4 L 2 9 C 2 10.105 2.895 11 4 11 L 9 11 C 10.105 11 11 10.105 11 9 L 11 4 C 11 2.895 10.105 2 9 2 L 4 2 z M 15 2 C 13.895 2 13 2.895 13 4 L 13 9 C 13 10.105 13.895 11 15 11 L 20 11 C 21.105 11 22 10.105 22 9 L 22 4 C 22 2.895 21.105 2 20 2 L 15 2 z M 6 4 L 7 4 L 7 6 L 9 6 L 9 7 L 7 7 L 7 9 L 6 9 L 6 7 L 4 7 L 4 6 L 6 6 L 6 4 z M 15 6 L 20 6 L 20 7 L 15 7 L 15 6 z M 4 13 C 2.895 13 2 13.895 2 15 L 2 20 C 2 21.105 2.895 22 4 22 L 9 22 C 10.105 22 11 21.105 11 20 L 11 15 C 11 13.895 10.105 13 9 13 L 4 13 z M 15 13 C 13.895 13 13 13.895 13 15 L 13 20 C 13 21.105 13.895 22 15 22 L 20 22 C 21.105 22 22 21.105 22 20 L 22 15 C 22 13.895 21.105 13 20 13 L 15 13 z M 4.71875 15.03125 L 6.5 16.78125 L 8.28125 15.03125 L 8.96875 15.71875 L 7.21875 17.5 L 8.96875 19.28125 L 8.28125 19.96875 L 6.5 18.21875 L 4.71875 19.96875 L 4.03125 19.28125 L 5.78125 17.5 L 4.03125 15.71875 L 4.71875 15.03125 z M 15 16 L 20 16 L 20 17 L 15 17 L 15 16 z M 15 18 L 20 18 L 20 19 L 15 19 L 15 18 z"/>
            </svg>`
        }, {
          tags: ['MQ-PASTE-DATA']
        }),
        checklist: Checklist,
        code: Code,
        // raw: Raw,
        delimiter: Delimiter,
        embed: Embed,
        inlineCode: InlineCode,
        list: {
          class: List,
          inlineToolbar: List
        },
        marker: {
          class: Marker,
          shortcut: 'CMD+SHIFT+U',
        },
        header: {
          class: Header,
          inlineToolbar: true
        },
        paragraph: {
          class: Paragraph,
          inlineToolbar: true
        },
        quote: {
          class: Quote,
          inlineToolbar: true
        },
        image: SimpleImage,
        table: Table,
        warning: Warning
      },
      data,
      logLevel: "VERBOSE" as any,
      ['blockElements' as any]: ['mq-paste-data'],
      ['specialElements' as any]: ['mq-paste-data'],
      ['patch' as any]: patchEditorJS
    });

    (this.editor as any).VueEditor = this;

    this.editor.isReady.then(() => this.editorLoaded());

    (this.editor as any).blockIndexDidChange = (index: number) => {
      if (index > -1) this.lastIndex = index;
      const block = (this.editor as any).core.moduleInstances.BlockManager
        .blocks[index];
      if (!block) return;
      this.active = block.name;
    };
  }

  /**
   * Selects a different tool for editing
   * @note uses private APIs
   */
  switchTool(key: string) {
    const BlockManager = this.getModule("BlockManager");
    const Caret = this.getModule("Caret");
    const Toolbox = this.getModule("Toolbar");
    const block = BlockManager.composeBlock(key, {});
    BlockManager._blocks.insert(this.lastIndex, block, true);
    Caret.setToBlock(block);
    Toolbox.close();
  }

  /**
   * Returns a private API module
   * @note uses private APIs
   */
  getModule(module: string) {
    return (this.editor as any).core.moduleInstances[module];
  }

  /**
   * Parses tools in Codex and transforms them to usable toolbox data
   * @note uses private APIs
   */
  get toolboxData() {
    try {
      const tools = (this.editor as any).core.moduleInstances.Tools.toolsClasses;
      return Object.keys(tools)
        .map(k => ({ key: k, toolbox: tools[k].toolbox }))
        .filter(k => !!k.toolbox)
        .reduce((acc, { key, toolbox }) => {
          acc[key] = toolbox;
          return acc;
        }, {} as any);
    } catch (e) {
      return {};
    }
  }

  get topLevelToolboxData() {
    return _.filterObject(this.toolboxData, key => !this.notInMainToolbox.includes(key));
  }
}
</script>

<style lang="scss">
.editor-meta-view {
  @extend %borderBottom;
  position: sticky;
  display: flex;
  flex-flow: row;
  min-height: 44px;
  justify-content: center;
  align-items: center;
  user-select: none;

  @media print {
    display: none !important;
  }

  & > .editor-burger {
    position: absolute;
    left: 10px;
    cursor: pointer;
  }

  & .note-name {
    flex-grow: 1;
    text-align: center;
  }

  & > .controls-left, & > .controls-right {
    display: flex;
    flex-flow: row;
    align-items: center;

    & .editor-burger {
      margin: 5px;
    }

    &.controls-left {
      margin-left: 10px;
    }

    &.controls-right {
      margin-right: 10px;
    }
  }
}

@media only screen and (max-width: 1150px) {
  .home:not(.nav-collapse) .editor-container {
    border: 0 !important;
  }
}

@media only screen and (max-width: 900px) {
  .home .editor-container {
    border: 0 !important;
  }
}

.tool-suggestion-container {
  @extend %textAlt1;
  display: flex;
  flex-flow: row;
  margin: 0 2.5px;
  line-height: 1em;

  & > .tool-suggestion {
    margin: 0 2.5px;
    transition: color 0.0625s linear;

    &.active, &:hover {
      @extend %textAlt2;
      cursor: pointer;
    }
  }
}

.ce-inline-toolbar {
  @extend %bg0;
  @extend %border;
  & svg {
    @extend %fill;
  }

  & .ce-conversion-toolbar {
    @extend %bg0;
    @extend %border;

    & .ce-conversion-tool {
      &:hover {
        @extend %bgAlt2;
      }
    }
  }

  & .ce-inline-toolbar__dropdown, & .ce-inline-tool {
    &:hover {
      @extend %bgAlt2;
    }
  }
}

.ce-header {
  padding: 0 !important;
  margin: 0 !important;
}

.ce-paragraph {
  box-sizing: border-box;
  line-height: 1em !important;
}

.editor-container {
  @extend %border1;
  @include scrollbar();
  border-top: 0;
  border-bottom: 0;
  width: 100%;
  max-width: 850px;
  margin: 0 auto;
  padding: 10px 0;
  overflow-y: scroll;

  .ce-block--selected .ce-block__content {
    @extend %bg3;
  }

  &:only-child {
    height: 100%;
  }

  &:nth-child(2) {
    height: calc(100% - 45px);
  }

  &:nth-child(3) {
    height: calc(100% - 90px);
  }

  @media print {
    border: none !important;
    color: black !important;
  }

  .codex-editor--narrow .ce-toolbar__plus {
    left: 0px;
  }

  z-index: 0;

  .codex-editor {
    z-index: -5;
    height: 100%;

    @media only screen and (max-width: 975px) {
      .ce-block {
        margin-right: 0;
        padding-right: 0;
      }

      .ce-toolbox {
        left: 34px;
        right: 40px;
        background: none;
        overflow-x: scroll;
      }

      .ce-toolbar__plus {
        left: 0px;
      }

      .ce-block__content {
        max-width: calc(100% - 90px);
        margin: 0;
        padding-left: 34px;
      }
    }

    .codex-editor__redactor, .codex-editor__loader {
      height: 100%;
    }
  }
}

.nav-collapse {
  @media only screen and (max-width: 975px) {
    .ce-toolbar__content {
      margin: 0;
    }

    .codex-editor--narrow .ce-toolbar__actions {
      right: 10px;
    }

  //   .editor-container .codex-editor .codex-editor__redactor {
  //     .ce-block.ce-block--focused {
  //       margin: 0;
  //       padding: 0;
  //     }
  //   }
  }
}

@media print {
  .ce-toolbar {
    display: none !important;
  }
}

.editor-view {
  @extend %bgAlt;
  @extend %text;

  display: flex;
  flex-flow: column;
  width: stretch;

  padding-right: env(safe-area-inset-right);

  .cdx-marker {
    @include schemeResponsive("background", "highlight-color");
    @extend %text;
  }
}

.editor-ribbon-container {
  @extend %bg;
  @extend %text;
  @extend %fill;
  
  @include schemeResponsive("box-shadow", "shadow-bottom");

  @media print {
    display: none !important;
  }

  z-index: 5;

  user-select: none;

  .editor-ribbon {
    display: flex;
    flex-flow: row;
    flex-wrap: wrap;

    @media only screen and (max-width: 500px) {
      overflow-x: scroll;
      overflow-y: hidden;
      flex-wrap: nowrap;
    }

    & > .tools-drawer-slider {
      display: contents;

      & .drawer-toggle {
        @extend %fill;
        @extend %text;
        display: flex;
        align-items: center;
        padding: 0 5px;

        &::after {
          font-size: 20px;
        }
      }

      &.drawer-closed .drawer-toggle::after {
        content: '\00bb';
      }
      
      &:not(.drawer-closed) .drawer-toggle::after {
        content: '\00ab';
      }

      &.drawer-closed .ribbon-item {
        display: none;
      }
    }

    & span.ribbon-item, & span.drawer-toggle {
      &:hover {
        @extend %bg0;
        cursor: pointer;
      }

      &:active {
        @extend %bg2;
      }

      &.active {
        @extend %bg1;
      }
    }

    & span.ribbon-item {
      display: flex;
      flex-flow: row-reverse;
      padding: 10px 15px;
      height: 22px;
      align-items: center;

      & > span.ribbon-text {
        height: min-content;
        margin-left: 5px;
      }

      & > span.ribbon-icon {
        line-height: 0;
      }
    }
  }
}
</style>