global.document = {
  documentElement: {
    style: {
      setProperty: () => {}
    }
  },
  getElementById: () => ({
    classList: {
      add: () => {},
      remove: () => {}
    },
    addEventListener: () => {}
  }),
  addEventListener: () => {},
  createElement: (tag) => ({ tagName: tag.toUpperCase(), className: '', textContent: '', innerHTML: '', appendChild(){}, append(){}, setAttribute(){}, dataset:{} })
};

global.window = {
  addEventListener: () => {},
  createElement: (tag) => ({ tagName: tag.toUpperCase(), className: '', textContent: '', innerHTML: '', appendChild(){}, append(){}, setAttribute(){}, dataset:{} })
};

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  clear: () => {}
};

global.clearTimeout = () => {};
global.setTimeout = () => {};
