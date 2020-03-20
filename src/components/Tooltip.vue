<template>
  <span :data-tooltip="tooltip" :data-placement="placement" @mouseenter="mouseenter" @mouseleave="mouseleave" v-on="$listeners">
    <slot></slot>
  </span>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import _ from '../util';

@Component
export default class Tooltip extends Vue {
  @Prop()
  tooltip: string;

  @Prop({ default: "bottom" })
  placement: string;

  /**
   * internal tooltip API
   */
  get tooltipAPI(): Tooltip {
    return (this.$root.$children[0] as any).tooltip;
  }

  /**
   * Hover, trigger tooltip now
   */
  mouseenter(ev: MouseEvent) {
    if (!this.tooltip) return;
    _.Tooltips.showTooltip(this.tooltipAPI, ev);
  }

  /**
   * Hover out, hide tooltip now
   */
  mouseleave(ev: MouseEvent) {
    _.Tooltips.hideTooltip(this.tooltipAPI, ev);
  }
}
</script>