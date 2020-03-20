<template>
  <div class="editor-container" ref="mountPoint"></div>
</template>

<script lang="ts">
import EditorJS, { OutputData, EditorConfig, BlockToolConstructable } from "@editorjs/editorjs";
import { Component, Vue, Prop } from "vue-property-decorator";
import { Note } from "../store";
import { toolForVueComponent } from "../tools/MQVueTool";
import MathQuillComponent from "./MathQuillComponent.vue";
import CalculatorTool from "./CalculatorTool.vue";
import patchEditorJS from "../editorjs-patches";
import _ from "../util";
import { ONoteSocket } from '../socket';

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
const Link = require("@editorjs/link");

export interface CRUDPacket {
  action: "create" | "replace" | "update" | "delete";
  data: {
    uuid: string;
    data: any;
  };
}

@Component
export default class EditorJSHost extends Vue {
  editor: EditorJS = null as any;
  blockIndex: number = NaN;
  lastData: any = null;
  hasChanges: boolean = false;

  $refs: {
    mountPoint: HTMLDivElement;
  };

  mounted() {
    this.$watch("noteID", async (newID: string, oldID: string) => {
      if (!this.editor) return;
      if (newID === oldID) return;

      this.save(oldID).then(() => this.save(newID));

      this.editor.clear();

      if (!this.cachedData) return;

      await this.renderData(this.cachedData);
    });

    this.$watch('socket', (socket: ONoteSocket | null) => {
      if (!socket) return;
      socket.crudAccepter = (note: string, packet: CRUDPacket) => {
        if (this.noteID !== note) return;
        this.receiveCRUD(packet);
      }
    }, { immediate: true });

    this.$on("shouldSwitchTool", (tool: string) => this.switchToTool(tool));
    this.$on("crud-receive", (crud: CRUDPacket) => this.receiveCRUD(crud));

    this.$on("ready", () => {
      this.refreshMathQuillComponents();
    });

    this.createEditor();
  }

  refreshMathQuillComponents() {
    const firstMQ: MathQuillComponent | undefined = this.$children.find(c => c instanceof MathQuillComponent) as any;
    if (!firstMQ) return;
    firstMQ.$refs.mathField.updateFields(true);
  }

  switchToTool(tool: string) {
    console.log('switching the fuck to a new tool NOW');
    const toolClass = this.getModule("Tools").toolsClasses[tool] as BlockToolConstructable;

    this.getModule("Toolbox").insertNewBlock(toolClass, tool);
  }

  async renderData(data: OutputData) {
    data = data || this.cachedData;

    await this.editor.clear();

    if (!data || !data.blocks) return;

    await this.editor.render(data);
  }

  async editorDidLoad() {
    await this.renderData(this.cachedData);

    Vue.set(
      this.$root.$children[0],
      "tooltip",
      this.getModule("API").methods.tooltip
    );

    this.$emit("ready");
  }

  handleCRUD(packet: CRUDPacket) {
    if (!this.socket) return;
    if (!this.canCollaborate) return;
    console.log(packet);
    this.socket.send({
      action: "/note/crud",
      data: {
        note: this.noteID,
        packet
      }
    });
  }

