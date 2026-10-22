# Architecture

A dependency-free Node 24 server serves a centered VIN entry and a separate generated report.

- `server.js`: loopback-only HTTP server, public-asset allowlist, `/api/research`, 50-entry/15-minute in-memory cache, maximum three active uncached lookups.
- `lib/research.js`: vPIC decoding followed by concurrent recalls, complaints, safety ratings, and fuel-economy providers. Decode failure returns 502; independent provider errors preserve other data.
- `lib/enrichment.js`: EPA menu/configuration lookup, NHTSA variant/detail lookup, source identity checks, MPG/MPGe and star-rating normalization. Up to three detail requests per provider, 12 variants/configurations retained, and a 28-second provider deadline. EPA considers up to four matching model labels.
- `public/domain.js`: VIN format/check-digit handling.
- `public/app.js`: cancellable search; report rendering; expandable source records; VIN-prefilled CARFAX link; clipboard/manual VIN-copy fallback for external checks. Source text is escaped before HTML insertion.

The UI sends only the VIN. The API additionally accepts an optional model year. Decoded year/make/model drive all secondary lookups. No guessed configuration is assigned to the VIN; EPA and safety variants are explicitly model/configuration matches. The report preserves every source’s retrieval time and availability state.

A decode request has an 18-second timeout; subsequent providers run in parallel. Individual enrichment requests time out after 10 seconds within their shared 28-second deadline. The browser waits at most 60 seconds. Cancellation aborts the browser request; an already-started server lookup may complete in the background.

Only reports whose providers are all available or explicitly outside coverage enter the cache. Partial and unavailable sources remain retryable. Complete empty matches can be cached. All recall campaigns and the first 50 complaint excerpts are retained with the returned complaint count.

## Boundaries

No sample data, seller records, uploads, notebook persistence or provider purchases. Old browser saves are untouched. The app never fetches paid history; it provides official provider links and the current VIN. CARFAX prefill was verified; NICB/NMVTIS use copy-and-paste instead of invented query parameters.

The server is local-use only. Responses are parsed in memory; there is no upstream streaming payload cap. Public deployment needs payload limits, per-client quotas, a deliberate cache/privacy policy, and deployment controls. Static files and outbound endpoint families are fixed; user-supplied URLs are not fetched.

The default screen palette is dark. Screen, offline HTML, and print share `public/styles.css` and the report markup. Print switches to a light paper palette with matching hierarchy, record panels, source citations, margins, and page numbers. Browser `beforeprint`/`afterprint` events expand every retrieved record and restore the screen's disclosure state and title afterward. Print CSS also exposes collapsed content in the script-free HTML download.

Save HTML clones the current report, expands its details, removes interactive controls, and embeds the stylesheet in a downloadable Blob. It requires no scripts, fonts, network connection, or app server to read; provider links still require internet access. A failed stylesheet request is reported with a retry option. Neither export re-fetches vehicle data or removes coverage limits. See [source contracts and limits](sources.md).
