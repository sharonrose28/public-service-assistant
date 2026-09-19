// Place hints narrow the directory; they never confirm jurisdiction or utility ownership.
const places = [
 ['chennai', 'tn', /\bchennai\b|சென்னை|चेन्नई/i],
 ['coimbatore', 'tn', /\b(?:coimbatore|kovai)\b|கோவை|கோயம்புத்தூர்|कोयंबटूर/i],
 ['madurai', 'tn', /\bmadurai\b|மதுரை|मदुरै/i],
 ['salem', 'tn', /\bsalem\b|சேலம்|सेलम/i],
 ['tiruppur', 'tn', /\btiru?ppur\b|திருப்பூர்/i],
 ['tiruchirappalli', 'tn', /\b(?:trichy|tiruchirappalli)\b|திருச்சி/i],
 ['avadi', 'tn', /\bavadi\b|ஆவடி/i],
 ['tambaram', 'tn', /\btambaram\b|தாம்பரம்/i],
 ['bengaluru', 'ka', /\b(?:bengaluru|bangalore)\b|பெங்களூரு|बेंगलुरु|ಬೆಂಗಳೂರು/i],
 ['delhi', 'dl', /\bdelhi\b|தில்லி|டெல்லி|दिल्ली/i],
 ['mumbai', 'mh', /\bmumbai\b|மும்பை|मुंबई/i],
 ['pune', 'mh', /\bpune\b|புனே|पुणे/i],
 ['hyderabad', 'tg', /\bhyderabad\b|ஹைதராபாத்|हैदराबाद|హైదరాబాద్/i]
];

export const channelId = record => record.id || `${record.jurisdictionId}:${record.category}`;
export const needsCoverageConfirmation = record => Boolean(record.cityId || record.serviceScope || record.stateIds?.length);

export function placeHints(raw, reportedLocation = '') {
 // A citizen's explicit correction takes precedence over an extracted location.
 const text = raw.location!==undefined ? raw.location.trim() : reportedLocation || raw.text || '';
 return places.filter(([, , pattern]) => pattern.test(text)).map(([cityId, stateId]) => ({cityId, stateId}));
}

export function routeAuthorities(records, raw, reportedLocation = '', civic = true) {
 const hints = placeHints(raw, reportedLocation);
 const locationConflict=Boolean(raw.stateId&&hints.length&&hints.every(hint=>hint.stateId!==raw.stateId));
 const matches = records.filter(record => !(locationConflict&&(record.stateId||record.stateIds?.length||record.cityId))).filter(record => !record.cityId || !hints.length || hints.some(hint => hint.cityId === record.cityId && (!record.stateId || hint.stateId === record.stateId)));
 const chosen = civic&&matches.find(record => channelId(record) === raw.authorityId && needsCoverageConfirmation(record));
 return {records: matches, hints, confirmedId: chosen ? channelId(chosen) : null, locationConflict};
}
