// Fetches products from DummyJSON, embeds them, and saves data/catalog.json.
// Optional: the app does this automatically on the first search.
// Run again whenever you change the catalog logic:  npm run catalog
import { rebuildCatalog } from "../lib/catalog";

rebuildCatalog()
  .then((n) => console.log(`Saved ${n} products to data/catalog.json`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
