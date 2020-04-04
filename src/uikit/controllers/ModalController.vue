<template>
  <transition name="fade">
    <div class="modal-root" ref="modalRoot" v-show="!closed" @click="handleClick">
      <portal-target ref="portalTarget" name="modal-controller" @change="changed(!$event)" slim transition="fade"></portal-target>
    </div>
  </transition>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import Modal from "@/uikit/layout/Modal.vue";
import { PortalTarget } from "portal-vue";

declare module "vue/types/vue" {
  // 3. Declare augmentation for Vue
  interface Vue {
    $modalController: ModalController;
  }
}

var modalController: ModalController;

Object.defineProperty(Vue.prototype, "$modalController", {
  get() {
    return modalController;
  }
})

@Component({
  components: {
    PortalTarget
  }
})
export default class ModalController extends Vue {
  $refs: {
    modalRoot: HTMLDivElement;
    portalTarget: InstanceType<typeof PortalTarget>;
  };

  ready: boolean = false;
  closed: boolean = true;

  created() {
    modalController = this;
  }

  mounted() {
    this.ready = true;

    this.$on("close", () => this.close());
  }

  changed(isClosed: boolean) {
    this.closed = isClosed;
    if (this.closed && !this.isShowingModalContextMenu) return;
    this.$contextController.close();
  }

  get isShowingModalContextMenu() {
    return false;
  }

  handleClick(e: MouseEvent) {
    const mount = this.modalMount();
    if (!mount) return;
    if (!this.closeable()) return;
    if (mount.contains(e.target as Node)) return;
    this.close();
  }

  close() {
    const modal = this.mountedModal();
    if (!modal) return;
    modal.close();
  }

  mountedModal(): Modal | null {
    if (!this.ready) return null;
    const target = this.$refs.portalTarget;
    const [ modalNode ] = target.passengers;
    if (modalNode && modalNode.context && modalNode.context instanceof Modal) return modalNode.context;
    return null;
  }

  modalMount(): Node | null {
    if (!this.ready) return null;
    return this.$refs.modalRoot && this.$refs.modalRoot.children[0];
  }

  closeable() {
    const modal = this.mountedModal();
    if (!modal) return null;
    return modal.closable;
  }
}
</script>

<style lang="scss">

.modal-root {
  @extend %bgAlt1;
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100%;
  z-index: 0;
  display: flex;
  flex-flow: column;
  align-items: center;
  justify-content: center;
  user-select: none;
  transform: translateY(-100vh);
  z-index: 100000;
  transform: translateY(0);

  @supports (backdrop-filter: blur(10px)) {
    backdrop-filter: blur(10px);
    background: none;
  }

  @media only screen and (max-width: 650px) {
    display: block;
  }
}
</style>