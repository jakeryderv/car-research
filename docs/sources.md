# Data sources and access

Verified September 12, 2026. The application retrieves free public data automatically, then provides VIN-oriented external history checks. These are distinct access modes; following a link does not import its results.

## Integrated free data

| Provider | Data | Matching and limits |
| --- | --- | --- |
| [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) | Original vehicle specifications | VIN decoding. Missing fields are unknown, not absent equipment. Decoder warnings remain visible. |
| [NHTSA recall API](https://www.nhtsa.gov/nhtsa-datasets-and-apis) | Recall campaigns | Decoded year/make/model. Does not establish VIN-specific applicability or completed repairs. |
| [NHTSA complaint API](https://www.nhtsa.gov/nhtsa-datasets-and-apis) | Owner complaint narratives | Decoded year/make/model. Allegations, not verified defects. First 50 excerpts retained with the total returned count; not a failure rate. |
| [NHTSA safety ratings](https://www.nhtsa.gov/nhtsa-datasets-and-apis) | Overall, frontal, side, rollover, and front driver/passenger star ratings where supplied | Retrieve tested model variants, then each variant’s ratings. No variant is automatically assigned to the VIN. “Not Rated,” zero, absent, and invalid ratings remain unrated. Up to 12 variants. |
| [EPA / DOE FuelEconomy.gov](https://www.fueleconomy.gov/feg/ws/index.shtml) | City/highway/combined fuel economy, fuel type, engine/motor, transmission, drive, electric range and electricity use where supplied | 1984 onward. Year/make/model configuration matching, not a VIN service. Up to 4 model names and 12 configurations. Gasoline/diesel use MPG; electricity and CNG use MPGe. PHEV fuels are shown separately. Estimates are not the car’s measured economy. |

EPA menus are traversed using their returned values. Make names must match after case/punctuation normalization. Exact model labels are preferred; if none exist, explicit model-name extensions are allowed (for example, Model 3 → Model 3 Long Range). Unrelated names are not substituted. Detail responses must match the requested record ID, model year, make, and selected model. Candidate configurations remain labeled as such even if there is only one. Known VIN engine/drivetrain fields are not currently used to rank or filter them.

NHTSA variant details are checked against their requested ID/year/make/model. Individual detail failures preserve successfully retrieved records and show a partial status. Each enrichment provider has a shared 28-second deadline and at most three detail requests in flight. Caps and partial/empty results are disclosed.

## External history checks

| Provider | Information to investigate | Link behavior |
| --- | --- | --- |
| [CARFAX](https://www.carfax.com/vehicle-history-reports/) | Reported accidents, service, mileage, ownership and usage/history | `https://www.carfax.com/vehicle-history-reports/?vin={VIN}` prefilled the VIN in the live browser verification. User proceeds on CARFAX; reports are paid. No purchase or report scraping by this app. CARFAX contains only information reported to it and is not comprehensive. |
| [NICB VINCheck](https://www.nicb.org/vincheck) | Participating-insurer theft and salvage indicators | Official lookup plus the app’s Copy VIN action. No supported prefill was established; automated browser inspection met a site challenge. The app does not bypass it. Free consumer lookup, five checks per IP per day, incomplete coverage. |
| [NMVTIS approved providers](https://vehiclehistory.bja.ojp.gov/nmvtis_vehiclehistory) | Title brands, reported odometer readings, total loss, salvage/junk history | Official provider directory plus Copy VIN. User selects a provider and pastes the VIN; provider fees and terms vary. The directory is not a report endpoint. NMVTIS does not supply service history. |
| [NHTSA VIN recall tool](https://www.nhtsa.gov/recalls) | Unrepaired recalls for this individual VIN | Official lookup plus Copy VIN. Coverage can omit older recalls, completed repairs and some manufacturers. |

The report displays the current VIN beside a copy button. If clipboard access fails, it selects the VIN text for manual copying. CARFAX receives the VIN when its link is opened; other services receive it only if the user pastes/submits it. No provider results are marked verified just because a link was opened.

## Endpoint families

```text
https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json
https://api.nhtsa.gov/recalls/recallsByVehicle?make=...&model=...&modelYear=...
https://api.nhtsa.gov/complaints/complaintsByVehicle?make=...&model=...&modelYear=...
https://api.nhtsa.gov/SafetyRatings/modelyear/{year}/make/{make}/model/{model}?format=json
https://api.nhtsa.gov/SafetyRatings/VehicleId/{id}?format=json
https://www.fueleconomy.gov/ws/rest/vehicle/menu/make?year=...
https://www.fueleconomy.gov/ws/rest/vehicle/menu/model?year=...&make=...
https://www.fueleconomy.gov/ws/rest/vehicle/menu/options?year=...&make=...&model=...
https://www.fueleconomy.gov/ws/rest/vehicle/{id}
```

JSON is requested with `Accept: application/json`. [NHTSA API use policy](https://api.nhtsa.gov/) applies; this is an interactive lookup tool, not a bulk VIN harvester.

Statuses: retrieved (possibly zero matches), partial, unavailable, not checked, and outside coverage. No source failure or empty response implies a clean history. No fictional dataset, manual notebook, paid-history integration, investigations feed, or manufacturer-communications feed is included.
