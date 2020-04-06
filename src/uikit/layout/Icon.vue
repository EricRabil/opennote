<template>
  <svg aria-hidden="true">
    <use :xlink:href="iconName"></use>
  </svg>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
const requireAll = requireContext => requireContext.keys().map(requireContext)
const req = require.context("../../assets/icons", false, /\.svg$/)
requireAll(req)

@Component
export default class Icon extends Vue {
  @Prop()
  name: string;

  get iconName() {
    let icon = this.name;
    return icon ? `#icon-${icon}` : "";
  }
}
</script>