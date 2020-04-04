<template>
  <div v-tooltip.auto="tooltip" :class="['button', color && `button-${color}`]" v-on="$listeners">
    <slot></slot>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class UIButton extends Vue {
  @Prop()
  disabled: boolean;

  @Prop()
  tooltip: string;

  @Prop()
  color: string;
}
</script>

<style lang="scss">
.button {
  $baseColor: "gray-5";
  @include everyColor("background-color", $baseColor, "button-", "", "", 1);
  @include transition("background-color");
  @include border();
  display: flex;
  cursor: pointer;
  padding: 10px;
  align-items: center;
  justify-content: center;

  &:hover {
    @include everyColor("background-color", $baseColor, "button-", "", "d2.5");
  }

  &:active {
    @include everyColor("background-color", $baseColor, "button-", "", "d5");
  }
}

%button-inverted {
  @include everyColor("color", "text", "button-", "", "", 1);
  @include everyColor("fill", "text", "button-", "", "", 1);
  padding: 5px;
}

.buttons-inline {
  .button {
    @extend %button-inverted;
    background-color: unset;
    border: unset;
  }
}

.buttons-skinny {
  .button {
    @extend %button-inverted;
  }
}
</style>