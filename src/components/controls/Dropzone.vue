<template>
  <div ref="dropZone" @drop="didDrop" @dragover="swallow" @dragend="swallow" @dragstart="swallow">
    <slot></slot>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
@Component
export default class Dropzone extends Vue {
  @Prop()
  onFile: Function;

  didDrop(event: DragEvent) {
    if (!event.dataTransfer) return;
    event.preventDefault();

    const { dataTransfer } = event;

    var file: File | null;
    if (dataTransfer.items) {
      const [ item ] = dataTransfer.items;
      file = item.getAsFile();
    } else {
      const [ droppedFile ] = dataTransfer.files;
      file = droppedFile;
    }

    if (!file) {
      return;
    }

    if (this.onFile) {
      this.onFile(file);
    }
  }

  swallow(event: Event) {
    event.preventDefault();
  }
}
</script>