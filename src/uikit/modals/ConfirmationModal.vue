<template>
  <modal :close="close">
    <h1 v-if="header" slot="header">
      {{header}}
    </h1>

    <slot slot="body"></slot>
    
    <ui-button-tray slot="footer">
      <ui-button v-if="cancellable" color="gray-1" @click="_cancel">
        Cancel
      </ui-button>
      <ui-button :color="color" @click="_confirm">
        {{confirmation}}
      </ui-button>
    </ui-button-tray>
  </modal>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { UIColor } from "../entry";

@Component
export default class ConfirmationModal extends Vue {
  @Prop({ default: "indigo" })
  color: UIColor;

  @Prop({ default: "Confirm" })
  confirmation: string;

  @Prop({ default: true })
  cancellable: boolean;

  @Prop()
  header: string;

  close() {
    this.$emit("close");
  }

  _cancel() {
    this.close();
    this.$emit("cancel");
  }

  _confirm() {
    this.close();
    this.$emit("confirm");
  }
}
</script>