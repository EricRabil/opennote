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
        <span :class="['labels-control labels-control-btn labels-control-btn-danger', canDelete ? '' : 'labels-control-btn-disabled']" @click="deleter(noteID)">
          <span class="label-text">Delete</span>
          <TrashSVG class="alt-icon" />
        </span>
      </span>
      <span class="note-name">
        {{note.name}}
      </span>
      <span class="controls-right">
        <span :class="{'labels-control': true, 'hiding-labels': !showRibbon}" @click="showRibbon = !showRibbon">
          <span class="label-text">Toolbar</span>
          <ToolSVG class="alt-icon" />
        </span>
        <span :class="{'labels-control': true, 'hiding-labels': !showLabels, 'not-important': true}" @click="showLabels = !showLabels">
          <span class="label-text">Labels</span>
        </span>
      </span>
    </div>
    <div class="editor-ribbon-container" v-if="showRibbon">
      <div class="editor-ribbon">
        <span
          :class="{'ribbon-item': true, active: key === active}"
          @click="switchTool(key)"
          v-for="(value, key) in toolboxData"
          :key="key"
        >
          <span class="ribbon-text" v-if="showLabels">{{value.title}}</span>
          <span class="ribbon-icon" v-html="value.icon"></span>
        </span>
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
  showRibbon = false;
  active: string = "";
  lastIndex: number = 0;
  interval: any;
  unloadListener: Function;
  hasChanges: boolean = false;

  @Prop({ default: false })
  showBurger: boolean;

  @Prop()
  exporter: (id: string) => any;

  @Prop()
  deleter: (id: string) => any;

  @Prop({ default: false })
  canDelete: boolean;

  showLabels: boolean = true;

  $refs: {
    mountPoint: HTMLDivElement;
  };

  created() {
      // if theres no note, create it before render
    if (
      Object.keys(this.$store.state.notes).length === 0 ||
      Object.values(this.$store.state.notes).filter(n => !!n).length === 0
    ) {
      this.$store.commit("newNote");
    }

    window.addEventListener('beforeunload', this.unloadListener = () => this.save());
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

    // autosaver (if changes only)
    this.interval = setInterval(() => {
      if (!this.editor) return;
      if (!this.hasChanges) return;
      this.save();
      this.hasChanges = false;
    }, 2000);

    this.createEditor();
  }

  destroyed() {
    clearInterval(this.interval);
    window.removeEventListener('beforeunload', this.unloadListener as any);
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

  /**
   * Returns note data of the currently selected note
   */
  get cachedData() {
    return this.note && this.note.data;
  }

  get note() {
    return this.$store.state.notes[this.noteID];
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
    this.showRibbon = document.body.clientWidth > 500;
    this.save();
    this.$emit("ready");
  }

  /**
   * Creates and mounts a Codex editor, destroying the old one if it exists
   */
  createEditor(data?: any) {
    this.showRibbon = false;

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
        delimiter: Delimiter,
        embed: Embed,
        inlineCode: InlineCode,
        list: List,
        marker: Marker,
        header: Header,
        paragraph: Paragraph,
        quote: Quote,
        raw: Raw,
        simpleImage: SimpleImage,
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
      const tools = (this.editor as any).core.configuration.tools;
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

  & > .editor-burger {
    position: absolute;
    left: 10px;
    cursor: pointer;
  }

  & .note-name {
    flex-grow: 1;
    text-align: center;
  }

  & .labels-control, & .labels-control-btn {
    @extend %bgAlt1;
    padding: 5px;
    border-radius: 5px;
    text-transform: uppercase;
    font-size: 11px;
    margin: 5px;
    transition: background-color 0.0625s linear;
    cursor: pointer;

    & svg.alt-icon {
      display: none;
    }

    @media only screen and (max-width: 650px) {
      & .label-text {
        display: none;
      }

      background: none;

      &.labels-control:not(.labels-control-btn) {
        height: 25px;
        display: flex;
        align-items: center;
        padding: 1px 5px;

        &.not-important {
          display: none;
        }
      }

      & svg.alt-icon {
        @include fillSchemeResponsive("fg1");
        display: initial;
        height: 12px;
      }
    }

    &:hover {
      @extend %bgAlt6;
    }

    &.hiding-labels:not(:hover) {
      background: none;
    }

    &:not(.hiding-labels):hover {
      @extend %bgAlt7;

      &:active {
        @extend %bgAlt2;
      }
    }

    &:active {
      @extend %bgAlt2;
    }

    &.labels-control-btn {
      @extend %bgAlt6;

      &:hover {
        @extend %bgAlt1;

        &.labels-control-btn-danger {
          @extend %bgRed;
          color: white;
        }
      }

      &.labels-control-btn-disabled {
        &:hover {
          cursor: not-allowed;
          @extend %bgAlt2;

          &.labels-control-btn-danger {
            @extend %bgRedBad;
          }
        }
      }
    }
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

.editor-container {
  @extend %border1;
  border-top: 0;
  border-bottom: 0;
  width: 100%;
  max-width: 850px;
  margin: 0 auto;
  padding: 10px 0;
  overflow-y: scroll;

  .codex-editor--narrow .ce-toolbar__plus {
    left: 0px;
  }

  z-index: 0;

  .codex-editor {
    z-index: -5;

    @media only screen and (max-width: 975px) {
      .ce-block {
        margin-right: 0;
        padding-right: 0;
      }

      &.codex-editor--narrow .ce-toolbox {
        left: 34px;
        background: none;
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
      height: 100vh;
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

.editor-view {
  @extend %bgAlt;
  @extend %text;

  display: flex;
  flex-flow: column;
  max-height: 100vh;
}

.editor-ribbon-container {
  @extend %bg;
  @extend %text;
  @extend %fill;
  
  @include schemeResponsive("box-shadow", "shadow-bottom");

  z-index: 5;

  user-select: none;

  .editor-ribbon {
    display: flex;
    flex-flow: row;
    flex-wrap: wrap;

    & > span.ribbon-item {
      display: flex;
      flex-flow: row-reverse;
      padding: 10px 15px;
      align-items: center;

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