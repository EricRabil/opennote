<template>
  <div id="app">
    <router-view v-if="!firstRun" />

    <div class="build-number" v-if="buildNumber">#{{buildNumber}}</div>
    <context-menu-controller ref="ctxController"></context-menu-controller>
    <modal-controller ref="modalController"></modal-controller>
    <onboarding-modal v-if="modals.onboarding" @close="modals.onboarding = false"></onboarding-modal>
    <settings-modal v-if="modals.settings" v-bind="modalOptions.settings" @close="modals.settings = false"></settings-modal>
    <confirmation-modal v-if="flash" :cancellable="false" :color="flash.color" :confirmation="flash.acknowledge || 'Ok'" :header="flash.title" @close="flash = null">
      {{flash.message}}
    </confirmation-modal>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { Tooltip } from "@editorjs/editorjs/types/api";
import { VueConstructor } from "vue";
import DecisionButtons from "@/components/layout/DecisionButtons.vue";
import _ from "@/util";
import ShareNote from "@/components/modals/ShareNoteModal.vue";
import { ONoteSDK, NoteModel } from "@/api.sdk";
import { Action } from "@/uikit/layout/Actions.vue";
import ContextMenuController from "@/uikit/controllers/ContextMenuController.vue";
import Modal from "@/uikit/layout/Modal.vue";
import ConfirmDeleteModal from "@/components/modals/ConfirmDeleteModal.vue";
import OnboardingModal from "@/components/modals/OnboardingModal.vue";
import ModalController from "@/uikit/controllers/ModalController.vue";
import SettingsModal from "@/components/modals/SettingsModal.vue";
import { UIColor } from "./uikit/entry";

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
    OnboardingModal,
    SettingsModal
  }
})
export default class App extends Vue {
  tooltip: Tooltip = null as any;

  modals = {
    onboarding: false,
    settings: false
  };

  modalOptions = {
    settings: {
      jumpTo: null as null | string
    }
  };

  flash: {
    title: string;
    message: string;
    acknowledge?: string;
    color: UIColor;
  } | null = null;

  $refs: {
    ctxController: ContextMenuController;
    modalController: ModalController;
  };

  get firstRun() {
    return !this.$store.state.preferences.sawFirstRun;
  }

  get buildNumber() {
    if (process.env.NODE_ENV === "development") {
      return process.env.VUE_APP_BUILD_NUMBER || null;
    }
    return null;
  }

  async mounted() {
    this.$root.$on("exportNotes", () => this.exportNotes());
    this.$root.$on("importNote", () => this.importNote());
    this.$root.$on("downloadNote", (id: string) => this.download(id));
    this.$root.$on("shareNote", (id: string) => this.triggerShareNoteFlow(id));
    this.$root.$on("newNote", () => this.newNote());
    this.$root.$on("click", e => this.$refs.ctxController.clickListener(e));

    this.$store.watch(
      (state, getters) => getters.preferredColorScheme,
      (newValue: string, oldValue) => {
        _.ensureDefaults();
        switch (newValue) {
        case "light":
        case "dark":
          _.setPreferredColorScheme(newValue);
          break;
        default:
          _.resetPreferredColorScheme();
        }
      },
      {
        immediate: true
      }
    );

    this.$watch("modals.settings", showSettings => {
      if (!showSettings) {
        this.modalOptions.settings.jumpTo = null;
      }
    });

    this.modals.onboarding = this.firstRun;

    this.$store
      .dispatch("hydrate")
      .then(() => this.$nextTick())
      .then(() => {
        if (this.$store.state.dory.flashLoggedIn) {
          this.modals.settings = true;
          this.modalOptions.settings.jumpTo = "account";
        }
      });
  }

  async newNote() {
    this.$store.dispatch("newNote");
  }

  get authSDK(): ONoteSDK {
    return this.$store.getters.authSDK;
  }

  /**
   * Trigger share note modal, allow option to overwrite shortcode, generate link
   */
  triggerShareNoteFlow(id: string) {
    // this.$modal.show(ShareNote, { id });
  }

  async exportNotes() {
    let repeats: {
      [name: string]: number;
    } = {};
    const notes = this.$store.state.notes;
    const serialized = Object.keys(notes)
      .map(k => ({
        name: notes[k].name,
        text: JSON.stringify(notes[k])
      }))
      .map((data, idx, files) => {
        if (!repeats[data.name]) repeats[data.name] = 0;
        return {
          name:
            files.filter(f => f.name === data.name).length === 1
              ? data.name
              : `${data.name}${
                repeats[data.name]++ > 0 ? ` (${repeats[data.name] - 1})` : ""
              }`,
          text: data.text
        };
      })
      .map(({ name, text }) => ({
        name: `${name}.onote`,
        text
      }));
    await _.zipFilesAndDownload("OpenNote Export.zip", serialized);
  }

  download(id: string) {
    const note = this.$store.state.notes[id];
    _.saveFile(JSON.stringify(note), `${note.name}.onote`, "application/json");
  }

  async importNote() {
    try {
      const files = await _.getFilesAsString({
        parseData: true,
        accept: ".onote",
        multiple: true
      });
      files.forEach(file => this.$store.dispatch("newNote", JSON.parse(file)));
    } catch (e) {
      if (e instanceof _.DisplayableError) {
        this.flash = {
          message: e.options.message,
          title: e.options.title || "Uh oh!",
          color: "red"
        };
      }
    }
  }
}
</script>

<style lang="scss">
body {
  @extend %bg;
  margin: 0;
  font-family: "Open Sans", sans-serif;
}

html,
body,
#app,
.home {
  overflow: hidden;
  width: 100vw;
  max-height: 100vh;
  height: 100%;
  touch-action: manipulation;
}

html,
body {
  position: fixed;
  overflow: hidden;
}

.cdx-input.cdx-warning__message {
  display: none;
}

.cdx-input.cdx-simple-image__caption {
  display: none;
}

.fade-enter-active,
.fade-leave-active {
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

  transition: opacity 0.25s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
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

.build-number {
  @extend %text;
  @extend %bg3;
  position: absolute;
  bottom: 10px;
  right: 10px;
  padding: 2.5px 5px;
  border-radius: 5px;
  z-index: 99999999999;
}
</style>
