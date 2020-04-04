<template>
  <div class="spacer">
    <slot></slot>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class Spacer extends Vue {

}
</script>

<style lang="scss">
.spacer {
  display: flex;
  flex-grow: 1;
  align-items: center;
  justify-content: center;
}
</style>