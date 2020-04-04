<template>
  <div class="drawer">
    <slot></slot>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { isTouchDevice } from "./Actions.vue";

@Component
export default class Drawer extends Vue {
  ready: boolean = false;
  resizeCounter: number = 0;

  mounted() {
    this.ready = true;

    window.addEventListener(
      "resize",
      () => {
        this.resizeCounter++;
      },
      { passive: true }
    );
  }

  get availableListHeight() {
    if (!this.ready) return 0;
    this.resizeCounter;
    const viewportHeight = document.body.clientHeight;
    return (
      viewportHeight -
      Array.from(this.$el.children)
        .filter(c => !c.classList.contains("drawer-list"))
        .reduce((a, c) => a + c.clientHeight, 0)
    );
  }
}
</script>

<style lang="scss">
.drawer {
  @extend .text;
  display: flex;
  flex-flow: column;
  max-height: 100%;
}
</style>