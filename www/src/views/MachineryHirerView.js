import { MachineryMarketplaceView } from "./MachineryMarketplaceView.js";
export const MachineryHirerView = {
  async render() { return MachineryMarketplaceView.render(); },
  async init() { return MachineryMarketplaceView.init(document); }
};
