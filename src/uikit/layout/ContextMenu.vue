<template>
  <portal to="context-menu" v-on="$listeners">
    <div class="context-menu-inner">
      <slot></slot>
    </div>
  </portal>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { Portal } from "portal-vue";

@Component({
  components: {
    Portal
  }
})
export default class ContextMenu extends Vue {
  @Prop()
  coords: object;
}
</script>