<template>
  <div :class="{'home': true, 'nav-collapse': navCollapse}">
    <div class="navigator">
      <div class="title">
        <span class="note-controls-left">
          <span
            class="control"
            data-tooltip="Toggle Menu"
            data-placement="right"
            @mouseenter="mouseenter"
            @mouseleave="mouseleave"
            @click="navCollapse = !navCollapse"
            >
            &#9776;
          </span>
          <span class="control"
          :data-tooltip="`Sort ${sortListAscending ? 'Descending' : 'Ascending'}`"
          data-placement="right"
          @mouseenter="mouseenter"
          @mouseleave="mouseleave"
          @click="sortListAscending = !sortListAscending"
          v-html="sortListAscending ? '&#8595;' : '&#8593;'"
          >
          </span>
        </span>
        <span class="note-title">Notes</span>
        <span class="note-controls">
          <span
            class="control control-success"
            data-tooltip="Import Note"
            @mouseenter="mouseenter"
            @mouseleave="mouseleave"
            @click="importNote"
          >
            <UploadSVG width="12px" />
          </span>
          <span
            class="control control-primary"
            data-tooltip="New Note"
            @mouseenter="mouseenter"
            @mouseleave="mouseleave"
            @click="newNote"
          >
            <svg class="icon icon--plus" width="14px" height="14px">
              <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#plus" />
            </svg>
          </span>
        </span>
      </div>
      <transition-group name="list" mode="out-in" tag="div" class="navigator-contents">
        <div
          :class="{'navigator-item': true, active: id === currentNote}"
          :style="{display: !name ? 'none' : 'flex'}"
          @contextmenu.prevent="triggerContext($event, idx)"
          @click="selectNote(id)"
          v-for="({id, name, timestamp}, idx) in list"
          :key="id"
        >
          <span
            class="item-title"
            :ref="`edit${id}`"
            contenteditable="true"
            :data-id="id"
            @input="setTitle"
          >{{name}}</span>
          <span class="item-timestamp">{{timestamp}}</span>
        </div>
      </transition-group>
      <div class="title">
        <span class="note-controls-left">
          <span :class="['labels-control labels-control-btn labels-control-btn-danger', canDelete ? '' : 'labels-control-btn-disabled']" @click="delNote(noteID)">
            <span class="label-text">Delete</span>
            <TrashSVG class="alt-icon" />
          </span>
        </span>
        <span class="note-title muted-title-version">{{version}}</span>
        <span class="note-controls-right">
          <span :class="['labels-control labels-control-btn']">
            <span class="label-text no-kill" @click="exportNotes">Export All</span>
          </span>
        </span>
      </div>
    </div>
    <editor :show-burger="navCollapse" :exporter="download" :canDelete="canDelete" :deleter="delNote" @burgerClick="navCollapse = !navCollapse"></editor>
    <vue-context v-for="(data, id) in list" :key="id" :ref="`contextMenu${id}`">
      <li @click="download(id)">Export</li>
      <li :class="['ctx-danger', canDelete ? '' : 'ctx-danger-disabled']" @click="delNote(id)">Delete</li>
    </vue-context>
  </div>
</template>

<script lang="ts">
import moment from "moment";
import _ from "@/util";
const { VueContext } = require("vue-context");
import { Component, Vue } from "vue-property-decorator";
import { Tooltip } from "@editorjs/editorjs/types/api";
import UploadSVG from "@/assets/upload.svg?inline";
import Editor from "@/components/Editor.vue";
import { ModalOptions } from '../App.vue';
import DecisionButtons from "@/components/DecisionButtons.vue";
import ConfirmationModal from '@/components/DecisionButtons.vue';
import { Note } from '../store';
import TrashSVG from "@/assets/trash.svg?inline";

function createRange(
  node: Node,
  chars: { count: number },
  range?: Range
): Range {
  if (!range) {
    range = document.createRange();
    range.selectNode(node);
    range.setStart(node, 0);
  }

  if (chars.count === 0) {
    range.setEnd(node, chars.count);
  } else if (node && chars.count > 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent!.length < chars.count) {
        chars.count -= node.textContent!.length;
      } else {
        range.setEnd(node, chars.count);
        chars.count = 0;
      }
    } else {
      for (var lp = 0; lp < node.childNodes.length; lp++) {
        range = createRange(node.childNodes[lp], chars, range);

        if (chars.count === 0) {
          break;
        }
      }
    }
  }

  return range;
}

