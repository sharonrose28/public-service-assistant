export function extractCivicEntities(text){
 const duration=text.match(/(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s+(?:day|week|month|year|hour)s?\b|since\s+(?:yesterday|last\s+(?:night|week|month)|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|(?:இரண்டு|ஒரு|மூன்று|நான்கு|\d+)\s*(?:வார|நாள|மாத|மணி)[\u0B80-\u0BFF]*|நேற்று முதல்|(?:दो|एक|तीन|चार|\d+)\s*(?:हफ्ते|हफ़्ते|सप्ताह|दिन|महीने|घंटे)|कल से/i)?.[0]||'';
 let location=text.match(/\b(?:at|in|near|on)\s+([^.!?\n]+?)(?=\s+(?:for|since|has|is|have|was|stopped|isn't|doesn't)\b|[.!?\n]|$)/i)?.[1]?.trim()||'';
 // Temporal phrases and generic objects are not addresses.
 if(/^(?:the last|last|two|three|\d+|a while|my application|a certificate)\b/i.test(location))location='';
 return {location,duration};
}
