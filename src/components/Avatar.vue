<template>
  <div class="avatar" :style="{'background-image': avatarURL && `url(${avatarURL})`}">
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class Avatar extends Vue {
  @Prop()
  selector: string;

  get sdk() {
    return this.$store.state.dory.sdk;
  }

  get avatarURL() {
    return this.selector && this.sdk && this.sdk.resolveFilePath(this.selector);
  }
}
</script>

<style lang="scss">
.avatar {
  @extend %bgAlt0;
  height: 100%;
  border-radius: 5px;
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
}
</style>