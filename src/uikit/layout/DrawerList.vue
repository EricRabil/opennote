<template>
  <div class="drawer-list">
    <scrollable :style="{'max-height': maxHeight}">
      <slot></slot>
    </scrollable>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import Drawer from "./Drawer.vue";

@Component
export default class DrawerList extends Vue {
  get maxHeight() {
    return `${(this.$parent as Drawer).availableListHeight}px`;
  }
}
</script>

<style lang="scss">
.drawer-list {
  flex-grow: 1;
}
</style>