/**
 * main.js
 * App entry point. Loaded last, after config.js, storage.js, state.js,
 * and ui.js are all in place.
 */
(async function bootstrap() {
  await loadState();
  applyTheme();
  render();
})();
