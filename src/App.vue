<template>
  <div id="app">
    <router-view v-if="!firstRun" />
    <transition name="fade">
      <div class="modal-root"
          v-if="modalOptions !== null"
          ref="modalRoot">
          <div :class="['modal', ...(modalOptions.customClasses || [])]" ref="modal">
            <!-- Close Button -->
            <div class="modal-close" v-if="modalOptions.closable !== false" @click="closeModal">&times;</div>

            <!-- Header -->
            <element-host
              v-if="isNode(modalOptions.header)"
              :element="modalOptions.header"
              ></element-host>
            <div class="modal-header" v-else>
              <h1
                v-if="modalOptions.header && typeof modalOptions.header === 'string'"
              >{{modalOptions.header}}</h1>
              <component
                v-else-if="modalOptions.header && typeof modalOptions.header === 'function'"
                v-bind="modalOptions.headerOptions"
                :is="modalOptions.header"
              ></component>
            </div>

            <!-- Body -->
            <div class="modal-body" v-if="typeof modalOptions.body === 'string'">
              {{modalOptions.body}}
            </div>
            <component class="modal-body" v-else :is="modalOptions.body" v-bind="modalOptions.bodyOptions"></component>

            <!-- Footer -->
            <div
              class="modal-footer"
              v-if="typeof modalOptions.footer === 'string'"
            >{{modalOptions.footer}}</div>
            <component
              class="modal-footer"
              v-else-if="modalOptions.footer && typeof modalOptions.footer === 'function'"
              v-bind="modalOptions.footerOptions"
              :is="modalOptions.footer"
            ></component>
          </div>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { Tooltip } from "@editorjs/editorjs/types/api";
import { VueConstructor } from "vue";
import ElementHost from "@/components/ElementHost.vue";
import Onboarding from './components/Onboarding.vue';
import DecisionButtons from "@/components/DecisionButtons.vue";
import _ from './util';

export interface ModalOptions {
  header?: string | VueConstructor | HTMLElement;
  headerOptions?: any;
  footer?: string | VueConstructor;
  footerOptions?: any;
  body: string | VueConstructor;
  bodyOptions?: any;
  customClasses?: string[];
  closable?: boolean;
}

function mergeObject(thisArg: any, prop: string, obj: any) {
  Object.keys(obj).forEach(k => Vue.set(thisArg[prop], k, obj[k]));
}

@Component({
  components: {
    ElementHost
  }
})
export default class App extends Vue {
  tooltip: Tooltip = null as any;
  modalOptions: ModalOptions | null = null;
  onclick = (e: MouseEvent) => this.clickListener(e);

  $refs: {
    modal: HTMLDivElement;
    modalRoot: HTMLDivElement;
  };

  get firstRun() {
    return !this.$store.state.preferences.sawFirstRun;
  }

  mounted() {
    this.$on("modal-show", (options: ModalOptions) => this.showModal(options));
    this.$on("modal-close", () => this.closeModal());
    this.$on("modal-patch", (options: Partial<ModalOptions>) => mergeObject(this, 'modalOptions', options));

    this.$root.$on("modal-show", (options: ModalOptions) =>
      this.$emit("modal-show", options)
    );
    this.$root.$on("modal-close", () => this.$emit("modal-close"));
    this.$root.$on("modal-patch", (options: Partial<ModalOptions>) => this.$emit("modal-patch", options));

    document.addEventListener("click", this.onclick);

    this.$store.watch((state, getters) => getters.preferredColorScheme, (newValue: string, oldValue) => {
      _.ensureDefaults();
      switch (newValue) {
        case 'light':
        case 'dark':
          _.setPreferredColorScheme(newValue);
          break;
        default:
          _.resetPreferredColorScheme();
      }
    });

    _.setPreferredColorScheme(this.$store.state.preferences.preferredColorScheme);

    if (!this.$store.state.preferences.sawFirstRun) {
      this.$root.$emit('modal-show', {
        header: 'Hello',
        body: Onboarding,
        footer: DecisionButtons,
        footerOptions: {
          confirmText: "Launch OpenNote",
          confirmStyle: "primary",
          confirm: () => {
            this.$store.commit('setPreference', { name: 'sawFirstRun', value: true });
            this.$root.$emit('modal-close');
          },
          hasCancel: false
        },
        closable: false
      } as ModalOptions);
    }
  }

  isNode(obj: any) {
    return obj && obj.nodeType === Node.ELEMENT_NODE;
  }

