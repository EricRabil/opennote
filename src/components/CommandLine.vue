<template>
  <div class='tool-suggestion-container' :style="positioning">
    <span v-for="(suggestion, idx) in possible" :key="suggestion" @click="selectSuggestion(suggestion)" :class='{"tool-suggestion": true, "active": index === idx}'>{{suggestion}}</span>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class CommandLine extends Vue {
  @Prop()
  initialPossible: string[];

  @Prop()
  basis: HTMLElement;

  activeIndex: number = 0;
  lazyReposition = () => requestAnimationFrame(() => this.updatePositioning());

  possible: string[] = [];
  positioning = {
    top: '0px',
    left: '0px'
  }

  mounted() {
    this.$watch('possible', (newPossibilities: string[], oldPossibilities: string[]) => {
      if ((newPossibilities.length === oldPossibilities.length) && newPossibilities.every((pos, idx) => oldPossibilities[idx] === pos)) return;
      this.activeIndex = 0;
      this.updatePositioning();
    });

    this.possible = this.initialPossible;

    this.$on('update', (possible: string[]) => this.possible = possible);
    this.$on('tab', (event: KeyboardEvent) => {
      if (event.shiftKey) {
        if (this.activeIndex === 0) this.activeIndex = this.possible.length - 1;
        else this.activeIndex--;
      }
      else this.activeIndex++;
    });
    this.$on('enter', (event: KeyboardEvent) => {
      this.selectSuggestion(this.possible[this.index]);
    });
    this.$on('destroy', () => {
      this.delete();
    });

    setTimeout(() => this.updatePositioning());

    this.redactor.addEventListener('scroll', this.lazyReposition);
    this.redactor.addEventListener('resize', this.lazyReposition);
    window.addEventListener('resize', this.lazyReposition);
  }

  get index() {
    return this.activeIndex % this.possible.length;
  }

  delete() {
    this.$destroy();
    this.$el.parentNode!.removeChild(this.$el);
  }

  destroyed() {
    this.redactor.removeEventListener('scroll', this.lazyReposition);
    this.redactor.removeEventListener('resize', this.lazyReposition);
    window.addEventListener('resize', this.lazyReposition);
  }

  get redactor() {
    return document.querySelector('.editor-container')!;
  }

  isUpdating = false;

  updatePositioning() {
    if (this.isUpdating) return;
    if (!this.possible || !this.$el.parentElement) return;
    this.isUpdating = true;

    const getPxStyle = (style: string) => parseFloat((getComputedStyle(this.$el) as any)[style].split('px')[0]);
    const selection = window.getSelection()!;
    if (selection.rangeCount === 0) return this.delete();
    const range = selection.getRangeAt(0).cloneRange();
    range.collapse(true);

    // get the width of the text itself
    const textRange = document.createRange();
    const node = this.basis.childNodes[0];
    textRange.selectNodeContents(node);
    const width = textRange.getClientRects()[0].width;

    // get the px units that the paragraph element is from the left
    const leftOffset = this.basis.getClientRects()[0].left;

    // combine the two, and that will always put the suggestions at the end of the text content
    const left = (width + leftOffset) + 'px';

    // get the line height
    const offset = (getPxStyle('lineHeight'));

    // calculate the top as (the distance from the top of the element) + (top padding) + (line height)
    const top = (this.basis.getBoundingClientRect().top + getPxStyle('padding-top') + offset) + 'px';

    this.positioning = {
      top,
      left
    }

    this.isUpdating = false;
  }

  selectSuggestion(suggestion: string) {
    this.$emit('select', suggestion);
  }
}
</script>

<style lang="scss">
.tool-suggestion-container {
  position: absolute;
}
</style>