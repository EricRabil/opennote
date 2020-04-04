<template>
  <div class="drawer-sticky">
    <slot></slot>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class DrawerStickySection extends Vue {

}
</script>

<style lang="scss">
.drawer-sticky {
  height: $section-height;
  display: flex;
  flex-flow: row;
  align-items: center;
}
</style>