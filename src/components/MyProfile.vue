<template>
  <div class="profile-root">
    <div class="profile-editor">
      <mutable-inputs class="profile-fields" :fields="editableData" :data="profile" :changes="changes"></mutable-inputs>
      <dropzone class="profile-avatar" :onFile="triggerUpload">
        <avatar :selector="avatar"></avatar>
        <decision-buttons :hasCancel="false" confirmText="Upload" confirmStyle="primary" :confirm="triggerUpload"></decision-buttons>
      </dropzone>
    </div>
    <decision-buttons :hasCancel="false" confirmText="Save" confirmStyle="primary" :confirm="saveChanges"></decision-buttons>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import DecisionButtons from "@/components/DecisionButtons.vue";
import Avatar from "@/components/Avatar.vue";
import Dropzone from "@/components/Dropzone.vue";
import MutableInputs, { Field } from "@/components/MutableInputs.vue";
import _ from '../util';

@Component({
  components: {
    DecisionButtons,
    Dropzone,
    Avatar,
    MutableInputs
  }
})
export default class MyProfile extends Vue {
  editable = ["email", "username"];
  changes: {
    [key: string]: any;
  } = {};

  get profile() {
    return this.$store.state.dory.userModel;
  }

  get diff() {
    return Object.keys(this.changes)
      .filter(key => !!this.changes[key])
      .filter(key => this.changes[key] !== (this.profile as any)[key])
      .reduce((acc, key) => ({ ...acc, [key]: this.changes[key] }), {});
  }

  get editableData(): Field[] {
    return this.editable.map(field => ({
      id: field,
      name: field[0].toUpperCase() + field.substring(1)
    }));
  }

  get sdk() {
    return this.$store.state.dory.sdk;
  }

  get avatar() {
    return this.profile && this.profile.avatar;
  }

  async saveChanges() {
    if (!this.sdk) return;
    const user = await this.sdk.patchUser(this.diff);
    await this.$store.commit("setUserModel", user);
  }

  async triggerUpload(file?: File) {
    if (!this.sdk) return;
    if (!file) {
      const result = await _.promptForFiles({
        multiple: false,
        accept: 'image/*'
      });
      file = result[0] as File;
    }
    
    await this.sdk.setAvatar(file);
    await this.$store.dispatch('refreshUserModel');
  }
}
</script>

<style lang="scss">
.profile-root {
  display: flex;
  flex-flow: column;

  & > .controls {
    margin-top: 10px;
    flex-flow: row-reverse;
  }

  & > .profile-editor {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 125px;
    column-gap: 10px;

    @media screen and (max-width: 500px) {
      flex-flow: column;
    }

    & > .profile-fields {
      display: grid;
      grid-auto-rows: min-content;
      row-gap: 2.5px;
    }

    & > .profile-avatar {
      @extend %bgAlt6;
      border-radius: 5px;
      padding: 10px;
      display: flex;

      & > .avatar {
        margin-bottom: 10px;
      }

      flex-flow: column;
    }
  }
}
</style>