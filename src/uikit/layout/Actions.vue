<template>
  <div
    class="actionable-container"
    v-on="$listeners"
    @contextmenu.prevent="triggerContextMenu"
    no-gesture-pickup
  >
    <swipe-out ref="swipe" :passiveListeners="true" :disabled="!enabled || !hasTouch" @should-close="close">
      <slot v-if="hasTouch" name="actions-left" slot="left"></slot>
      <slot v-if="hasTouch" name="actions-right" slot="right"></slot>
      <div slot="default">
        <slot></slot>
      </div>
    </swipe-out>
    <context-menu
      v-if="isShowingContextMenu"
      :coords="contextCoordinates"
      ref="ctxMenu"
      @close="close"
    >
      <vnodes :vnodes="allActions"></vnodes>
    </context-menu>
  </div>
</template>

<script lang="ts">
import "vue-swipe-actions/dist/vue-swipe-actions.css";
import { Component, Prop, Vue } from "vue-property-decorator";
import { SwipeOut } from "vue-swipe-actions";
import { Portal } from "portal-vue";
import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { UIColor } from "@/uikit/entry";
import ContextMenu from "./ContextMenu.vue";
import { VNode } from "vue";

export interface Action {
  color: UIColor;
  content: string | HTMLElement | Vue | IconDefinition;
  label: string;
  trigger: () => any;
  disabled?: boolean;
  location?: "left" | "right";
}

export function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    (navigator as any).MaxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
}

@Component({
  components: {
    SwipeOut,
    vnodes: {
      functional: true,
      render: (h, ctx) => ctx.props.vnodes
    }
  }
})
export default class Actions extends Vue {
  @Prop({ default: () => [] })
  actions: Action[];

  @Prop({ default: () => isTouchDevice() })
  hasTouch: boolean;

  @Prop({ default: true })
  enabled: boolean;

  contextCoordinates: {
    top: number;
    left: number;
  } | null = null;

  $refs: {
    ctxMenu: ContextMenu;
    swipe: SwipeOut;
  };

  mounted() {}

  triggerContextMenu(contextMenu: MouseEvent) {
    const { clientY: top, clientX: left } = contextMenu;

    this.contextCoordinates = {
      top,
      left
    };
  }

  get isShowingContextMenu() {
    return this.enabled && this.contextCoordinates !== null;
  }

  close() {
    if (this.hasTouch) {
      this.$refs.swipe.close();
    } else {
      this.contextCoordinates = null;
    }
  }

  get content() {
    return this.$slots.default && this.$slots.default[0];
  }

  get allActions() {
    return ([] as VNode[])
      .concat(this.$slots["actions-left"]!, this.$slots["actions-right"]!)
      .reduce((a, c) => a.concat(c.children as any), [] as VNode[])
      .map(n => (n.componentOptions!.propsData!["close"] = () => this.close(), n));
  }

  get _filtered() {
    return this.actions.filter(a => typeof a === "object");
  }

  get leftActions() {
    return this._filtered.filter(a => a.location === "left");
  }

  get rightActions() {
    return this._filtered.filter(a => a.location !== "left");
  }
}
</script>

<style lang="scss">
.action-tray {
  display: flex;
  flex-flow: row;
}
</style>