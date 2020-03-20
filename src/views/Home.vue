<template>
  <div :class="{'home': true, 'nav-collapse': navCollapse}">
    <note-list @toggleCollapse="navCollapse = (typeof $event === 'boolean') ? $event: !navCollapse"></note-list>
    <editor
      :show-burger="navCollapse"
      @burgerClick="navCollapse = !navCollapse"
    ></editor>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { Tooltip } from "@editorjs/editorjs/types/api";
import Editor from "@/components/Editor.vue";
import { Note } from "../store";
import NoteList from "@/components/NoteList.vue";
import _ from '../util';

/**
 * Host view for the editor and navigator view
 */
@Component({
  components: {
    Editor,
    NoteList
  }
})
export default class Home extends Vue {
  overrides: {
    navCollapse: boolean | null;
  } = {
    navCollapse: null
  };

  get navCollapse() {
    return this.overrides.navCollapse === null
      ? !this.$store.state.preferences.hideEditorByDefaultOnMobile
      : this.overrides.navCollapse;
  }

  set navCollapse(c: boolean) {
    this.overrides.navCollapse = c;
  }

  canDelete: boolean = false;

  sortListAscending: boolean = false;

  async mounted() {
    this.$store.subscribe((mutation, state) => {
      switch (mutation.type) {
        case "setNote":
        case "newNote":
        case "delNote":
        case "updateNote":
        case "setNotes":
          // this.listMutateCount++;
      }
    });

    if (this.$route.params.id && this.sdk) {
      // import a note!
      const note = await this.sdk.getNote(this.$route.params.id);
      if (note) {
        const { id, data, name, created } = note;
        this.$store.commit("newNote", { id, data, name, created });
        this.$store.commit("setNote", id);
        this.$router.push("/");
      }
    }
  }

  activeContext: (Vue & { close(): any; open(e: MouseEvent): any }) | null;

  get version() {
    return process.env.VUE_APP_VERSION;
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
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
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

  & > .navigator,
  &.nav-collapse > .editor-view {
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

      &.ctx-primary {
        @extend %bgBlue;

        &.ctx-primary-disabled {
          @extend %bgBlueBad;
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

      &.ctx-primary {
        @extend %bgBlueAlt;

        &.ctx-primary-disabled {
          @extend %bgBlueAlt;
        }
      }
    }
  }
}

.list-move {
  transition: transform 0.25s;
}
</style>
