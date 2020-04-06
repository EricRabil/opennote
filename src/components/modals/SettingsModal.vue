<template>
    <modal :body-as-content="true" :close="close">
        <h1 slot="header">Settings</h1>

        <div class="settings-panel" slot="body">
            <div :class="['pane-switcher', activePane === -1 ? 'col-primary' : '']">
                <span :class="['pane-item', activePane === index ? 'active' : '']" v-for="(pane, index) of panes" :key="index" @click="activePane = index">
                    {{pane.name}}
                </span>
                <span class="pane-item" @click="openSourcePage">
                    Source Code
                </span>
            </div>
            <template v-if="activePane > -1">
                <component v-if="pane.component" :class="['pane', activePane > -1 ? 'col-primary' : '']" :is="pane.component"></component>
                <div v-else-if="activePane > -1" :class="['pane', activePane > -1 ? 'col-primary' : '']">
                    <p class="pane-desc" v-if="pane.description" v-html="pane.description"></p>
                    <mutable-inputs v-if="pane.fields" :fields="pane.fields"></mutable-inputs>
                </div>
            </template>
        </div>
    </modal>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import MutableInputs from "@/components/controls/MutableInputs.vue";
import AccountManager from "@/components/settings/AccountManager.vue";

interface Pane {
    id: string;
    name: string;
    component?: Vue;
    description?: string;
    fields?: Array<{
        id: string;
        name: string;
        description?: string;
        type: "string" | "number" | "checkbox";
        options?: any[];
        update: (val: any) => any;
        value: () => any;
    }>;
}

@Component({
  components: {
    MutableInputs
  }
})
export default class Settings extends Vue {
    activePane: number = 0;

    @Prop()
    jumpTo: string;

    panes: Pane[] = [

      {
        id: "editor",
        name: "Editor",
        description: "Configure how the editor behaves by default",
        fields: [
          {
            id: "showLabels",
            name: "Show labels",
            description: "Show the toolbox labels by default",
            type: "checkbox",
            update: (value: boolean) => this.$store.commit("setPreference", { name: "showLabels", value }),
            value: () => this.$store.state.preferences.showLabels
          },
          {
            id: "showToolbox",
            name: "Show toolbox",
            description: "Show the toolbox itself by default",
            type: "checkbox",
            update: (value: boolean) => this.$store.commit("setPreference", { name: "showToolbox", value }),
            value: () => this.$store.state.preferences.showToolbox
          },
          {
            id: "hideEditorByDefaultOnMobile",
            name: "Default Mobile View",
            description: "Which screen should be presented when opening the app?",
            type: "string",
            options: [
              "Menu",
              "Editor"
            ],
            update: (value: "Menu" | "Editor") => this.$store.commit("setPreference", { name: "hideEditorByDefaultOnMobile", value: value === "Editor" ? false : true }),
            value: () => this.$store.state.preferences.hideEditorByDefaultOnMobile ? "Menu" : "Editor"
          },
          {
            id: "preferredColorScheme",
            name: "Theme",
            description: "Choose whether youi want light or dark mode, or inherit the system preference",
            type: "string",
            options: [
              "Light",
              "Dark",
              "Inherit"
            ],
            update: (value: "Light" | "Dark" | "Inherit") => this.$store.commit("setPreference", { name: "preferredColorScheme", value: value.toLowerCase() }),
            value: () => {
              switch (this.$store.state.preferences.preferredColorScheme) {
              case "light":
                return "Light";
              case "dark":
                return "Dark";
              default:
                return "Inherit";
              }
            }
          },
          {
            id: "defaultNoteName",
            name: "Default Note Name",
            description: "Change the default name of notes",
            type: "string",
            update: value => this.$store.commit("setPreference", { name: "defaultNoteName", value }),
            value: () => this.$store.state.preferences.defaultNoteName
          }
        ]
      },
      {
        id: "internal",
        name: "Internal",
        description: "Warning! Danger lies ahead.",
        fields: [
          {
            id: "backend",
            name: "Backend URL",
            description: "Changes may not take effect until after a restart.",
            type: "string",
            update: value => this.$store.commit("setPreference", { name: "backend", value }),
            value: () => this.$store.state.preferences.backend
          },
          {
            id: "collaborate",
            name: "Live Collaboration",
            description: "Use the extremely buggy live collaboration feature.",
            type: "checkbox",
            update: value => this.$store.commit("setPreference", { name: "enableCollaborationMode", value }),
            value: () => this.$store.state.preferences.enableCollaborationMode
          },
          {
            id: "newEditor",
            name: "Use New Editor",
            description: "We've been working on something spoopy :P",
            type: "checkbox",
            update: value => this.$store.commit("setPreference", { name: "useNewEditor", value }),
            value: () => this.$store.state.preferences.useNewEditor
          }
        ]
      },
      {
        id: "account",
        name: "Account",
        component: AccountManager as any
      },
      {
        id: "credits",
        name: "Credits",
        description: `
            OpenNote would not be possible without some amazing open-source libraries. Check them out!
            <a target="_blank" href="https://github.com/codex-team/editor.js" class="credit">editorjs</a>
            <a target="_blank" href="https://github.com/davidedc/Algebrite" class="credit">algebrite</a>
            <a target="_blank" href="https://github.com/d3/d3" class="credit">d3</a>
            <a target="_blank" href="https://github.com/mauriciopoppe/function-plot" class="credit">function-plot</a>
            <a target="_blank" href="https://github.com/tamuratak/latex-utensils" class="credit">latex-utensils</a>
            <a target="_blank" href="https://github.com/josdejong/mathjs" class="credit">mathjs</a>
            <a target="_blank" href="https://github.com/mathquill/mathquill" class="credit">mathquill</a>
            <a target="_blank" href="https://github.com/jiggzson/nerdamer" class="credit">nerdamer</a>
            <a target="_blank" href="https://github.com/vuejs/vue" class="credit">vue</a>
            `
      }
    ]

