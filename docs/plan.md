# Product plan

## Purpose

“I’m considering buying this used car. Tell me everything useful I can learn from the VIN before I buy it.”

The current product direction is a simple **VIN → real source results** flow. No fictional demo data, manual service notebook, seller-entered claims, or import/export workspace. Automatically retrieved free public records and useful external history checks are the focus. Configuration ambiguity remains explicit; no model fuel or crash-test variant is presented as an exact VIN match.

## Current MVP

1. Enter a VIN in one centered field; no dashboard or report content appears before submission.
2. Retrieve vehicle identity and available specifications from NHTSA vPIC.
3. Replace the search screen with a report: vehicle details, EPA fuel configurations, NHTSA safety-rating variants, recalls/complaints, source links and retrieval times.
4. Show unavailable sources and missing information explicitly.
5. Provide a VIN-prefilled CARFAX link and Copy VIN for official NICB, NMVTIS provider, and NHTSA recall checks. Explain report costs, coverage and which checks are external.

Loading can be canceled; errors keep the input available for retry; New lookup returns to the centered field. The dark report has a matching paper-friendly print/PDF layout and a self-contained HTML download. Both exports include all retrieved records, including collapsed sections, and preserve source links and coverage limits. The application does not retrieve service history or determine whether a car has a clean title, good repair quality, or acceptable mechanical condition.

Acceptance: every vehicle-specific or model-specific record displayed comes from a real source response. A skipped check, empty match, or source failure cannot become a clean-history claim. A failed new lookup cannot leave the previous car’s report visible as its result.

## Next, when source access is ready

| Candidate | Dependency | Acceptance |
| --- | --- | --- |
| More complete safety context | Validate NHTSA investigations/manufacturer communications access | Real records, explicit model applicability and source attribution |
| VIN-specific recall integration | A permitted and supported access method | Actual VIN applicability and repair-status coverage, with limits |
| Title/loss integration | Approved NMVTIS provider, cost and redistribution decision | VIN-level title brands, mileage, loss/salvage events and provenance |
| Service history | Authorized manufacturer/provider access | Actual returned records; supported brands and missing coverage shown clearly |
| Auction/listing history | Reliable source access and reuse permissions | Full-VIN matches with source/date; no claim of exhaustive coverage |
| Known-history evaluation | Appropriate real examples, including rebuilt vehicles | Compare retrievals with known facts; document missed records without publishing owner information |

Future additions should improve real-data coverage while retaining the simple lookup flow. Paid or authenticated integrations require a concrete source/access decision. Manual record entry and document import are outside the current direction.
