<template>
    <div ref="mount"></div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";

@Component
export default class ElementHost extends Vue {
    @Prop()
    element: Node;

    $refs: {
        mount: HTMLDivElement;
    };

    mounted() {
        this.$refs.mount.replaceWith(this.element);
    }
}
</script>