    close() {
      this.$emit("close");
    }

    openSourcePage() {
      window.open("https://github.com/ericrabil/opennote", "_blank");
    }

    created() {
      const header = document.createElement("div");
      header.classList.add("modal-header", "settings-modal-header");
        
      const title = document.createElement("h1");
      title.innerText = "Settings";
      header.appendChild(title);

      const backButton = document.createElement("span");
      backButton.classList.add("settings-modal-nav-back");
      header.appendChild(backButton);

      backButton.addEventListener("click", () => this.activePane = -1);

      this.$root.$emit("modal-patch", { header, customClasses: ["settings-modal"] });

      this.$watch("activePane", active => {
        if (active === -1) backButton.classList.add("hidden");
        else backButton.classList.remove("hidden");
      });

      window.addEventListener("resize", () => {
        if (this.activePane !== -1) return;
        if (document.documentElement.clientWidth <= 500) return;
        this.activePane = 0;
      });

      if (this.jumpTo) {
        this.activePane = this.panes.findIndex(pane => pane.id === this.jumpTo) || 0;
      }
    }

    get pane() {
      return this.panes[this.activePane];
    }
}
</script>

<style lang="scss">
.settings-modal-header {
    @media only screen and (max-width: 500px) {
        display: flex;
        flex-flow: row-reverse;
        justify-content: flex-end;
        align-items: center;

        & h1 {
            line-height: 1rem;
        }
    }
}

.settings-modal {
    width: 100%;
}

.settings-panel {
    display: grid;
    grid-auto-rows: min-content calc(100vh - 200px);

    @media only screen and (max-width: 650px), only screen and (max-height: 500px) {
        max-height: calc(100vh - 100px) !important;
        height: fit-content;
    }

    .pane-switcher, .pane {
        padding: 10px 40px;
    }

    h1, h2, h3, h4, h5, h6, p {
        margin: 0;
        line-height: 1em;
    }

    .pane-switcher {
        @extend %bgAlt1;
        display: flex;
        flex-flow: row;
        overflow-x: scroll;

        .pane-item {
            cursor: pointer;
            height: fit-content;
            padding: 5px;
            text-align: center;
            border-radius: 5px;
            text-transform: uppercase;
            font-size: 11px;
            transition: background-color 0.0625s linear;
            white-space: nowrap;

            &.active {
                @extend %bgAlt2;
            }

            $offset: -5px;
            &:first-child {
                margin-left: $offset;
            }

            &:last-child {
                margin-right: $offset;
                padding-right: 40px;
            }
        }
    }

    .pane {
        @extend %bg1;
        display: flex;
        flex-flow: column;
        overflow-y: scroll;

        @media screen and (max-height: 500px) {
            // max-height: unset;
            padding: 10px calc(100vw / 2 - 225px);
        }

        & > h2 {
            @include schemeResponsive("border-bottom", "borderAlt1");
            margin-bottom: 5px;
            padding-bottom: 5px;
        }

        & > p {
            @extend %textAlt;
            font-size: 12px;
            margin-bottom: 5px;
        }

        .credit {
            @extend %text;
            margin: 10px 0;
            display: block;
            font-size: 14px;
            text-decoration: none;
        }

        .input-group {
            display: flex;
            flex-flow: column;
            @extend %bgAlt6;
            border-radius: 5px;
            margin: 5px 0;

            &:first-child {
                margin-top: 0;
            }

            &:last-child {
                margin-bottom: 0;
            }

            .input-field {
                display: flex;
                flex-flow: column;

                &.input-checkbox {
                    padding: 10px;
                    flex-flow: row-reverse;
                    justify-content: flex-end;
                    align-items: center;

                    & ~ .input-desc {
                        @extend %textAlt;
                        padding: 0 10px 10px;
                        font-size: 11px;
                    }

                    input {
                        margin-right: 10px;
                    }
                }

                &.input-pick {
                    padding: 10px;
                    display: grid;
                    grid-template-columns: min-content auto;
                    grid-row-gap: 10px;

                    & .input-pick-name {
                        grid-column: 1 / span 2;
                    }

                    & input {
                        margin-right: 10px;
                    }

                    & ~ .input-desc {
                        @extend %textAlt;
                        padding: 0 10px 10px;
                        font-size: 11px;
                    }
                }

                &.input-string:not(.input-pick) {
                    padding: 10px;
                    display: flex;
                    flex-flow: column;

                    & .input-name {
                        padding-bottom: 10px;
                    }

                    & input {
                        @extend %border;
                        @extend %text;
                        @include bgSchemeResponsive("bgAlt0");
                        padding: 5px;
                        border-radius: 5px;
                        outline: none;
                    }

                    & ~ .input-desc {
                        @extend %textAlt;
                        padding: 0 10px 10px;
                        font-size: 11px;
                    }
                }

                .input-name {
                    line-height: 1em;
                }

                input {
                    margin: 0;
                }
            }
            
            // .input-desc {
            //     padding: 10px;
            // }
        }
    }
}
</style>