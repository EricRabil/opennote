<template>
  <modal class-list="modal-outline modal-fit" :fullscreen="true" :closable="false">
    <h1 slot="header">
      Welcome to OpenNote
    </h1>

    <template slot="body">
      <p style="max-width: 300px;">Eventually there will be a carousel here with a slideshow and cool graphics but for now just get out of my sight.</p>
    </template>

    <ui-button-tray slot="footer">
      <ui-button color="blue" @click="shouldLaunch">
        Launch OpenNote
      </ui-button>
    </ui-button-tray>
  </modal>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";

@Component
export default class OnboardingModal extends Vue {
  shouldLaunch() {
    this.$store.commit("setPreference", { name: "sawFirstRun", value: true });
    if (this.close) this.close();
  }

  close() {
    this.$emit("close");
  }
}
</script>