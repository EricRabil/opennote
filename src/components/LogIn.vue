<template>
  <div class="login-root">
    <div class="login-button-container">
      <h2>We'll need you to sign in first.</h2>
      <span v-for="method of loginMethods" :key="method" :class="['login-button', method]" @click="triggerLogin(method)">
        <span class="login-provider-icon">
          <font-awesome-icon :icon="icons[method]"></font-awesome-icon>
        </span>
        <p class="login-button-label">
          Sign in with {{properMethods[method]}}
        </p>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";

@Component({
  components: {
    FontAwesomeIcon
  }
})
export default class LogIn extends Vue {
  icons = {
    google: faGoogle,
    local: faEnvelope
  }

  get loginMethods() {
    return this.$store.state.dory.loginMethods;
  }

  get properMethods() {
    return this.loginMethods.reduce((acc, method) => ({...acc, [method]: method.split(' ').map(word => word === 'local' ? 'email' : word).map(word => `${word[0].toUpperCase()}${word.substring(1).toLowerCase()}`).join(' ')}),{});
  }

  get sdk() {
    return this.$store.state.dory.sdk;
  }

  triggerLogin(method: string) {
    if (!this.sdk) return;
    switch (method){
      case 'local':
        // do local
      default:
        this.sdk.triggerAuthenticationFlowForMethod(method);
    }
  }
}
</script>

<style lang="scss">
$oauth-colors: (
  google: (
    color: #dd4b39
  ),
  local: (
    color: #575757
  )
);

.login-root {
  & > .login-button-container {
    @extend %bg2;
    @extend %border1;
    display: grid;
    grid-auto-rows: auto;
    row-gap: 10px;
    width: 300px;
    margin: auto;
    padding: 20px;
    border-radius: 5px;

    & > h2 {
      @extend %text;
      padding-bottom: 5px;
      text-align: center;
    }

    & > .login-button {
      display: flex;
      flex-flow: row;
      width: 75%;
      text-align: center;
      cursor: pointer;
      padding: 10px;
      border-radius: 5px;
      margin: 0 auto;

      @each $provider, $data in $oauth-colors {
        $color: map-get($data, color);
        &.#{$provider} {
          background-color: $color;
          transition: background-color 0.125s linear;

          &:hover {
            background-color: darken($color, 10);
          }
        }
      }

      & > .login-provider-icon {
        width: min-content;
      }

      & > .login-button-label {
        flex-grow: 1;
      }

      &.local {

      }
    }
  }
}
</style>