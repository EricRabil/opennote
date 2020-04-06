<template>
  <ui-button
    class="menubar-button"
    :class="{ active }"
    :tooltip="tooltip"
    @click="commands[command]"
  >
    <icon :name="icon || command" />
  </ui-button>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class MenuButton extends Vue {
  @Prop()
  command: string;

  @Prop()
  isActive: any;

  @Prop()
  commands: any;

  @Prop()
  icon?: string;

  get active() {
    if (!(this.command in this.isActive)) return false;
    return this.isActive[this.command]();
  }

  get tooltip() {
    return this.command.split("_").map(s => s.split("")).map(s => (s[0].toUpperCase() + s.slice(1).join(""))).join(" ");
  }
}
</script>