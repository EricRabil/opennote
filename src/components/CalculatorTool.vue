<template>
  <div class="calculator-root" v-resize="handleResize">
    <div class="calculator-fields">
      <math-field
        v-for="(item, index) of items"
        :key="`field-${index}`"
        :value="item.value"
        :renderFormat="item.renderFormat"
        :isInitialReady="isInitialReady"
        @get:components="$event(mathFields())"
        @insert="insert(index)"
        @focused="current = index"
        @upOutOf="navigatePrevious"
        @navigatePrevious="navigatePrevious"
        @downOutOf="navigateNext"
        @navigateNext="navigateNext"
        @deleteOutOf="remove"
        @recalc:start="isInitialReady = false"
        @recalc:complete="isInitialReady = true"
        ref="fields"
      ></math-field>
    </div>
    <div class="calculator-graph" ref="calcContainer">
      <graph :visible="isRendered" :fn="functions" :xDomain="[-10,10]" :yDomain="[-20,20]" :frozen="!isInitialReady" ref="graph"></graph>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import MathField from "@/components/MathField.vue";
import Graph from "@/components/Graph.vue";
import { API } from "@editorjs/editorjs";
import _ from '../util';

type FieldData = ReturnType<MathField["serialized"]>;

interface SavedData {
  fields: FieldData[];
}

const generateBlankFieldData: () => FieldData = () => ({
  value: "",
  renderFormat: "dec"
});

@Component({
  components: {
    MathField,
    Graph
  }
})
export default class CalculatorTool extends Vue {
  $refs: {
    fields: MathField[];
    graph: Graph;
    calcContainer: HTMLDivElement;
  };

  isMounted: boolean = false;
  isRendered: boolean = false;
  isInitialReady: boolean = false;

  @Prop()
  api: API;

  @Prop()
  internal: any;

  @Prop()
  savedData: SavedData;

  items: FieldData[] = [
    {
      value: "",
      renderFormat: "dec"
    }
  ];

  current: number = 0;
  lastWidth: number = NaN;

  async mounted() {
    this.$on("preload", () => {
      this.$emit("setSave", () => this.serialized());
      this.$emit("setIgnoreBackspace", () => !(this.current === 0 && !this.currentField.latex));

      this.$emit("ready");
    });

    this.$on("rendered", () => {
      setTimeout(() => {
        this.isRendered = true;
      });
    });

    this.$watch("current", current => {
      console.debug(`New math field selected in calculator`, {
        current
      });
    });

    if (
      this.savedData &&
      this.savedData.fields &&
      this.savedData.fields.length > 0
    ) {
      this.items.splice(0);
      this.items.push(...this.savedData.fields);
    }

    await this.$nextTick();

    this.isMounted = true;

    setTimeout(() => this.mathFields()[0].updateFields(true), 10);
  }

  serialized(): SavedData {
    return {
      fields: this.mathFields().map(field => field.serialized())
    };
  }

  async insert(atIndex: number = this.current) {
    this.items.splice(atIndex + 1, 0, generateBlankFieldData());
    await this.$nextTick();
    this.navigateNext();
  }

  async remove(atIndex: number = this.current) {
    this.items.splice(atIndex, 1);
    await this.$nextTick();
    this.navigatePrevious();
  }

  navigateNext() {
    this.navigateTo(this.current + 1, true);
  }

  navigatePrevious() {
    this.navigateTo(this.current - 1);
  }

  focusCurrent() {
    this.currentField.mathField.focus();
  }

  handleResize() {
    if (!this.lastWidth) this.lastWidth = this.$el.clientWidth;
    else if (this.lastWidth === this.$el.clientWidth) return;
    else this.lastWidth = this.$el.clientWidth;
    this.$refs.graph.updateGraph();
  }

  get functions() {
    if (!this.isMounted) return [];
    return this.$refs.fields.map(field => field.resultFn).filter(fn => !!fn);
  }

  get currentField() {
    return this.mathFields()[this.current];
  }

  async navigateTo(index: number, force: boolean = false): Promise<void> {
    if (index === -1) {
      // navigate previous (outer)
      this.$emit('navigatePrevious');
      return;
    }

    const fields = this.mathFields();
    let next = fields[index], prev = fields[index - 1];

    if (!next) {
      if (!force) {
        console.debug(
          `Calculator can't navigate because index is out of bounds`,
          {
            current: this.current,
            index,
            fields
          }
        );
        return;
      }

      if (!prev.latex) {
        this.$emit('navigateNext');
        await this.$nextTick();
        console.log('emit and escape!');
        return;
      }

      const difference = Math.abs(this.items.length - 1 - index);
      for (let i = 0; i < difference; i++) {
        this.items.push(generateBlankFieldData());
      }
      await this.$nextTick();
      return this.navigateTo(index);
    }

    if (!_.Dom.isElementVisibleRelativeToParent(next.$el as HTMLElement)) {
      next.$el.scrollIntoView({ block: 'nearest' });
    }
    next.mathField.focus();
  }

  mathFields(): MathField[] {
    return this.$children
      .filter(c => c instanceof MathField)
      .sort((a, b) => {
        if (a === b) return 0;
        if (a.$el.compareDocumentPosition(b.$el) & 2) {
          return 1;
        }
        return -1;
      }) as MathField[];
  }
}
</script>

<style lang="scss">
.calculator-root {
  @extend %bg0;

  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  height: 360px;
  border-radius: 5px;
  overflow: hidden;
  width: 100%;

  & > .calculator-fields {
    @extend %bg1;
    display: grid;
    grid-auto-rows: min-content;
    row-gap: 1px;
  }

  &:not(.big) {
    & > .calculator-fields {
      max-height: 650px;
      overflow-y: scroll;
    }
  }

  & > .calculator-graph {
    @extend %bg2;
  }
}
</style>