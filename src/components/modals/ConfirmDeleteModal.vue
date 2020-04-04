<template>
  <modal>
    <h1 slot="header">Delete Note?</h1>

    <template slot="body">
      Deleting a note is permanent, it cannot be restored unless you have a backup.
    </template>

    <ui-button-tray slot="footer">
      <ui-button color="gray-1" @click="close">
        Keep Note
      </ui-button>
      <ui-button color="red" @click="deleteNote">
        Delete Note
      </ui-button>
    </ui-button-tray>
  </modal>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { Note } from "@/store";

@Component
export default class ConfirmDeleteModal extends Vue {
  @Prop()
  noteID: string;

  @Prop()
  close: Function;

  @Prop()
  completion: Function;

  deleteNote() {
    this.completion();
    this.close();
  }
}
</script>