  receiveCRUD({action, data: { uuid, data }}: CRUDPacket) {
    const BlockManager = this.getModule("BlockManager");
    const basisIndex = BlockManager.getBlockByUUID(uuid);
    console.log({ action, data: { uuid, data }, basisIndex });
    switch (action) {
      case "create":
        BlockManager.insert(data['name'], data['data'], data['settings'], basisIndex, false, true);
        break;
      case "replace":
        var newBlock = BlockManager.composeBlock(data['toolName'], data['data'], {}, uuid);
        BlockManager._blocks.insert(basisIndex, newBlock, true);
        break;
      case "update":
        switch (data['toolName']) {
          case "math":
            const tool: InstanceType<ReturnType<typeof toolForVueComponent>> = BlockManager.getBlockByIndex(basisIndex).tool;
            tool.send("setr:latex", data['data']['data']['latex']);
            return;
        }
        var newBlock = BlockManager.composeBlock(data['toolName'], data['data']['data'], data['settings'], data['settings']['__uuid__']);
        BlockManager._blocks.insert(basisIndex, newBlock, true);
        break;
      case "delete":
        BlockManager.removeBlock(basisIndex, true);
        break;
    }
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
      onChange: () => this.save(),
      onInsert: (before, data) => {
        this.handleCRUD({action: "create", data: { uuid: before!, data }});
      },
      onReplace: (uuid, data) => {
        this.handleCRUD({action: "replace", data: { uuid, data }});
      },
      onUpdate: (mutation) => {
        this.handleCRUD({action: "update", data: mutation});
      },
      onRemove: (uuid) => {
        this.handleCRUD({action: "delete", data: { uuid, data: null }});
      },
      shouldSwallowUpdate: (uuid: string) => {
        return !this.getModule("BlockManager").getBlockByUUID(uuid);
      },
      tools: this.addConditionalTools({
        math: toolForVueComponent(
          MathQuillComponent,
          {
            title: "Math",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                <path d="M 4 2 C 2.895 2 2 2.895 2 4 L 2 9 C 2 10.105 2.895 11 4 11 L 9 11 C 10.105 11 11 10.105 11 9 L 11 4 C 11 2.895 10.105 2 9 2 L 4 2 z M 15 2 C 13.895 2 13 2.895 13 4 L 13 9 C 13 10.105 13.895 11 15 11 L 20 11 C 21.105 11 22 10.105 22 9 L 22 4 C 22 2.895 21.105 2 20 2 L 15 2 z M 6 4 L 7 4 L 7 6 L 9 6 L 9 7 L 7 7 L 7 9 L 6 9 L 6 7 L 4 7 L 4 6 L 6 6 L 6 4 z M 15 6 L 20 6 L 20 7 L 15 7 L 15 6 z M 4 13 C 2.895 13 2 13.895 2 15 L 2 20 C 2 21.105 2.895 22 4 22 L 9 22 C 10.105 22 11 21.105 11 20 L 11 15 C 11 13.895 10.105 13 9 13 L 4 13 z M 15 13 C 13.895 13 13 13.895 13 15 L 13 20 C 13 21.105 13.895 22 15 22 L 20 22 C 21.105 22 22 21.105 22 20 L 22 15 C 22 13.895 21.105 13 20 13 L 15 13 z M 4.71875 15.03125 L 6.5 16.78125 L 8.28125 15.03125 L 8.96875 15.71875 L 7.21875 17.5 L 8.96875 19.28125 L 8.28125 19.96875 L 6.5 18.21875 L 4.71875 19.96875 L 4.03125 19.28125 L 5.78125 17.5 L 4.03125 15.71875 L 4.71875 15.03125 z M 15 16 L 20 16 L 20 17 L 15 17 L 15 16 z M 15 18 L 20 18 L 20 19 L 15 19 L 15 18 z"/>
            </svg>`
          },
          {
            tags: ["MQ-PASTE-DATA"]
          }
        ),
        calculator: toolForVueComponent(CalculatorTool, {
          title: "Calculator",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path
              d="M2 0v24h20v-24h-20zm5 22h-3v-3h3v3zm0-4h-3v-3h3v3zm0-4h-3v-3h3v3zm4 8h-3v-3h3v3zm0-4h-3v-3h3v3zm0-4h-3v-3h3v3zm4 8h-3v-3h3v3zm0-4h-3v-3h3v3zm0-4h-3v-3h3v3zm5 8h-3v-7h3v7zm0-8h-3v-3h3v3zm0-6h-16v-6h16v6zm-1-1h-14v-4h14v4z" />
            </svg>`
        }),
        checklist: Checklist,
        code: Code,
        // raw: Raw,
        delimiter: Delimiter,
        embed: Embed,
        inlineCode: InlineCode,
        list: {
          class: List,
          inlineToolbar: true
        },
        marker: {
          class: Marker,
          shortcut: "CMD+SHIFT+U"
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
      }),
      data,
      logLevel: "VERBOSE" as any,
      ["blockElements" as any]: ["mq-paste-data"],
      ["specialElements" as any]: ["mq-paste-data"],
      ["patch" as any]: patchEditorJS
    });

    (this.editor as any).VueEditor = this;

    this.editor.isReady.then(() => this.editorDidLoad());

