<template>
  <div class="home">
    <div class="navigator">
      <div class="title">
        <span class="note-title">Notes</span>
        <span class="note-controls">
          <span
            class="control"
            data-tooltip="Import Note"
            @mouseenter="mouseenter"
            @mouseleave="mouseleave"
            @click="importNote"
          >
            <UploadSVG width="12px" />
          </span>
          <span
            :class="{'control': true, 'control-danger': true, disabled: !canDelete()}"
            data-tooltip="Delete Note"
            @mouseenter="mouseenter"
            @mouseleave="mouseleave"
            @click="delNote"
          >
            <svg class="icon icon--cross" width="12px" height="12px">
              <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#cross" />
            </svg>
          </span>
          <span
            class="control"
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
      <div class="navigator-contents">
        <div
          :class="{'navigator-item': true, active: id === currentNote}"
          :style="{display: !data.name ? 'none' : 'flex'}"
          @contextmenu.prevent="triggerContext($event, id)"
          @click="selectNote(id)"
          v-for="(data, id) in list"
          :key="id"
        >
          <span
            class="item-title"
            :ref="`edit${id}`"
            contenteditable="true"
            :data-id="id"
            @input="setTitle"
          >{{data.name}}</span>
          <span class="item-timestamp">{{data.timestamp}}</span>
        </div>
      </div>
    </div>
    <editor></editor>
    <vue-context v-for="(data, id) in list" :key="id" :ref="`contextMenu${id}`">
      <li @click="download(id)">Download</li>
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
    UploadSVG
  }
})
export default class Home extends Vue {
  list: {
    [id: string]: {
      name: string;
      timestamp: string;
    };
  } = {};

  /**
   * put placeholder data in the list, will be populated on render
   */
  created() {
    this.list[this.currentNote] = {} as any;
  }

  mounted() {
    /**
     * Reload on note mutations
     */
    this.$store.subscribe((mutation, state) => {
      switch (mutation.type) {
        case "updateNote":
        case "newNote":
        case "delNote":
          this.reload();
      }
    });

    document.addEventListener("mousedown", this.mouseDown);

    /**
     * populate render data
     */
    this.reload();
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

  download(id: string) {
    const note = this.$store.state.notes[id];
    _.saveFile(JSON.stringify(note), `${note.name}.onote`, "application/json");
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

    const name = target.innerText,
      id = target.getAttribute("data-id")!;
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
   * internal tooltip API
   */
  get tooltip(): Tooltip {
    return (this.$root.$children[0] as any).tooltip;
  }

  /**
   * cannot delete if only one note left!
   */
  canDelete() {
    return Object.keys(this.$store.state.notes).length > 1;
  }

  /**
   * Hover, trigger tooltip now
   */
  mouseenter(ev: MouseEvent) {
    const leftOffset = 7;

    if (!this.tooltip) return;
    const tip = (ev.target! as HTMLElement).getAttribute("data-tooltip");
    if (!tip) return;
    this.tooltip.show(ev.target as HTMLElement, tip, { placement: "bottom" });
    const tooltipContainers = Array.from(
      document.querySelectorAll(".ct.ct--bottom")
    ) as HTMLElement[];
    tooltipContainers.forEach(tooltipContainer => {
      tooltipContainer.style.left = `${parseInt(
        tooltipContainer.style.left!.split("px")[0]
      ) + leftOffset}px`;
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
    this.$store.commit("setNote", id);
  }

  /**
   * inserts new note into store
   */
  newNote() {
    this.$store.commit("newNote");
  }

  /**
   * deletes the current note
   */
  delNote() {
    if (!this.canDelete()) return;
    this.$store.commit("delNote", this.currentNote);
  }

  async importNote() {
    const file = await _.getFileAsString();
    /**
     * @todo proper error handling
     */
    if (!file) return;
    this.$store.commit('newNote', JSON.parse(file));
  }

  /**
   * Reloads all notes into the navigator view
   */
  reload() {
    this.list = {};
    for (let prop in this.$store.state.notes) {
      this.loadNote(prop, this.$store.state.notes[prop]);
    }
  }

  /**
   * Computes the renderable data for a note in the navigator view
   */
  loadNote(id: string, note: any) {
    if (!note) {
      console.warn("invalid note passed to loadNote");
      return;
    }

    const time = typeof note.data === "object" ? note.data.time : note.created;

    Vue.set(this.list, id, {
      name: note.name,
      timestamp: moment(time).calendar()
    });
  }
}
</script>

<style lang="scss">
.home {
  display: grid;
  grid-template-columns: 250px auto;
  grid-template-rows: 100vh;

  & > .navigator {
    @extend %bg;
    @extend %text;
    @extend %borderRight;
    z-index: 10;
    display: flex;
    flex-flow: column;

    & > .title {
      @extend %borderBottom;
      height: 44px;
      position: relative;
      display: flex;
      flex-flow: row-reverse;
      align-items: center;

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
      }

      & > .note-controls {
        margin-right: 10px;
        display: inline-flex;

        & > .control {
          display: inline-flex;
          align-items: center;
          &:hover {
            cursor: pointer;
            svg {
              fill: darken(blue, 10);
            }
          }

          &:not(:last-child) {
            margin-right: 5px;
          }

          &.control-danger:hover {
            svg {
              fill: red;
            }
          }

          svg {
            @extend %fill;
            transition: fill 0.125s linear;
          }
        }
      }
    }

    & > .navigator-contents {
      // box-shadow: 10px 0 5px -2px rgba(0,0,0,0.25);
      height: calc(100vh - 44px);
      display: flex;
      flex-flow: column;

      & > .navigator-item {
        display: flex;
        flex-flow: column;
        margin: 5px;
        padding: 5px;
        border-radius: 5px;

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
    }

    &:active {
      @extend %bg1;
    }
  }
}
</style>
