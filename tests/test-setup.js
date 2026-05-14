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
  addEventListener: () => {}
};

global.window = {
  addEventListener: () => {}
};

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  clear: () => {}
};

global.clearTimeout = () => {};
global.setTimeout = () => {};
