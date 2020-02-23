<template>
    <div class="controls">
        <div :class="['control', `control-${confirmStyle}`]" @click="confirm">
            {{confirmText}}
        </div>
        <div class="control control-neutral" @click="cancel">
            {{cancelText}}
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";

@Component
export default class ConfirmationModal extends Vue {
    @Prop()
    cancel: () => any;

    @Prop()
    confirm: () => any;

    @Prop({ default: 'Cancel' })
    confirmText: string;

    @Prop({ default: 'Confirm' })
    cancelText: string;

    @Prop({ default: 'neutral' })
    confirmStyle: string;
}
</script>

<style lang="scss">
.modal {
    .control:not(:last-child) {
        margin-right: 5px;
    }
    .control {
        @extend %bgAlt3;
        color: white;
        padding: 10px;
        border-radius: 5px;
        cursor: pointer;
        text-align: center;
        font-size: 11px;
        flex-grow: 1;
        transition: background-color 0.0625s linear;

        &:hover {
            @extend %bgAlt4;
        }

        &:active {
            @extend %bgAlt5;
        }

        &.control-danger {
            @extend %bgRed;
            &:hover {
                @extend %bgRedAlt;
            }

            &:active {
                @extend %bgRedAlt1;
            }
        }

        &.control-primary {
            @extend %bgBlue;
            &:hover {
                @extend %bgBlueAlt;
            }

            &:active {
                @extend %bgBlueAlt1;
            }
        }
    }
    .controls {
        display: flex;
        flex-flow: row;
        text-transform: uppercase;
    }
}
</style>