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

@Component
export default class Graph extends Vue {
  $refs: {
    graph: HTMLDivElement
  };

  @Prop({ default: () => [NaN, NaN]})
  xDomain: [number, number];

  @Prop({ default: () => [NaN, NaN]})
  yDomain: [number, number];

  @Prop({ default: () => NaN })
  step: number;

  @Prop()
  fn: Function;

  @Prop({ default: true })
  visible: boolean;

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

    this.$watch('fn', (fn, oFn) => {
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
    this.$on(['resize', 'update'], () => this.updateGraph());
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
    if (!this.fn || !this.visible) return;
    if (this.chart) this.teardownGraph();
    this.failed = false;

    try {
      const graph = this.$refs.graph;
      const bounds = this.computedBounds;
      const step = this.stepWithOverride;
      const width = +getComputedStyle(this.$el.parentElement || this.$el).width!.split('px')[0];
      const height = +getComputedStyle(graph).height!.split('px')[0];
      
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
    return _.MathKit.minMaxOfFn(this.fn, this.stepWithOverride, ...this.xBoundsWithOverrides);
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