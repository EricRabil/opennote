<template>
  <div class="drawer-section-item">
    <slot></slot>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class DrawerSectionItem extends Vue {
}
</script>

<style lang="scss">
.drawer-section-item {
  display: flex;
  flex-flow: row;
  height: min-content;
}
</style>