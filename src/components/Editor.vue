<template>
  <div class="editor-view">
    <div class="editor-meta-view" v-if="note">
      <span class="controls-left">
        <span v-if="showBurger" class="editor-burger" @click="$emit('burgerClick')">&#9776;</span>
        <span class="labels-control labels-control-btn" @click="$root.$emit('downloadNote', noteID)">
          <span class="label-text">Export</span>
          <UploadSVG class="alt-icon icon-invert" />
        </span>
      </span>
      <span class="note-name">{{name}}</span>
      <span class="controls-right">
        <span
          :class="{'labels-control': true, 'hiding-labels': !showRibbon}"
          @click="showRibbon = !showRibbon"
        >
          <span class="label-text no-kill">Toolbar</span>
        </span>
        <span
          :class="{'labels-control': true, 'hiding-labels': !showLabels}"
          @click="showLabels = !showLabels"
        >
          <span class="label-text no-kill">Labels</span>
        </span>
      </span>
    </div>
    <tool-ribbon v-if="showRibbon" :showLabels="showLabels" :tools="toolboxData" :drawers="toolDrawers" :activeTool="currentTool" @switchTool="switchTool($event)"></tool-ribbon>
    <EditorJSHost ref="editor" @ready="ready = true" @selectTool="currentTool = $event"></EditorJSHost>
  </div>
</template>

<script lang="ts">
import EditorJS, { OutputData } from "@editorjs/editorjs";
import { Component, Vue, Prop } from "vue-property-decorator";
import UploadSVG from "@/assets/upload.svg?inline";
import TrashSVG from "@/assets/trash.svg?inline";
import ToolSVG from "@/assets/tool.svg?inline";
import ToolRibbon from "@/components/ToolRibbon.vue";

import _ from '../util';
import EditorJSHost from './EditorJSHost.vue';

/**
 * Wrapper around Codex, manages all communication with it.
 */
@Component({
  components: {
    UploadSVG,
    TrashSVG,
    ToolSVG,
    ToolRibbon,
    EditorJSHost
  }
})
export default class Editor extends Vue {
  currentTool: string = "";

  overrides: {
    showRibbon: boolean | null;
    showLabels: boolean | null;
  } = {
    showRibbon: null,
    showLabels: null
  }

  $refs: {
    editor: EditorJSHost;
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

  toolDrawers: {[key: string]: string[]} = {
    paragraph: ['list', 'header', 'delimiter', 'quote']
  };

  created() {
      // if theres no note, create it before render
    if (
      Object.keys(this.$store.state.notes).length === 0 ||
      Object.values(this.$store.state.notes).filter(n => !!n).length === 0
    ) {
      this.$store.dispatch('newNote');
    }
  }

  get backend(): string | null {
    return this.$store.state.preferences.backend;
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

  get name() {
    return this.note.name;
  }

  /**
   * Returns the currently selected note ID
   */
  get noteID() {
    return this.$store.state.currentNote;
  }

  /**
   * Updates stored currentTool note ID
   */
  set noteID(newVal: string) {
    this.$store.dispatch("selectNote", newVal);
  }

  get sdk() {
    return this.$store.getters.authSDK;
  }

  /**
   * Selects a different tool for editing
   * @note uses private APIs
   */
  switchTool(key: string) {
    this.$refs.editor.$emit('shouldSwitchTool', key);
  }

  /**
   * Parses tools in Codex and transforms them to usable toolbox data
   * @note uses private APIs
   */
  get toolboxData() {
    this.ready;
    return this.$refs.editor ? this.$refs.editor.toolboxData : {};
  }
}
</script>

<style lang="scss">
.editor-meta-view {
  @extend %borderBottom;
  @extend %bg;
  position: relative;
  z-index: 50;
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

  & > .controls-left,
  & > .controls-right {
    display: flex;
    flex-flow: row;
    align-items: center;

    & .editor-burger {
      margin: 5px;
      cursor: pointer;
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

.editor-view {
  @extend %bgAlt;
  @extend %text;

  display: flex;
  flex-flow: column;
  width: stretch;
  z-index: 500;

  padding-right: env(safe-area-inset-right);
}
</style>