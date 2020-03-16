<template>
  <div class="share-root">
    <span class="share-cta">
      <h2>Let's get your note out for the world to see.</h2>
      <note-selector :note="note" :readonly="true"></note-selector>
    </span>
    <span class="shortcode-controller">
      <label>
        Shortcode
        <input type="text" ref="shortcode" :value="shortCode">
      </label>
      <decision-buttons class="decision-buttons" :hasCancel="false" confirmText="Share" confirmStyle="primary" :confirm="saveShortcode"></decision-buttons>
    </span>
  </div>
</template>

<script lang="ts">
const toastify = require("toastify-js");
import "toastify-js/src/toastify.css";
import { Component, Vue, Prop } from "vue-property-decorator";
import NoteSelector from "@/components/NoteSelector.vue";
import DecisionButtons from "@/components/DecisionButtons.vue";
import { NoteModel } from '../api.sdk';
import _ from '../util';

@Component({
  components: {
    NoteSelector,
    DecisionButtons
  }
})
export default class ShareNote extends Vue {
  @Prop()
  id: string;

  $refs: {
    shortcode: HTMLInputElement;
  };

  note: NoteModel = {
    id: null as any,
    name: null as any,
    created: null as any
  } as any;

  async mounted() {
    if (!this.sdk) return;
    await this.loadModel();
  }

  get shortCode() {
    return this.note && this.note.shortCode;
  }

  async loadModel() {
    this.note = (await this.sdk.getNote(this.id))!;
  }

  async saveShortcode() {
    const shortCode = this.$refs.shortcode.value;
    if (this.note.shortCode !== shortCode) await this.sdk.editNote(this.id, { shortCode });
    this.copyShortcodeToClipboard();
  }

  copyShortcodeToClipboard() {
    const url = `${location.origin}/note/${this.$refs.shortcode.value}`;
    _.copyTextToClipboard(url);
    toastify({
      text: "Copied note link to the clipboard",
      duration: 5000
    }).showToast();
    this.$emit("close");
  }

  get sdk() {
    return this.$store.state.dory.sdk;
  }
}
</script>

<style lang="scss">
.share-root {
  padding: 20px 40px;

  .share-cta {
    display: grid;
    grid-auto-rows: auto;
    row-gap: 20px;
  }

  .note-selector {
    border-radius: 5px;
  }

  .decision-buttons > .control {
    max-width: unset;
  }

  .shortcode-controller {
    & > label {
      @extend %textAlt2;

      transition: color 0.125s linear;
      margin: 15px 0;
      display: grid;
      grid-template-rows: auto;
      row-gap: 7.5px;
      font-size: 0.8em;
      text-transform: uppercase;

      & > input {
        @extend %bg1;
        @extend %textAlt2;
        @extend %border2;
        transition: all 0.125s linear;
        border-radius: 5px;
        padding: 10px;
        font-size: 1.2em;
        line-height: 0.5em !important;

        &:focus {
          outline: none;
          @extend %border3;
        }
      }

      &:focus-within {
        @extend %text;

        & > input {
          @extend %text;
        }
      }
    }
  }
}
</style>