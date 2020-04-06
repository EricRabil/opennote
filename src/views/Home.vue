<template>
  <div :class="['home', !shouldUseGestureRecognizers && 'desktop-side-piece', navCollapse && 'no-grid']">
    <side-piece v-if="!navCollapse" ref="sidePiece" @drag-start="sidePieceIsDragging = true" @drag-end="sidePieceIsDragging = false" :recognizers="shouldUseGestureRecognizers">
      <note-list
        ref="noteList"
        class="drawer"
        :show-toggle="!shouldUseGestureRecognizers"
        @toggleCollapse="navCollapse = (typeof $event === 'boolean') ? $event: !navCollapse"
      ></note-list>
    </side-piece>
    <beta-editor
      :show-burger="navCollapse"
      class="content"
      ref="editor"
      :scroll-lock="sidePieceIsDragging"
      @burgerClick="navCollapse = !navCollapse"
      ></beta-editor>
    <!-- <editor
      v-else
      :show-burger="navCollapse"
      class="content"
      ref="editor"
      :scroll-lock="sidePieceIsDragging"
      @burgerClick="navCollapse = !navCollapse"
    ></editor> -->
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { Tooltip } from "@editorjs/editorjs/types/api";
import BetaEditor from "@/components/new-editor/Editor.vue";
import { Note } from "@/store";
import NoteList from "@/components/navigator/NoteList.vue";
import _ from "@/util";
import SidePiece from "@/uikit/layout/SidePiece.vue";
import { isTouchDevice } from "@/uikit/layout/Actions.vue";

/**
 * Host view for the editor and navigator view
 */
@Component({
  components: {
    BetaEditor,
    NoteList
  }
})
export default class Home extends Vue {
  overrides: {
    navCollapse: boolean | null;
  } = {
    navCollapse: null
  };

  $refs: {
    noteList: NoteList;
    sidePiece: SidePiece;
  };

  sidePieceIsDragging = false;

  get navCollapse() {
    return this.overrides.navCollapse === null
      ? !this.$store.state.preferences.hideEditorByDefaultOnMobile
      : this.overrides.navCollapse;
  }

  get shouldUseGestureRecognizers() {
    return isTouchDevice();
  }

  set navCollapse(c: boolean) {
    this.overrides.navCollapse = c;
  }

  canDelete: boolean = false;

  sortListAscending: boolean = false;

  async mounted() {
    // this.$refs.sidePiece.bindRecognizer(this.$refs.editor.$el);

    if (this.$route.params.id && this.sdk) {
      // import a note!
      const note = await this.sdk.getNote(this.$route.params.id);
      if (note) {
        const { id, data, name, created } = note;
        this.$store.commit("newNote", { id, data, name, created });
        this.$store.dispatch("selectNote", id);
        this.$router.push("/");
      }
    }
  }

  listWidth() {
    return this.$refs.noteList.$el.clientWidth + 1;
  }

  activeContext: (Vue & { close(): any; open(e: MouseEvent): any }) | null;

  get version() {
    return process.env.VUE_APP_VERSION;
  }

  get shouldUseBetaEditor() {
    return this.$store.state.preferences.useNewEditor;
  }

  /**
   * currently selected note
   */
  get currentNote() {
    return this.$store.state.currentNote;
  }

  get sdk() {
    return this.$store.state.dory.sdk;
  }

  /**
   * internal tooltip API
   */
  get tooltip(): Tooltip {
    return (this.$root.$children[0] as any).tooltip;
  }
}
</script>

<style lang="scss">
.home {
  overflow: hidden;

  &.desktop-side-piece:not(.no-grid) {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
  }

  @media print {
    & > .navigator {
      visibility: hidden;
    }
  }

  &.nav-collapse {
    & > .navigator {
      visibility: hidden;
    }
  }
}

.list-move {
  transition: transform 0.25s;
}
</style>
