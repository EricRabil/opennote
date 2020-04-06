<template>
  <perfect-scrollbar>
    <slot></slot>
  </perfect-scrollbar>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { PerfectScrollbar } from "vue2-perfect-scrollbar";

@Component({
  components: {
    PerfectScrollbar
  }
})
export default class Scrollable extends Vue {

}
</script>

<style lang="scss">
</style>