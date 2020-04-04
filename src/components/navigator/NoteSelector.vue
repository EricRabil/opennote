<template>
  <actions :enabled="actionable" v-on="$listeners">
    <div :class="['note-selector', {readonly: !editable}, active && 'active']">
      <span class="item-title" :contenteditable="editable" @input="setTitle">{{name}}</span>
      <span class="item-timestamp">{{timestamp}}</span>
    </div>
    <confirmation-modal
      v-if="modals.deleteNote"
      color="red"
      header="Delete Note?"
      confirmation="Delete"
      @close="modals.deleteNote = false"
      @confirm="deleteNote"
    >Deleting a note is permanent, it cannot be restored unless you have a backup.
    </confirmation-modal>
    <share-note-modal
      v-if="modals.shareNote"
      :id="note.id"
      @close="modals.shareNote = false">
    </share-note-modal>
    <div class="action-tray" slot="actions-left">
      <action-item v-show="isAuthed" color="green" @click="modals.shareNote = true">
        <span slot="content">
          <font-awesome-icon :icon="share"></font-awesome-icon>
        </span>
        <span slot="label">Share</span>
      </action-item>
    </div>
    <div class="action-tray" slot="actions-right">
      <action-item color="blue" @click="$root.$emit('downloadNote', note.id)">
        <span slot="content">
          <font-awesome-icon :icon="download"></font-awesome-icon>
        </span>
        <span slot="label">Download</span>
      </action-item>
      <action-item color="red" @click="modals.deleteNote = true" v-show="canDelete">
        <span slot="content">
          <font-awesome-icon :icon="trash"></font-awesome-icon>
        </span>
        <span slot="label">Delete</span>
      </action-item>
    </div>
  </actions>
</template>

<script lang="ts">
import moment from "moment";
import { Component, Prop, Vue } from "vue-property-decorator";
import _ from "@/util";
import { NoteModel } from "@/api.sdk";
import { Action } from "@/uikit/layout/Actions.vue";
import {
  faTrash,
  faDownload,
  faShare
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import ShareNoteModal from "@/components/modals/ShareNoteModal.vue";

@Component({
  components: {
    FontAwesomeIcon,
    ShareNoteModal
  }
})
export default class NoteSelector extends Vue {
  @Prop({ default: false })
  editable: boolean;

  @Prop({ default: true })
  actionable: boolean;

  @Prop({ default: false })
  active: boolean;

  @Prop()
  note: NoteModel;

  trash = faTrash;
  download = faDownload;
  share = faShare;

  modals = {
    deleteNote: false,
    shareNote: false
  };

  setTitle(event: InputEvent) {
    const target = event.target as HTMLElement;

    const pos = _.Dom.getCaretPosition(target);

    const name = target.innerText.split("\n").join(""),
      id = this.note.id;

    target.innerText = name;

    this.$store.commit("updateNote", {
      id,
      name
    });

    if (this.sdk) {
      this.sdk.editNote(id, { name });
    }

    this.$nextTick(() => {
      _.Dom.setCurrentCursorPosition(pos, target);
    });
  }

  deleteNote() {
    const id = this.note.id;
    const jumpTo = this.$store.getters.nextNote;

    console.log({ id, jumpTo });

    if (!this.canDelete) return;

    this.$store.dispatch("delNote", id);
    this.$store.dispatch("selectNote", jumpTo && jumpTo.id);
  }

  get canDelete() {
    return this.$store.getters.shouldDelete;
  }

  get isAuthed() {
    return this.$store.getters.authSDK;
  }

  get sdk() {
    return this.$store.getters.authSDK;
  }

  get name() {
    return this.note.name;
  }

  get timestamp() {
    const source = this.note.data ? this.note.data.time : this.note.created;
    return moment(source).calendar();
  }
}
</script>

<style lang="scss">
.note-selector {
  display: flex;
  flex-flow: column;
  padding: 10px;

  &.readonly {
    @extend %bg1;
  }

  &:not(.readonly) {
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
  }

  & > .item-title {
  }

  & > .item-timestamp {
    @extend %textAlt;

    padding-top: 5px;
    text-transform: uppercase;
    font-size: 12px;
    text-align: right;
    user-select: none;
  }
}
</style>