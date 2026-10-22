# Car Research

Enter a VIN to retrieve real vehicle specifications, recalls, complaints, and safety ratings from NHTSA, plus fuel-economy estimates from EPA / DOE. U.S. vehicles, 1981 onward. No accounts, API keys, runtime dependencies, or build step.

## Try it

Use **Node.js 24** (see `.node-version`):

```sh
npm start
```

Open **http://127.0.0.1:8000** and enter a VIN in the centered field. Press Enter or the arrow to generate a report. The search screen is replaced by the report; expand recalls or complaints to read the records. **New lookup** returns to the field. `npm run dev` restarts the server on source changes. To use another port: `PORT=8001 npm start`. The server binds to loopback only. Stop it with Ctrl+C.

## What it does

- Validates the VIN and displays check-digit/decoder warnings.
- Retrieves vehicle identity and available specifications through NHTSA vPIC.
- Retrieves NHTSA model recall campaigns, owner complaint excerpts, and crash/rollover ratings, with source links and retrieval timestamps.
- Retrieves EPA model configurations with city/highway/combined MPG or MPGe, fuel type, powertrain details, and available electric range/electricity use. No configuration is silently assigned to the VIN.
- Separates source outages, missing fields, and zero matches. Failed lookups do not display an old report under a new VIN.
- Provides a VIN-prefilled CARFAX link and Copy VIN for NICB, NMVTIS providers, and the NHTSA VIN recall tool. These external results are not imported; CARFAX reports are paid, and NMVTIS provider fees vary.
- Uses a dark theme with a focused VIN entry and a styled, expandable report.
- **Print / Save PDF** opens the browser print dialog with a paper-friendly version of the same report layout, automatic record expansion, and page numbers. Choose Save as PDF to export it. **Save HTML** downloads a self-contained dark report that opens offline.

Recall and complaint records match the **year/make/model**. They do not establish this particular VIN’s defects or unrepaired recalls. Complaints are allegations, not confirmed defects or failure rates. All returned recall campaigns are retained; only the first 50 complaint excerpts are shown, with the total returned count disclosed.

**Service, title, accident, and theft history are not automatically retrieved.** There is no demo, seller-data entry, notebook, import, or browser-save workflow. Missing history remains unknown.

## Data handling

The local server sends the VIN to NHTSA vPIC, then the decoded year/make/model to NHTSA safety APIs and EPA / DOE fuel-economy APIs. It caches up to 50 fully successful responses in memory for 15 minutes, preserving retrieval timestamps. The server does not write reports to disk or log query URLs. HTML downloads and PDF saves are initiated in your browser. Both include all retrieved records, source links, timestamps, and coverage limits, even when sections are collapsed on screen. External history services are accessed only when their links are opened; CARFAX receives the VIN in that link. The clipboard action copies only the current report’s VIN.

The current app does not access browser storage. Any notebook saves made with the earlier prototype remain untouched in that browser profile; the simplified app neither reads nor deletes them.

## Validation

```sh
npm run check
```

Runs syntax checks and Node tests with mocked upstream requests. HTTP tests need permission to bind loopback ports. GitHub Actions runs the same command; hosted CI is unverified until pushed.

See [validation](docs/validation.md), [product plan](docs/plan.md), [sources](docs/sources.md), and [architecture](docs/architecture.md).

Code uses the existing [Apache-2.0 license](LICENSE). Third-party content retains its applicable terms.
