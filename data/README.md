# Location database attribution

The India extract in `india-locations.json` is derived from **Countries States Cities Database**, by Darshan Gada and contributors:
https://github.com/dr5hn/countries-states-cities-database

The location database is distributed under **Open Database License (ODbL) 1.0**; the license is reproduced in `LOCATION-DATA-LICENSE.txt`. This attribution and license apply to the location data, independently of the application code. Source release and state commit are recorded inside the JSON. The extracted database is available to app users at `/location-data.json`, and its license at `/location-data-license.txt`.

Imported on 18 September 2026: 36 states/union territories and 4,198 place records. Source records can include cities, towns, localities or districts; this is a community-maintained geographic list, **not an exhaustive official municipal register**. It is not evidence of service eligibility, administrative boundaries or portal coverage. The current UI uses only the state list and does not generate municipal URLs from city names.

Run `node scripts/import-india-locations.mjs` to refresh the source extract. Review changes, counts and tests before publishing. No source code from the data repository is executed by the importer.
