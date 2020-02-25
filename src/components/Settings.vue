<template>
    <div class="settings-panel">
        <div :class="['pane-switcher', activePane === -1 ? 'col-primary' : '']">
            <span :class="['pane-item', activePane === index ? 'active' : '']" v-for="(pane, index) of panes" :key="index" @click="activePane = index">
                {{pane.name}}
            </span>
        </div>
        <div v-if="activePane > -1" :class="['pane', activePane > -1 ? 'col-primary' : '']">
            <h2 class="pane-title">{{pane.name}}</h2>
            <p class="pane-desc" v-if="pane.description" v-html="pane.description"></p>
            <form v-if="pane.fields">
                <span class="input-group" v-for="(input, index) of pane.fields" :key="index">
                    <span :class="['input-field', `input-${input.type}`, input.options ? 'input-pick' : '']">
                        <template v-if="!input.options">
                            <label :for="`${pane.id}:${input.id}`" class="input-name" >{{input.name}}</label>
                            <input :id="`${pane.id}:${input.id}`" :type="input.type" v-model="controls[pane.id][input.id]">
                        </template>
                        <template v-else>
                            <span class="input-pick-name">{{input.name}}</span>
                            <template v-for="(choice, choiceIndex) of input.options">
                                <input type="radio" :id="`${pane.id}:${input.id}:${choiceIndex}`" :value="choice" :key="`${pane.id}:${input.id}:${choice}:${choiceIndex}`" v-model="controls[pane.id][input.id]">
                                <label :for="`${pane.id}:${input.id}:${choiceIndex}`" class="input-name" :key="`${pane.id}:${input.id}:${choice}:${choiceIndex}:label`">{{choice}}</label>
                            </template>
                        </template>
                    </span>
                    <span class="input-desc" v-if="input.description">{{input.description}}</span>
                </span>
            </form>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

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

@Component
export default class Settings extends Vue {
    activePane: number = 0;

    controls: {
        [pane: string]: {
            [control: string]: any;
        };
    } = {};

    panes: Pane[] = [

        {
            id: 'editor',
            name: 'Editor',
            description: 'Configure how the editor behaves by default',
            fields: [
                {
                    id: 'showLabels',
                    name: 'Show labels',
                    description: 'Show the toolbox labels by default',
                    type: 'checkbox',
                    update: (value: boolean) => this.$store.commit('setPreference', { name: 'showLabels', value }),
                    value: () => this.$store.state.preferences.showLabels
                },
                {
                    id: 'showToolbox',
                    name: 'Show toolbox',
                    description: 'Show the toolbox itself by default',
                    type: 'checkbox',
                    update: (value: boolean) => this.$store.commit('setPreference', { name: 'showToolbox', value }),
                    value: () => this.$store.state.preferences.showToolbox
                },
                {
                    id: 'hideEditorByDefaultOnMobile',
                    name: 'Default Mobile View',
                    description: 'Which screen should be presented when opening the app?',
                    type: 'string',
                    options: [
                        'Menu',
                        'Editor'
                    ],
                    update: (value: 'Menu' | 'Editor') => this.$store.commit('setPreference', { name: 'hideEditorByDefaultOnMobile', value: value === 'Editor' ? false : true }),
                    value: () => this.$store.state.preferences.hideEditorByDefaultOnMobile ? 'Menu' : 'Editor'
                },
                {
                    id: 'defaultNoteName',
                    name: 'Default Note Name',
                    description: 'Change the default name of notes',
                    type: 'string',
                    update: value => this.$store.commit('setPreference', { name: 'defaultNoteName', value }),
                    value: () => this.$store.state.preferences.defaultNoteName
                }
            ]
        },
        {
            id: 'credits',
            name: 'Credits',
            description: 'Thanks everyone!'
        }
    ]

    created() {
        this.panes.forEach(pane => {
            Vue.set(this.controls, pane.id, pane.fields && pane.fields.reduce((a,c) => {
                a[c.id] = c.value();
                return a;
            }, {} as any));
            pane.fields && pane.fields.forEach(c => {
                this.$watch(`controls.${pane.id}.${c.id}`, newVal => c.update(newVal));
            });
        });

        const header = document.createElement('div');
        header.classList.add('modal-header', 'settings-modal-header');
        
        const title = document.createElement('h1');
        title.innerText = 'Settings';
        header.appendChild(title);

        const backButton = document.createElement('span');
        backButton.classList.add('settings-modal-nav-back');
        header.appendChild(backButton);

        backButton.addEventListener("click", () => this.activePane = -1);

        this.$root.$emit('modal-patch', { header, customClasses: ['settings-modal'] });

        this.$watch('activePane', active => {
            if (active === -1) backButton.classList.add('hidden');
            else backButton.classList.remove('hidden');
        });

        window.addEventListener('resize', () => {
            if (this.activePane !== -1) return;
            if (document.documentElement.clientWidth <= 500) return;
            this.activePane = 0;
        });
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

        & .settings-modal-nav-back {
            cursor: pointer;
            margin: 5px;
            line-height: 1rem;
            &::after {
                content: '\00ab';
            }

            &.hidden {
                display: none;
            }
        }
    }
}

.settings-modal {
    @media only screen and (max-height: 450px) {
        padding-left: 50px;
    }

    width: 100%;
}

.settings-panel {
    display: grid;
    grid-template-columns: 100px auto;
    grid-template-rows: 300px;
    grid-column-gap: 10px;
    max-width: 440px;

    @media only screen and (max-width: 650px) {
        grid-template-columns: 100px auto;
        width: unset;
        max-width: unset;
    }

    @media only screen and (max-width: 500px) {
        display: block;

        & > :not(.col-primary) {
            display: none !important;
        }
    }

    h1, h2, h3, h4, h5, h6, p {
        margin: 0;
        line-height: 1em;
    }

    .pane-switcher {
        display: flex;
        flex-flow: column;
        overflow-y: scroll;
        flex-grow: 1;

        .pane-item {
            cursor: pointer;
            text-align: center;
            margin: 5px;
            padding: 5px;
            border-radius: 5px;
            text-transform: uppercase;
            font-size: 11px;
            transition: background-color 0.0625s linear;

            @media only screen and (max-width: 500px) {
                @include bgSchemeResponsive("bgAlt8");
            }

            &.active {
                @extend %bgAlt2;
            }

            &:first-child {
                margin-top: 0;
            }

            &:last-child {
                margin-bottom: 0;
            }
        }
    }

    .pane {
        display: flex;
        flex-flow: column;
        overflow-y: scroll;
        flex-grow: 1;

        & > .pane-title {
            @include schemeResponsive("border-bottom", "borderAlt1");
            margin-bottom: 5px;
            padding-bottom: 5px;
        }

        & > .pane-desc {
            @extend %textAlt;
            font-size: 12px;
            margin-bottom: 5px;
        }

        .input-group {
            display: flex;
            flex-flow: column;
            @extend %bgAlt7;
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
                        @include bgSchemeResponsive("bg0");
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