import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Every page is prerendered at build time (no ISR/revalidation), so serve them straight from
// Workers static assets instead of rendering per request — keeps CPU per request well under the
// Workers Free 10 ms limit. deploy/preview populate this cache.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
