<template>
  <div :class="[cssPrefix, `${cssPrefix}-${color}`, {[`${cssPrefix}-disabled`]: disabled}]" @click="clicked">
    <slot name="content"></slot>
    <span :class="[`${cssPrefix}-label`]" v-if="!isSwipe">
      <slot name="label"></slot>
    </span>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { Action, isTouchDevice } from "@/uikit/layout/Actions.vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

@Component({
  components: {
    FontAwesomeIcon
  }
})
export default class ActionItem extends Vue {
  @Prop({ default: "gray-1" })
  color: string;

  @Prop({ default: false })
  disabled: boolean;

  isSwipe: boolean = isTouchDevice();

  clicked() {
    if (this.disabled) return;
    this.$parent.$emit("should-close");
    this.$emit("click");
  }

  get cssPrefix() {
    return this.isSwipe ? "swipe-action" : "ctx-action";
  }
}
</script>

<style lang="scss">
.swipe-action {
  display: flex;
  align-items: center;
  padding: 0 2rem;
  cursor: pointer;
  left: 0;
  height: 100%;
  transition: background-color 0.125s linear;

  @include everyColor("background-color", "gray-1", "swipe-action-");

  &:not(.swipe-action-disabled):hover {
    @include everyColor(
      "background-color",
      "gray-1",
      "swipe-action-",
      "",
      "d10"
    );
  }

  &.swipe-action-disabled {
    @include everyColor(
      "background-color",
      "gray-1",
      "swipe-action-",
      "",
      "d15"
    );
  }
}

.ctx-action {
  @extend %ctx-item-background;
  @include everyColor("color", "text", "ctx-action-", "", "l10");
  padding: 10px;
  border-radius: $ctx-border-radius;
  display: grid;
  grid-template-columns: 20px 1fr;
  transition: background-color 0.125s linear;
  cursor: pointer;

  &:not(.ctx-action-disabled) {
    &:hover {
      @include responsiveProperty("background-color", "gray-6", "", "l2.5");
    }

    &:active {
      @include responsiveProperty("background-color", "gray-6", "", "l5");
    }
  }

  &.ctx-action-disabled {
    @include responsiveProperty("background-color", "gray-6", "", "d2.5");
    @include everyColor("color", "text", "ctx-action-", "", "l5");
    cursor: not-allowed;
  }

  .ctx-action-icon {
    display: flex;
    flex-flow: row;
    justify-content: center;
  }

  .ctx-action-label {
    font-size: 0.9em;
    display: flex;
    align-items: center;

    &:not(:first-child) {
      padding-left: 5px;
    }
  }
}
</style>