    (this.editor as any).blockIndexDidChange = (index: number) => {
      if (index > -1) this.blockIndex = index;
      const block = (this.editor as any).core.moduleInstances.BlockManager
        .blocks[index];
      if (!block) return;
      this.$emit("selectTool", block.name);
    };
  }

  addConditionalTools<T>(tools: T): T {
    if (this.sdk) {
      // add link tool
      (tools as any).link = {
        class: Link,
        config: {
          endpoint: `${this.sdk.baseURL}/api/v1/tools/link/metadata`
        }
      };
    }
    return tools;
  }

  /**
   * Saves Codex data to store
   */
  async save(id: string = this.noteID) {
    if (!this.$store.state.notes[id]) return;

    if (!(await this.didChangesHappen())) return;

    const data = await this.editor.save();

    this.$store.commit("updateNote", {
      data,
      id
    });

    if (this.sdk) {
      await this.sdk.editNote(id, { data });
    }
  }

  async didChangesHappen() {
    const BlockManager = this.getModule("BlockManager");
    const blocks: Array<{ save(): Promise<any>, tool: { save?: () => any } }> = BlockManager.blocks;
    const data = JSON.stringify(
      await Promise.all(
        blocks.filter(b => b.tool && typeof b.tool.save === "function").map(b =>
          b.save().then(res => _.filterObject(res, key => key !== "time"))
        )
      )
    );
    if (data === this.lastData) return false;
    this.lastData = data;
    return true;
  }

  firstBlockOfType(name: string) {
    return (this.editor as any).core.moduleInstances.BlockManager.blocks.find(
      (block: { name: string }) => block.name === name
    );
  }

  /**
   * Returns a private API module
   * @note uses private APIs
   */
  getModule(module: string) {
    return (this.editor as any).core.moduleInstances[module];
  }

  get sdk() {
    return this.$store.getters.authSDK;
  }

  get socket(): ONoteSocket | null {
    return this.$store.getters.socket;
  }

  get canCollaborate(): boolean {
    return this.$store.getters.permitCollaboration;
  }

  get cachedData() {
    return this.note && this.note.data;
  }

  get note(): Note {
    return this.$store.getters.currentNote;
  }

  get noteID() {
    return this.$store.getters.currentNoteID;
  }

  /**
   * Parses tools in Codex and transforms them to usable toolbox data
   * @note uses private APIs
   */
  get toolboxData() {
    if (!this.editor) return {};
    try {
      const tools = (this.editor as any).core.moduleInstances.Tools
        .toolsClasses;
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
  z-index: 100;

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
    &,
    .codex-editor,
    .codex-editor__redactor {
      border: none !important;
      height: unset;
      overflow-y: visible;
      width: 100vw !important;
    }
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

    .codex-editor__redactor,
    .codex-editor__loader {
      min-height: 100%;
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

    & .ce-inline-toolbar__dropdown,
    & .ce-inline-tool {
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
    line-height: 1.4em !important;
    padding: 0.8em 0;
  }

  .cdx-marker {
    @include schemeResponsive("background", "highlight-color");
    @extend %text;
  }

  .link-tool__input {
    @extend %bg0;
    @extend %border1;
    padding-left: 12px;
  }

  .link-tool__input-holder {
    .link-tool__progress {
      @extend %bg2;
    }
  }

  .link-tool__input-holder--error {
    .link-tool__input {
      @include bgSchemeResponsive("redBad1");
      @include borderSchemeResponsive("redAlt");
      @include textSchemeResponsive("redAlt2");
      background-image: none;
    }
  }

  .link-tool__content {
    @extend %bgAlt7;
    @extend %border1;
    // @extend %text;
    .link-tool__title {
      @extend %text;
    }

    .link-tool__description {
      @extend %text;
    }

    .link-tool__anchor {
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
  }
}

.tool-suggestion-container {
  @extend %textAlt1;
  display: flex;
  flex-flow: row;
  margin: 0 2.5px;
  line-height: 1em;
  z-index: 1000;

  & > .tool-suggestion {
    margin: 0 2.5px;
    transition: color 0.0625s linear;

    &.active,
    &:hover {
      @extend %textAlt2;
      cursor: pointer;
    }
  }
}

@media print {
  .ce-toolbar {
    display: none !important;
  }
}
</style>