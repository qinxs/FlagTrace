import fs from 'fs';
import * as mmdb from 'mmdb-lib';

// Get a buffer with mmdb database, from file system or whereever.
const db = fs.readFileSync('db/GeoLite2-Country.mmdb');

const reader = new mmdb.Reader() < CityResponse > db;

// inferred type `CityResponse`
console.log(reader.get('66.6.44.4'));
// tuple with inferred type `[CityResponse|null, number]`
console.log(reader.getWithPrefixLength('66.6.44.4'));