  destroyed() {
    document.removeEventListener("click", this.onclick);
  }

  modalReady(): boolean {
    if (!this.$refs.modalRoot) return false;
    return !this.$refs.modalRoot.classList.contains('fade-enter-active');
  }

  clickListener(e: MouseEvent) {
    const inside =
      this.$refs.modal &&
      (this.$refs.modal === e.target ||
        this.$refs.modal.contains(e.target as Node));
    if (inside || !this.modalReady()) return;
    this.closeModal();
  }

  showModal(options: ModalOptions) {
    console.debug("showing modal with options", {
      options
    });
    this.modalOptions = options;
  }

  closeModal() {
    if (!this.modalOptions) return;
    console.debug("closing modal with options", {
      options: this.modalOptions
    });
    this.modalOptions = null;
  }
}
</script>

<style lang="scss">
body {
  @extend %bg;
  margin: 0;
  font-family: "Open Sans", sans-serif;
}

html, body, #app {
  overflow: hidden;
  width: 100vw;
  max-height: 100vh;
  touch-action: manipulation;
}

.cdx-input.cdx-warning__message {
  display: none;
}

.cdx-input.cdx-simple-image__caption {
  display: none;
}

.fade-enter-active, .fade-leave-active {
  @keyframes modal-entry {
    from {
      transform: translateY(-200px);
    }
    to {
      transform: translateY(0px);
    }
  }

  & > .modal {
    @media only screen and (min-width: 651px) {
      animation: modal-entry 0.25s linear;
    }
    will-change: transform;
  }

  &.fade-leave-active > .modal {
    animation-direction: reverse;
  }

  transition: opacity .25s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}

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

  & > .modal {
    @extend %bgAlt1;
    @extend %text;
    @include schemeResponsive("box-shadow", "shadow-regular");
    border-radius: 5px;
    overflow: hidden;
    position: absolute;
    max-width: 465px;

    @mixin modalFullscreen {
      max-width: 100%;
      width: 100%;
      height: 100%;
      border-radius: 0;
      display: flex;
      flex-flow: column;
      justify-content: center;

      & > .modal-header {
        background: none !important;
        padding: 10px 40px !important;
        margin-bottom: 0px !important;
      }
    }

    &.modal-fullscreen {
      @include modalFullscreen();
    }

    @media only screen and (max-width: 650px), only screen and (max-height: 450px) {
      @include modalFullscreen();
    }

    & > .modal-header {
      @extend %bgAlt2;
      display: flex;
      padding: 20px 40px;
      margin-bottom: 10px;
      line-height: 1;

      & > .modal-close {
        line-height: 0;
      }

      & h1 {
        font-size: 20px;
        font-weight: 300;
        margin: 0;
      }

      &:empty {
        display: none;
      }
    }

    & > .modal-body {
      padding: 10px 40px;
    }

    & > .modal-footer {
      margin: 10px 0;
      padding: 10px 60px;
    }

    & > .modal-close {
      position: absolute;
      right: 15px;
      top: 10px;
      cursor: pointer;

      @media only screen and (max-height: 450px) {
          right: 75px;
          top: 25px;
      }
    }
  }
}

.ce-block {
  &.ce-block--focused {
    @include schemeResponsive("background-image", "ce-block--focused");
  }

  .cdx-checklist__item {
    .cdx-checklist__item-checkbox {
      @extend %bgAlt0;
      @extend %border;
    }

    &.cdx-checklist__item--checked {
      .cdx-checklist__item-checkbox {
        background: #388ae5 !important;
      }
    }
  }

  .ce-code__textarea,
  .ce-rawtool__textarea,
  .cdx-block.cdx-quote > .cdx-input,
  .cdx-block.cdx-warning > .cdx-input {
    @extend %bg1;
    @extend %border1;
    @extend %text;
  }

  .cdx-block.tc-editor {
    & > .tc-table__wrap {
      @extend %border1;

      & .tc-table__cell {
        @extend %border1;
      }

      .tc-table tbody tr td:first-child {
        border-left: none;
      }

      .tc-table tbody tr td:first-child,
      .tc-table tbody tr:first-child td {
        border-top: none;
      }

      .tc-table tbody tr:last-child td {
        border-bottom: none;
      }

      .tc-table tbody tr td:last-child {
        border-right: none;
      }
    }
  }
}

// i hate firefox
[contenteditable]::before {
  content: "\200B" !important;
  display: inline-flex;
}
</style>
