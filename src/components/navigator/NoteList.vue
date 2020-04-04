<template>
  <drawer class="note-list">
    <drawer-sticky class="buttons-inline">
      <drawer-section-item>
        <ui-button-tray>
          <ui-button v-if="showToggle" tooltip="Toggle Menu" @click="$emit('toggleCollapse')">&#9776;</ui-button>
          <ui-button
            :tooltip="`Sort ${sortListAscending ? 'Descending' : 'Ascending'}`"
            @click="sortListAscending = !sortListAscending"
          >{{sortListAscending ? '&#8595;' : '&#8593;'}}</ui-button>
        </ui-button-tray>
      </drawer-section-item>
      <spacer>Notes</spacer>
      <drawer-section-item>
        <ui-button-tray>
          <ui-button tooltip="Import Note" @click="$root.$emit('importNote')">
            <UploadSVG width="12px" />
          </ui-button>
          <ui-button tooltip="New Note" @click="$root.$emit('newNote')">
            <svg class="icon icon--plus" width="14px" height="14px">
              <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#plus" />
            </svg>
          </ui-button>
        </ui-button-tray>
      </drawer-section-item>
    </drawer-sticky>
    <drawer-list>
      <transition-group name="list" mode="out-in" tag="div" class="navigator-contents">
        <note-selector
          class="navigator-item"
          v-for="note in list"
          :key="note.id"
          :note="note"
          :editable="true"
          @click="selectNote(note.id)"
          :active="note.id === currentNote"
        ></note-selector>
      </transition-group>
    </drawer-list>
    <drawer-sticky class="buttons-skinny">
      <drawer-section-item>
        <ui-button tooltip="Settings" @click="settingsIsShowing = true">
          <SettingsSVG width="12px" />
        </ui-button>
        <settings v-if="settingsIsShowing" @close="settingsIsShowing = false"></settings>
      </drawer-section-item>
      <spacer />
      <drawer-section-item>
        <ui-button>
          <span class="label-text no-kill" @click="$root.$emit('exportNotes')">Export All</span>
        </ui-button>
      </drawer-section-item>
    </drawer-sticky>
  </drawer>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import NoteSelector from "@/components/navigator/NoteSelector.vue";
import { Tooltip } from "@editorjs/editorjs/types/api";
import { ModalOptions } from "@/App.vue";
import Settings from "@/components/modals/SettingsModal.vue";
import SettingsSVG from "@/assets/settings.svg?inline";
import UploadSVG from "@/assets/upload.svg?inline";
import TrashSVG from "@/assets/trash.svg?inline";
import DecisionButtons from "./DecisionButtons.vue";
import _ from "@/util";
import { Note } from "@/store";

@Component({
  components: {
    NoteSelector,
    SettingsSVG,
    UploadSVG,
    TrashSVG,
    Settings
  }
})
export default class NoteList extends Vue {
  sortListAscending: boolean = false;

  settingsIsShowing = false;

  @Prop({ default: true })
  showToggle: boolean;

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
.note-list {
  @include responsiveProperty("border-right", "gray-5", "1px solid %v");
  @include responsiveProperty("background-color", "bg");
  height: 100vh;

  .drawer-sticky {
    padding: 0 10px;
    @include responsiveProperty("border-top", "gray-5", "1px solid %v");
    @include responsiveProperty("border-bottom", "gray-5", "1px solid %v");

    &:first-child {
      border-top: unset;
    }

    &:last-child {
      border-bottom: unset;
    }
  }

  .drawer-list .navigator-item {
    @include responsiveProperty("border-bottom", "gray-5", "1px solid %v");
    min-height: $section-height;
  }

  .buttons-skinny {
    .button {
      font-size: 12px;
    }
  }

  .button {
    height: fit-content;
  }
}
</style>