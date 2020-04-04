<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({
  render: function(h) {
    return h("div", {
      class: "button-tray"
    }, this.$slots.default!);
  }
})
export default class UIButtonTray extends Vue {
  mounted() {
    this.$slots
  }
}
</script>

<style lang="scss">
.button-tray {
  display: grid;
  grid-template-rows: 100%;
  grid-auto-columns: 1fr;
  grid-auto-flow: column dense;
  height: min-content;
  column-gap: 5px;

  &.button-tray-mini {
    width: fit-content;
  }
}
</style>