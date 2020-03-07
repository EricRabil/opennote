<template>
  <div class="calculator-root">
    <div class="calculator-fields">
      <math-field
        v-for="(item, index) of items"
        :key="`field-${index}`"
        :value="item.value"
        :renderFormat="item.renderFormat"
        @get:components="$event(mathFields())"
        @insert="insert(index)"
        @focused="current = index"
        @upOutOf="navigatePrevious"
        @navigatePrevious="navigatePrevious"
        @downOutOf="navigateNext"
        @navigateNext="navigateNext"
        @deleteOutOf="remove"
        ref="fields"
      ></math-field>
    </div>
    <div class="calculator-graph">
      <graph :visible="true" :fn="functions"></graph>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import MathField from "@/components/MathField.vue";
import Graph from "@/components/Graph.vue";
import { API } from "@editorjs/editorjs";

type FieldData = ReturnType<MathField['serialized']>;

interface SavedData {
  fields: FieldData[];
}

const generateBlankFieldData: () => FieldData = () => ({value: "", renderFormat: "dec"});

@Component({
  components: {
    MathField,
    Graph
  }
})
export default class CalculatorTool extends Vue {
  $refs: {
    fields: MathField[];
  }

  isMounted: boolean = false;

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

  async mounted() {
    this.$on("preload", () => {
      this.$emit("setSave", () => this.serialized());
      this.$emit("setIgnoreBackspace", () => !(this.current === 0 && !this.currentField.latex));

      this.$emit("ready");
    });

    this.$watch("current", current => {
      console.debug(`New math field selected in calculator`, {
        current
      });
    });

    if (this.savedData && this.savedData.fields && this.savedData.fields.length > 0) {
      this.items.splice(0);
      this.items.push(...this.savedData.fields);
    }

    await this.$nextTick();

    this.isMounted = true;
  }

  serialized(): SavedData {
    return {
      fields: this.mathFields().map(field => field.serialized())
    }
  }

  async insert() {
    this.items.splice(this.current + 1, 0, generateBlankFieldData());
    await this.$nextTick();
    this.navigateNext();
  }

  async remove() {
    this.items.splice(this.current, 1);
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
    let next = fields[index];
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
      const difference = Math.abs((this.items.length - 1) - index);
      for (let i = 0; i < difference; i++) {
        this.items.push(generateBlankFieldData());
      }
      await this.$nextTick();
      return this.navigateTo(index);
    }
    next.mathField.focus();
  }

  mathFields(): MathField[] {
    return this.$children.filter(c => c instanceof MathField).sort((a, b) => {
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
  grid-template-columns: 250px 1fr;
  min-height: 300px;
  border-radius: 5px;
  overflow: hidden;

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