<template>
  <log-in v-if="!isLoggedIn"></log-in>
  <my-profile v-else></my-profile>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import LogIn from "@/components/LogIn.vue";
import MyProfile from "@/components/MyProfile.vue";

@Component({
  components: {
    LogIn,
    MyProfile
  }
})
export default class AccountManager extends Vue {
  async mounted() {

  }

  get isLoggedIn() {
    return this.$store.state.dory.userModel !== null;
  }

  get sdk() {
    return this.$store.state.dory.sdk;
  }
}
</script>