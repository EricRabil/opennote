<template>
  <div :class="['side-piece-container', !recognizers && 'no-recognizer']" :style="drawerStyle">
    <slot></slot>
    <transition name="feed">
      <div class="side-piece-overlay" v-if="showOverlay" :style="{ opacity }"></div>
    </transition>
  </div>
</template>

<script lang="ts">
import Hammer from "hammerjs";
import { Component, Prop, Vue } from "vue-property-decorator";
import _ from "@/util";

@Component
export default class SidePiece extends Vue {
  @Prop({ default: true })
  recognizers: boolean;

  drawerPosition: number = 0;

  mounted() {
    this.bindRecognizer(this.$el);
  }

  bindRecognizer(el: Element) {
    const hammer = new Hammer.Manager(el, {
      recognizers: [
        [Hammer.Pan, { direction: Hammer.DIRECTION_HORIZONTAL, threshold: 10 }]
      ]
    });

    hammer.on("pan", ev => this.panRecognizer(ev));
    hammer.on("panend", ev => {
      var pos = this.drawerPosition;
      if (ev.isFinal) {
        if (pos / this.width() > 0.7) {
          pos = this.width();
        } else {
          pos = 0;
        }
        this.$emit("drag-end");
      }
      requestAnimationFrame(() => Vue.set(this, "drawerPosition", pos));
    });

    this.$watch(
      "recognizers",
      enable => {
        hammer.set({
          enable
        });
      },
      { immediate: true }
    );

    return hammer;
  }

  panRecognizer(ev: HammerInput) {
    if (_.Dom.ancestorMatchesSelector(ev.target, "[no-gesture-pickup]")) return;

    if (ev.deltaY > 10) {
      // fuck that shit bye girl!
      return;
    }

    const event = !ev.isFinal ? "drag-start" : "drag-end";
    this.$emit(event);

    let pos = this.drawerPosition;

    let delta = Math.abs(ev.deltaX);
    switch (ev.direction) {
    case Hammer.DIRECTION_LEFT:
      pos -= delta;
      break;
    case Hammer.DIRECTION_RIGHT:
      pos += delta;
      break;
    }

    if (pos > this.width()) {
      pos = this.width();
    }

    if (pos <= 0) {
      pos = 0;
    }

    requestAnimationFrame(() => Vue.set(this, "drawerPosition", pos));
  }

  get drawerStyle() {
    if (!this.recognizers) return {};
    return {
      transform: `translateX(${this.drawerPosition}px)`,
      left: "-250px"
    };
  }

  get opacity() {
    return this.drawerPosition / this.width();
  }

  get showOverlay() {
    return this.drawerPosition > 1;
  }

  slot() {
    return this.$el.firstElementChild!;
  }

  width() {
    return this.slot().clientWidth;
  }
}
</script>

<style lang="scss">
.side-piece-container {
  &:not(.no-recognizer) {
    position: absolute;
    transition: transform 0.25s ease;
    z-index: 1000;
  }
  width: 250px;

  .side-piece-overlay {
    background-color: rgba(0,0,0,0.8);
    position: absolute;
    top: 0;
    left: 0;
    width: 100vh;
    height: 100vh;
    z-index: -1;
    transition: 0.25s opacity linear;
  }
}
</style>