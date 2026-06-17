declare module "plotly.js-dist-min" {
  import type { PlotlyHTMLElement } from "plotly.js";
  const Plotly: {
    newPlot: (
      root: HTMLElement,
      data: unknown,
      layout?: unknown,
      config?: unknown,
    ) => Promise<PlotlyHTMLElement>;
    react: (
      root: HTMLElement,
      data: unknown,
      layout?: unknown,
      config?: unknown,
    ) => Promise<PlotlyHTMLElement>;
    redraw: (root: HTMLElement) => Promise<PlotlyHTMLElement>;
    purge: (root: HTMLElement) => void;
  };
  export default Plotly;
}