function setCurrentCursorPosition(index: number, node: Node) {
  if (index >= 0) {
    const selection = window.getSelection()!;

    const range = createRange(node, { count: index });

    if (range) {
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

/**
 * Host view for the editor and navigator view
 */
@Component({
  components: {
    VueContext,
    UploadSVG,
    Editor,
    TrashSVG
  }
})
export default class Home extends Vue {
  list: Array<{id: string, name: string, timestamp: string}> = [];

  navCollapse: boolean = false;
  canDelete: boolean = false;

  sortListAscending: boolean = false;

  mounted() {
    this.$store.subscribe((mutation, state) => {
      switch (mutation.type) {
        case 'setNote':
        case 'newNote':
        case 'delNote':
        case 'updateNote':
          this.list = this.sortedList(this.notes);
      }
    });

    this.$watch('sortListAscending', () => {
      this.list = this.sortedList(this.notes);
    })

    document.addEventListener("mousedown", this.mouseDown);

    this.$on('ct-mouseenter', (ev: MouseEvent) => this.mouseenter(ev));
    this.$on('ct-mouseleave', (ev: MouseEvent) => this.mouseleave(ev));

    this.list = this.sortedList(this.notes);
  }

  destroyed() {
    document.removeEventListener("mousedown", this.mouseDown);
  }

  $refs: {
    [id: string]: [HTMLElement];
  };

  activeContext: (Vue & { close(): any; open(e: MouseEvent): any }) | null;

  /**
   * on click, if the context menu is active and the target is not within the context, close the context menu
   */
  mouseDown({ target }: MouseEvent) {
    if (!target) return;
    if (!(target instanceof Element)) return;
    if (!this.activeContext) return;
    if (this.activeContext.$el.isEqualNode(target)) return;
    if (this.activeContext.$el.isEqualNode(target.closest(".v-context")))
      return;
    this.closeContext();
  }

  /**
   * triggers the context menu
   */
  triggerContext(event: MouseEvent, id: string) {
    if (this.activeContext) this.activeContext.close();
    const context: this["activeContext"] = (this.$refs[
      `contextMenu${id}`
    ] as any)[0];
    if (!context) {
      console.warn(`unknown context at ${id}`);
      return;
    }
    context.open(event);
    this.activeContext = context;
  }

  get version() {
    return process.env.VUE_APP_VERSION;
  }

  download(id: string) {
    const note = this.$store.state.notes[id];
    _.saveFile(JSON.stringify(note), `${note.name}.onote`, "application/json");
  }

  async exportNotes() {
    let repeats: {
      [name: string]: number
    } = {};
    const serialized = Object.keys(this.notes).map(k => ({
      name: this.notes[k].name,
      text: JSON.stringify(this.notes[k])
    })).map((data, idx, files) => {
      if (!repeats[data.name]) repeats[data.name] = 0;
      return {
        name: files.filter(f => f.name === data.name).length === 1 ? data.name : `${data.name}${repeats[data.name]++ > 0 ? ` (${repeats[data.name] - 1})` : ''}`,
        text: data.text
      }
    });
    await _.zipFilesAndDownload('OpenNote Export.zip', serialized);
  }

  /**
   * closes activeContext
   */
  closeContext() {
    if (!this.activeContext) return;
    this.activeContext.close();
    this.activeContext = null;
  }

  /**
   * Sets the title and maintains cursor position
   */
  setTitle(event: InputEvent) {
    const target = event.target as HTMLElement;

    let _range = document.getSelection()!.getRangeAt(0);
    let range = _range.cloneRange();
    range.selectNodeContents(target);
    range.setEnd(_range.endContainer, _range.endOffset);
    const pos = range.toString().length;

    const name = target.innerText.split('\n').join(''),
      id = target.getAttribute("data-id")!;

    target.innerText = name;

    this.$store.commit("updateNote", {
      id,
      name
    });

    this.$nextTick(() => {
      setCurrentCursorPosition(pos, target);
    });
  }

  /**
   * currently selected note
   */
  get currentNote() {
    return this.$store.state.currentNote;
  }

  /**
   * all notes
   */
  get notes(): { [id: string]: Note } {
    return this.$store.state.notes;
  }

  /**
   * internal tooltip API
   */
  get tooltip(): Tooltip {
    return (this.$root.$children[0] as any).tooltip;
  }

  /**
   * Hover, trigger tooltip now
   */
  mouseenter(ev: MouseEvent) {
    const leftOffset = 0;

    if (!this.tooltip) return;
    // no tooltips on mobile, please. its fucking ugly
    if (document.body.clientWidth <= 500) return;
    const tip = (ev.target! as HTMLElement).getAttribute("data-tooltip");
    const placement = (ev.target! as HTMLElement).getAttribute("data-placement") || "bottom";
    if (!tip) return;

    const content = document.createTextNode(tip);

    const observer = new MutationObserver((mutation) => {
      content.textContent = (ev.target! as HTMLElement).getAttribute("data-tooltip");
    });

    observer.observe(ev.target as HTMLElement, {
      attributes: true,
      attributeFilter: ['data-tooltip'],
      childList: false,
      characterData: false
    });

    this.tooltip.show(ev.target as HTMLElement, content, { placement });
    const tooltipContainers = Array.from(
      document.querySelectorAll(".ct.ct--bottom")
    ) as HTMLElement[];
    tooltipContainers.forEach(tooltipContainer => {
      tooltipContainer.style.left = `${(parseInt(
        tooltipContainer.style.left!.split("px")[0]
      ) || 0) + leftOffset}px`;
    });
  }

  /**
   * Hover out, hide tooltip now
   */
  mouseleave(ev: MouseEvent) {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  /**
   * Switches to a new note ID
   */
  selectNote(id: string) {
    if (this.currentNote === id) return;
    this.$store.commit("setNote", id);
    if (document.activeElement && document.activeElement.getAttribute('data-id') === id) return;
    if (document.body.clientWidth <= 500 && !this.navCollapse) {
      this.navCollapse = true;
    }
  }

  /**
   * inserts new note into store
   */
  newNote() {
    this.$store.commit("newNote");
  }

  get prevNote() {
    const list = this.sortedList(this.notes);
    return list[list.findIndex(note => note.id === this.currentNote) - 1];
  }

  get nextNote() {
    const list = this.sortedList(this.notes);
    return list[list.findIndex(note => note.id === this.currentNote) + 1];
  }

  /**
   * deletes the current note
   */
  delNote(id: string = this.currentNote) {
    if (!this.canDelete) return;
    const nextNote = this.nextNote;
    const completion = () => {
      this.$store.commit("delNote", id);
      this.$store.commit("setNote", nextNote.id);
    };
    if (!this.notes[id].data || this.notes[id].data.blocks.length === 0) {
      completion();
      return;
    }

    this.$root.$emit('modal-show', {
      header: 'Delete Note?',
      body: 'Deleting a note is permanent, it cannot be restored unless you have a backup.',
      footer: DecisionButtons,
      footerOptions: {
        cancel: () => {
          this.$root.$emit('modal-close');
        },
        confirm: () => {
          completion();
          this.$root.$emit('modal-close');
        },
        confirmText: 'Delete Note',
        cancelText: 'Keep Note',
        confirmStyle: 'danger'
      }
    } as ModalOptions);
  }

  async importNote() {
    try {
      const files = await _.getFilesAsString();
      files.forEach(file => this.$store.commit('newNote', JSON.parse(file)));
    } catch (e) {
      if (e instanceof _.DisplayableError) {
        const { options: { message, title } } = e;
        await this.$root.$emit('modal-show', {
          header: title,
          body: message,
          footer: DecisionButtons,
          footerOptions: {
            hasCancel: false,
            confirm: () => this.$root.$emit('modal-close'),
            confirmText: 'OK',
            confirmStyle: 'primary'
          }
        } as ModalOptions);
      }
    }
  }

  /**
   * Reloads all notes into the navigator view
   */
  sortedList(notes: this['notes']) {
    this.canDelete = Object.keys(this.$store.state.notes).length > 1;
    const flatNotes = Object.keys(this.notes).map(k => ({id: k, ...this.notes[k]}));

    return flatNotes.sort((a, b) => {
      const aTime = a.data && a.data.time || a.created;
      const bTime = b.data && b.data.time || b.created;
      return this.sortListAscending ? (aTime - bTime) : (bTime - aTime);
    }).map(({id, name, created, data}) => ({
      id,
      name,
      timestamp: moment(data && data.time || created).calendar()
    }));
  }
}
</script>

<style lang="scss">
.home {
  overflow: hidden;
  display: grid;
  grid-template-columns: 250px auto;
  grid-template-rows: 100%;
  height: -webkit-fill-available;

  @media only screen and (max-width: 500px) {
    grid-template-columns: 100vw 0px;
    
    &:not(.nav-collapse) {
      & > .editor-view {
        visibility: hidden;
        height: 0;
      }
    }

    & > .navigator {
      border-right: none !important;
    }
  }

  @media print {
    grid-template-columns: 0px 100vw;

    & > .navigator {
      visibility: hidden;
    }
  }

  &.nav-collapse {
    grid-template-columns: 0px 100vw;

    & > .navigator {
      visibility: hidden;
    }
  }

  & > .navigator {
    @extend %bg;
    @extend %text;
    @extend %borderRight;
    z-index: 10;
    padding-bottom: env(safe-area-inset-bottom);

    display: grid;
    grid-template-columns: 100%;
    grid-template-rows: 45px 1fr 45px;
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
      overflow: scroll;
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

  & > .navigator, &.nav-collapse > .editor-view {
    padding-left: env(safe-area-inset-left);
  }
}

.v-context {
  @extend %bgAlt1;
  @extend %text;
  position: absolute;
  max-width: 200px;
  padding: 10px 0;
  list-style: none;
  box-shadow: 0px 0px 3px 0px #000000;
  border-radius: 5px;
  z-index: 1000;

  &:focus {
    outline: none;
  }

  & > li {
    padding: 5px 10px;
    user-select: none;
    cursor: pointer;

    &:hover {
      @extend %bg0;

      &.ctx-danger {
        @extend %bgRed;

        &.ctx-danger-disabled {
          @extend %bgRedBad;
          cursor: not-allowed;
        }
      }
    }

    &:active {
      @extend %bg1;

      &.ctx-danger {
        @extend %bgRedAlt;

        &.ctx-danger-disabled {
          @extend %bgRedAlt;
        }
      }
    }
  }
}

.list-move {
  transition: transform 0.25s;
}
</style>
