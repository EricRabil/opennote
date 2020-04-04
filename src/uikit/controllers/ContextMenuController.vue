<template>
  <div class="context-menu" v-show="coords" :style="{top, left}">
    <portal-target @should-close="close" ref="portalTarget" name="context-menu"></portal-target>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { PortalTarget } from "portal-vue";
import { Action } from "@/uikit/layout/Actions.vue";
import ContextMenu from "../layout/ContextMenu.vue";
import { VNode } from "vue";

declare module "vue/types/vue" {
  // 3. Declare augmentation for Vue
  interface Vue {
    $contextController: ContextMenuController;
  }
}

var contextMenuController: ContextMenuController;

Object.defineProperty(Vue.prototype, "$contextController", {
  get() {
    return contextMenuController;
  }
})

@Component({
  components: {
    PortalTarget
  }
})
export default class ContextMenuController extends Vue {
  coords: {
    top: number;
    left: number;
  } | null = null;

  $refs: {
    portalTarget: InstanceType<typeof PortalTarget>;
  };

  created() {
    contextMenuController = this;

    this.$watch("actions", (newValue, oldValue) => {
      if (!newValue && oldValue) {
        console.log("goodbye!");
      } else if (newValue && !oldValue) {
        console.log("hello!");
      } else {
        console.log("goodbye oldCtx, hello new!");
      }
    });
  }

  mounted() {
    var current: VNode | null = null;

    this.$refs.portalTarget.$watch(
      "passengers",
      (newT: VNode[], oldT: VNode[]) => {
        const [oldCtx] = oldT,
          [newCtx] = newT;
        if (!newCtx && !oldCtx) return;
        if (newCtx && oldCtx) {
          const { context: newVContext } = newCtx,
            { context: oldVContext } = oldCtx;
          if (newVContext && oldVContext) {
            if (newVContext["_uid"] === oldVContext["_uid"]) return;
            oldVContext.$emit("close");
          }
        }
        if (newCtx && newCtx.context) {
          current = newCtx;
          console.log("new ctx");
          newCtx.context.$watch(
            "coords",
            newCoords => {
              if (
                !current ||
                !current.context ||
                current.context["_uid"] !== newCtx!.context!["_uid"]
              )
                return;
              Vue.set(this, "coords", newCoords);
            },
            { immediate: true }
          );
        } else {
          Vue.set(this, "coords", null);
        }
      }
    );

    document.addEventListener("click", ev => this.clickListener(ev));
  }

  clickListener(clickEvent: MouseEvent) {
    if (this.coords) {
      if (!this.$el.contains(clickEvent.target as Node)) {
        Vue.set(this, "coords", null);
        this.close();
        return;
      }
    }
  }

  updateCoordinates() {}

  close() {
    const ctx = this.mountedCtx();
    if (!ctx) return;
    ctx.$emit("close");
  }

  mountedCtx(): ContextMenu | null {
    const target = this.$refs.portalTarget;
    const [modalNode] = target.passengers;
    if (
      modalNode &&
      modalNode.context &&
      modalNode.context instanceof ContextMenu
    )
      return modalNode.context;
    return null;
  }

  get top() {
    return this.coords && `${this.coords.top}px`;
  }

  get left() {
    return this.coords && `${this.coords.left}px`;
  }
}
</script>

<style lang="scss">
.context-menu {
  @include responsiveProperty("border", "gray-5", "1px solid %v");
  @extend %ctx-item-background;
  position: absolute;
  z-index: 1000000000000000;
  width: 150px;
  border-radius: $ctx-border-radius;
  overflow: hidden;
  -webkit-user-select: none;
  padding: 5px;
}
</style>