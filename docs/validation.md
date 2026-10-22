# Validation

The simplified real-data-only app was checked on September 12, 2026 using Node 24.19.0.

## Automated checks

`npm run check`: **17 tests passed**, zero failed or skipped, plus syntax checks. HTTP tests bind temporary loopback ports and therefore need loopback permission in a restricted sandbox. Upstream responses are mocked for these tests.

Coverage: VIN validation; source provenance; complaint limits; outage/empty states; HTTP/cache behavior; EPA menu formats, multi-configuration matching, identity rejection, older coverage, gasoline/EV/PHEV units; NHTSA variant identity and unrated values; partial provider results.

## Browser verification

The reusable `scripts/browser-smoke.js` checks the centered VIN field, desktop/mobile entry, inline validation, cancellation, transition to a live report, expandable recalls, mobile report layout, New lookup, and error/retry behavior. It requires the app on port 8000, Playwright CLI, and network access:

```sh
playwright-cli -s=car-research open http://127.0.0.1:8000
playwright-cli -s=car-research run-code --filename=scripts/browser-smoke.js
```

The live check uses `1HGCM82633A004352`, which NHTSA decodes as a 2003 Honda Accord. Model recall and complaint matches do not diagnose or establish the history of that specific vehicle. Tests use a simulated error response to exercise outage handling; the application contains no mock or fictional dataset.

The redesigned browser flow passed all thirteen scenarios with no JavaScript page errors. Desktop entry, mobile entry, and the single-column report were also visually inspected. The simulated HTTP 502 produced the expected network console error.

## Expanded live-source checks

- The 2003 Accord lookup returned 24 model recalls, 2,013 complaint records, four EPA configurations, and four NHTSA rating variants. Counts can change. For EPA record 18657 (3.0 L six-cylinder automatic), estimates were 19 city / 27 highway / 22 combined MPG. The app lists all matching configurations; it does not assert that any one is the exact VIN match.
- A separate live 2018 Tesla Model 3 provider check returned four EPA configurations and two safety variants. EPA record 39836 supplied 130 combined MPGe, 310 miles electric range, and electricity consumption. This verifies the EV display data path without inventing a test VIN.
- CARFAX’s public page with `?vin=1HGCM82633A004352` actually prefilled its VIN input in the browser. No report was bought or submitted. NICB browser inspection encountered a site challenge, so its integration uses the official link and Copy VIN.
- Browser smoke checks verify EPA/rating records, CARFAX’s current-VIN URL, and clipboard contents alongside the entry/report flows. Desktop/mobile report screenshots were visually inspected. External histories themselves are not imported or verified.

## Dark theme and report exports

Desktop (1440 px) and mobile (390 px) dark layouts were visually inspected, and all thirteen browser smoke scenarios passed again. The separate export check runs against the live report:

```sh
playwright-cli -s=car-research run-code --filename=scripts/print-smoke.js
```

It verifies default dark styling, VIN-named HTML download, offline styling and complete records, source links, print expansion and restoration, collapsed-record printing in the offline file, and failed-download retry. QA files are written to `/tmp/car-research-report.html` and `/tmp/car-research-report.pdf`.

Chrome generated a Letter-size PDF containing all 82 retrieved records: four fuel configurations, four rating variants, 24 complete recall campaigns, and 50 complaint excerpts. PDF text checks confirmed all 24 remedies and 50 ODI record headings; the excerpt limit remains explicit. Rendered pages were visually checked for text clipping, consistent styling, and page numbers. The report's disclosure states and document title were restored after printing. Expected simulated HTTP 502/503 responses appear as network console errors.

## Limits

Hosted GitHub Actions has not been observed. PDF rendering is verified in Chrome; the operating-system print dialog and other browser print engines are not automated. No title/theft/service integrations are claimed or tested. Existing browser saves from the earlier notebook prototype are left untouched.
