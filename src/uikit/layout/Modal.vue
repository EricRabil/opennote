<template>
  <portal to="modal-controller">
    <div :class="['modal', {'modal-fullscreen': fullscreen}, ...classes]" ref="modal">
    <!-- Close Button -->
    <div class="modal-close" v-if="closable && $slots.header" @click="close">&times;</div>

    <div class="modal-inner">
        <!-- Header -->
        <div class="modal-header" v-if="$slots.header">
          <slot name="header"></slot>
        </div>

        <slot name="body" v-if="bodyAsContent"></slot>
        <div class="modal-content" v-else-if="$slots.body || $slots.footer">
          <!-- Body -->
          <div class="modal-body" v-if="$slots.body">
            <slot name="body"></slot>
          </div>

          <!-- Footer -->
          <div class="modal-footer" v-if="$slots.footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </div>
  </portal>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { Portal } from "portal-vue";

@Component({
  components: {
    Portal
  }
})
export default class Modal extends Vue {
  @Prop({ default: true })
  closable: boolean;

  @Prop()
  close: Function;

  /**
   * if true, the footer will be ignored and the body will be the modal-content
   */
  @Prop()
  bodyAsContent: boolean;

  @Prop({ default: false })
  fullscreen: boolean;

  @Prop({ default: "" })
  classList: string;

  get classes() {
    return this.classList.split(" ");
  }
}
</script>

<style lang="scss">
.modal {
  @extend %bgAlt1;
  @extend %text;
  @include schemeResponsive("box-shadow", "shadow-regular");
  border-radius: 5px;
  overflow: hidden;
  position: absolute;
  max-width: 500px;

  @mixin modalFullscreen {
    max-width: 100%;
    width: 100%;
    height: 100%;
    border-radius: 0;
    display: flex;
    flex-flow: column;
    justify-content: center;

    & > .modal-body {
      max-height: 300px;
      padding: 10px 40px;
    }

    & > .modal-header {
      background: none !important;
      padding: 10px 40px !important;
    }
  }

  &.modal-fullscreen {
    @include modalFullscreen();
  }

  @media only screen and (max-width: 650px),
    only screen and (max-height: 500px) {
    @include modalFullscreen();
  }

  &.modal-outline .modal-inner {
    @include responsiveProperty("border", "gray-3", "1px solid %v");
    border-radius: 5px;
    overflow: hidden;
  }

  &.modal-fit .modal-inner {
    width: fit-content;
    margin: 0 auto;
  }

  & .modal-header {
    @extend %bgAlt2;
    display: flex;
    padding: 20px 40px;
    line-height: 1;

    & > .modal-close {
      line-height: 0;
    }

    &:empty {
      display: none;
    }
  }

  & .modal-content {
    display: grid;
    row-gap: 20px;
    padding: 20px 40px;
  }

  &.modal-even .modal-content {
    padding: 20px;
  }

  & .modal-close {
    position: absolute;
    right: 15px;
    top: 10px;
    cursor: pointer;
  }
}
</style>