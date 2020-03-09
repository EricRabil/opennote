<template>
  <div ref="graph" v-show="visible">
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import plot from "function-plot/lib/index.js";
import _ from '../util';

type Chart = ReturnType<typeof plot>;
type NoUndefinedField<T> = { [P in keyof T]-?: NoUndefinedField<NonNullable<T[P]>> };
declare const d3: any;

export const GRAPH_DEFAULTS = {
  step: 1 / 25,
  x: [-10, 10],
  y: [-10, 10]
}

function arrayIsEqual<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item, idx) => arr2[idx] === item);
}

function ensureArray<T>(item: T | T[]): T[] {
  return Array.isArray(item) ? item : [item];
}

function stripEmpty<T>(item: T[]): T[] {
  return item.filter(i => !!i);
}

@Component
export default class Graph extends Vue {
  $refs: {
    graph: HTMLDivElement
  };

  lastFn: string[] = [];

  @Prop({ default: () => [NaN, NaN]})
  xDomain: [number, number];

  @Prop({ default: () => [NaN, NaN]})
  yDomain: [number, number];

  @Prop({ default: () => NaN })
  step: number;

  @Prop({ default: NaN })
  height: number;

  @Prop()
  fn: Function | Function[];

  @Prop({ default: true })
  visible: boolean;

  @Prop({ default: true })
  updateOnFnUpdate: boolean;

  @Prop({ default: false })
  frozen: boolean;

  failed: boolean = false;
  chart: Chart | null;

  /**
   * Set up listeners
   */
  created() {
    this.$watch('failed', didFail => {
      this.$emit('fail-state-change', didFail);
      if (didFail) {
        this.teardownGraph();
      }
    });

    this.$watch('visible', isVisible => {
      if (isVisible) {
        this.updateGraph();
      } else {
        this.teardownGraph();
      }
    });

    this.$watch('frozen', isFrozen => {
      if (!isFrozen) {
        this.updateGraph();
      }
    })

    this.$watch('updateOnFnUpdate', shouldUpdate => {
      if (shouldUpdate && this.visible) {
        this.updateGraph();
      }
    })

    this.$watch('fn', (fn, oFn) => {
      if (!this.updateOnFnUpdate) return;
      if (!this.visible) return;
      if (fn) {
        this.updateGraph();
      } else {
        this.teardownGraph();
      }
    });

    // These events unconditionally trigger a graph update
    this.$watch('xDomain', () => this.updateGraph());
    this.$watch('yDomain', () => this.updateGraph());
    this.$watch('step', () => this.updateGraph());
    this.$watch('height', () => this.updateGraph());
    this.$on(['resize', 'update'], () => this.updateGraph());
  }

  mounted() {
    this.updateGraph();
  }

  /**
   * Update graph on render
   */
  rendered() {
    if (!this.canUpdate) return;
    this.updateGraph();
  }

  /**
   * Returns true if and only if visible==true and fn!==null
   */
  get canUpdate() {
    return this.visible && this.fn;
  }

  /**
   * Rebuilds the graph
   */
  updateGraph() {
    const originals: string[] = stripEmpty(ensureArray(this.fn).map(fn => (fn as any).original));
    if (arrayIsEqual(originals, this.lastFn)) return;
    if (this.frozen) return;
    if (!this.fn || !this.visible) return;
    if (this.chart) this.teardownGraph();

    console.log('updating with changes', JSON.stringify({ originals, last: this.lastFn }, undefined, 4));

    this.lastFn = originals;
    this.failed = false;

    try {
      const graph = this.$refs.graph;
      const bounds = this.computedBounds;
      const step = this.stepWithOverride;
      const width = +getComputedStyle(this.$el.parentElement || this.$el).width!.split('px')[0];
      const height = this.height || +getComputedStyle(graph.parentElement!).height!.split('px')[0];
      
      if (!bounds) return;

      this.chart = _.Graph.createGraph(graph, step, bounds, this.fn, { width, height });
    } catch (e) {
      console.debug("couldn't update graph :(", e);
      this.failed = true;
    }
  }

  /**
   * Destroys and removes the graph from DOM
   */
  teardownGraph() {
    if (!this.chart) return;

    this.chart.root.remove();
    this.chart = null;
  }

  /**
   * Calculates the min/max y-values of the function given the current step and x-bounds
   */
  minMaxY() {
    let fn = this.fn;
    if (!Array.isArray(fn)) fn = [fn];
    const bounds = fn.map(fn => _.MathKit.minMaxOfFn(fn, this.stepWithOverride, ...this.xBoundsWithOverrides));
    const [ lowerBound ] = bounds.map(([lower]) => lower).sort();
    const [ upperBound ] = bounds.map(([,upper]) => upper).sort().reverse();
    return [ lowerBound, upperBound ] as [number, number];
  }

  /**
   * Returns definite step for the graph, taking into account step overrides
   */
  get stepWithOverride() {
    return this.step || GRAPH_DEFAULTS.step
  }

  /**
   * Returns definite x-bounds for the graph, taking into account x overrides
   */
  get xBoundsWithOverrides() {
    const range = this.xDomain
      .map(i => (typeof i === "number" ? i : NaN))
      .map((i, idx) => (isNaN(i) ? GRAPH_DEFAULTS.x[idx] : i)) as [
      number,
      number
    ];

    if (range.length < 2 || (range[0] === range[1])) return [-10, 10] as [number, number];

    return range;
  }

  /**
   * Returns definite y-bounds for the graph, taking into account x and y overrides
   */
  get yBoundsWithOverrides(): [number, number] {
    if (!this.fn) return GRAPH_DEFAULTS.y as [number, number];
    let yDomain = this.yDomain.map(i => (typeof i === "number" ? i : NaN)) as [number, number];
    const bounds = this.minMaxY();

    if (yDomain.some(i => isNaN(i))) {
      yDomain = yDomain.map((i, idx) => (isNaN(i) ? bounds[idx] : i)) as [
        number,
        number
      ];
    }
    
    yDomain.sort((a, b) => a - b);

    if (yDomain.length < 2 || (yDomain[0] === yDomain[1])) return this.minMaxY();

    return yDomain;
  }

  /**
   * Recalculates the bounds of the graph
   */
  get computedBounds() {
    if (!this.fn) return null;

    const xDomain = this.xBoundsWithOverrides;
    const yDomain = this.yBoundsWithOverrides!;

    return {
      xDomain,
      yDomain
    };
  }
}
</script>