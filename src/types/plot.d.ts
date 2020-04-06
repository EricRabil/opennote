declare module "function-plot/lib/index.js" {
    import d3 from "d3";
    import events from "events";

    interface PlotData {
        title?: string;
        skipTip?: boolean;
        range?: [number, number];
        nSamples?: number;
        graphType?: 'interval' | 'polyline' | 'scatter';
        fnType?: 'linear' | 'parametric' | 'implicit' | 'polar' | 'points' | 'vector';
        sampler?: 'interval' | 'builtIn' | 'mathjs';
        color?: string;
        attr?: any;
        fn: string;
        step?: number;
        scope: any;
    }

    interface Chart extends events.EventEmitter {
        id: string;
        linkedGraphs: Chart[];
        options: PlotOptions;
        root: d3.Selection<d3.BaseType, any, any, any>;
        canvas: d3.Selection<d3.BaseType, any, any, any>;
        tip: {
            show(): void;
            hide(): void;
            move(coords: any): void;
        };
        meta: any;
        setUpEventListeners(): void;
        build(): this;
        internalVars(): void;
        drawGraphWrapper(): void;
        initializeAxes(): [number, number];
        buildTitle(): void;
        buildLegend(): void;
        buildClip(): void;
        buildAxis(): void;
        buildAxisLabel(): void;
        buildContent(): void;
        buildZoomHelper(): void;
        setUpPlugins(): void;
        addLink(): void;
        updateAxes(): void;
        syncOptions(): void;
        programmaticZoom(xDomain: any, yDomain: any): void;
        getFontSize(): number;
        draw(): void;
    }

    interface PlotOptions {
        target: string | Node;
        title?: string;
        xAxis?: {
            type?: string;
            domain: number[];
            invert?: boolean;
            label?: string;
        };
        yAxis?: {
            type?: string;
            domain: number[];
            invert?: boolean;
            label?: string;
        };
        width?: number;
        height?: number;
        disableZoom?: boolean;
        grid?: boolean;
        tip?: {
            xLine?: boolean;
            yLine?: boolean;
            renderer?: (x: number, y: number) => string;
        };
        annotations?: Array<{
            x: number;
            y: number;
            text: string;
        }>;
        data: PlotData[];
        plugins?: any[];
    }

    function functionPlot(options: PlotOptions): Chart;
    export = functionPlot;
}