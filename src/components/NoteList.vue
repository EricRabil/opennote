<template>
  <div class="navigator">
    <div class="title">
      <span class="note-controls-left">
        <tooltip
          class="control"
          tooltip="Toggle Menu"
          placement="right"
          @click="$emit('toggleCollapse')"
        >&#9776;</tooltip>
        <tooltip
          class="control"
          :tooltip="`Sort ${sortListAscending ? 'Descending' : 'Ascending'}`"
          placement="right"
          @click="sortListAscending = !sortListAscending"
        >{{sortListAscending ? '&#8595;' : '&#8593;'}}</tooltip>
      </span>
      <span class="note-title">Notes</span>
      <span class="note-controls">
        <tooltip
          class="control control-success"
          tooltip="Import Note"
          @click="$root.$emit('importNote')"
        >
          <UploadSVG width="12px" />
        </tooltip>
        <tooltip class="control control-primary" tooltip="New Note" @click="$root.$emit('newNote')">
          <svg class="icon icon--plus" width="14px" height="14px">
            <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#plus" />
          </svg>
        </tooltip>
      </span>
    </div>
    <transition-group name="list" mode="out-in" tag="div" class="navigator-contents">
      <note-selector
        v-for="note in list"
        :key="note.id"
        :note="note"
        :editable="true"
        @contextmenu.prevent="showContextMenu($event, note.id)"
        @click="selectNote(note.id)"
        :class="{active: note.id === currentNote}"
      ></note-selector>
    </transition-group>
    <div class="title">
      <span class="note-controls-left">
        <span
          :class="['labels-control labels-control-btn labels-control-btn-danger', canDelete ? '' : 'labels-control-btn-disabled']"
          @click="$root.$emit('delNote', currentNote)"
        >
          <span class="label-text">Delete</span>
          <TrashSVG class="alt-icon" />
        </span>
        <tooltip
          class="labels-control labels-control-btn"
          tooltip="Settings"
          placement="top"
          @click="$root.$emit('showSettings')"
        >
          <SettingsSVG />
        </tooltip>
      </span>
      <span class="note-controls-right">
        <span :class="['labels-control labels-control-btn']">
          <span class="label-text no-kill" @click="$root.$emit('exportNotes')">Export All</span>
        </span>
      </span>
    </div>
    <vue-context v-for="(data, idx) in list" :key="idx" :ref="`contextMenu${data.id}`">
      <li @click="$root.$emit('downloadNote', data.id)">Export</li>
      <li
        :class="['ctx-danger', canDelete ? '' : 'ctx-danger-disabled']"
        @click="$root.$emit('delNote', data.id)"
      >Delete</li>
      <li v-if="sdk" :class="['ctx-primary']" @click="$root.$emit('shareNote', data.id)">Share</li>
    </vue-context>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import NoteSelector from "@/components/NoteSelector.vue";
import { Tooltip } from "@editorjs/editorjs/types/api";
import { ModalOptions } from "../App.vue";
import Settings from "./Settings.vue";
import SettingsSVG from "@/assets/settings.svg?inline";
import UploadSVG from "@/assets/upload.svg?inline";
import TrashSVG from "@/assets/trash.svg?inline";
import DecisionButtons from "./DecisionButtons.vue";
import _ from "../util";
import { Note } from "../store";
const { VueContext } = require("vue-context");

@Component({
  components: {
    NoteSelector,
    SettingsSVG,
    UploadSVG,
    TrashSVG,
    VueContext
  }
})
export default class NoteList extends Vue {
  sortListAscending: boolean = false;

  showContextMenu(ev: MouseEvent, id: string) {
    (this.$refs[`contextMenu${id}`] as any)[0].open(ev);
  }

  /**
   * Switches to a new note ID
   */
  selectNote(id: string) {
    console.log(id);
    if (this.currentNote === id) return;
    this.$store.dispatch("selectNote", id);
    if (
      document.activeElement &&
      document.activeElement.getAttribute("data-id") === id
    )
      return;
    if (document.body.clientWidth <= 500) {
      this.$emit("toggleCollapse", true);
    }
  }

  /**
   * currently selected note
   */
  get currentNote() {
    return this.$store.state.currentNote;
  }

  /**
   * Returns whether a note can be deleted
   */
  get canDelete(): boolean {
    return this.$store.getters.shouldDelete;
  }

  get list(): Array<Note & { id: string }> {
    if (this.sortListAscending)
      return this.$store.getters.sortedNotes.reduceRight(
        (a: any[], c: any) => (a.push(c), a),
        []
      );
    return this.$store.getters.sortedNotes;
  }

  get sdk() {
    return this.$store.getters.authSDK;
  }
}
</script>

<style lang="scss">
.navigator {
  @extend %bg;
  @extend %text;
  @extend %borderRight;
  z-index: 10;
  padding-bottom: env(safe-area-inset-bottom);

  display: grid;
  grid-template-columns: 100%;
  grid-template-rows: 45px calc(100% - 90px) 45px;
  max-height: stretch;
  overflow: hidden;

  & > .title {
    &:first-child {
      @extend %borderBottom;
    }

    &:last-child {
      @extend %borderTop;
    }
    min-height: 44px;
    position: relative;
    display: flex;
    flex-flow: row-reverse;
    align-items: center;
    user-select: none;

    & > .note-controls-left {
      display: inline-flex;
      position: absolute;
      left: 10px;
    }

    & > .note-controls-right {
      display: inline-flex;
      position: absolute;
      right: 10px;
    }

    & .control {
      display: inline-flex;
      align-items: center;
      margin: 5px;
      &:hover {
        cursor: pointer;
      }

      &:hover {
        &:not(.disabled) {
          &.control-danger {
            svg {
              fill: #c74545;
            }
          }

          &.control-primary {
            svg {
              fill: #8e84f9;
            }
          }

          &.control-success {
            svg {
              fill: #5ad677;
            }
          }
        }

        &.disabled {
          svg {
            @extend %fill;
            cursor: not-allowed;
          }
        }
      }

      &.control-invert {
        transform: rotate(180deg);
      }

      svg {
        @extend %fill;
        transition: fill 0.125s linear;
      }
    }

    // absolute center with no regard to the other bitches
    & > .note-title {
      position: absolute;
      top: 50%;
      left: 50%;
      max-width: 153px;
      min-width: 10px;
      max-height: 22px;
      text-overflow: ellipsis;
      overflow: auto;
      transform: translate(-50%, -50%);
      user-select: none;

      &.muted-title-version {
        font-size: 12px;
      }
    }

    & > .note-controls {
      display: inline-flex;
      position: absolute;
      right: 10px;
    }
  }

  & > .navigator-contents {
    @include scrollbar();

    overflow-y: scroll;
    display: flex;
    flex-flow: column;

    & .navigator-item {
      display: flex;
      flex-flow: column;
      margin: 5px;
      padding: 5px;
      border-radius: 5px;
      min-height: 39px;

      &:hover {
        @extend %bg1;
        cursor: pointer;
      }

      &:active {
        @extend %bg3;
      }

      &.active {
        @extend %bg2;
      }

      & > .item-title {
      }

      & > .item-timestamp {
        @extend %textAlt;

        text-transform: uppercase;
        font-size: 12px;
        text-align: right;
        user-select: none;
      }
    }
  }
}
</style>