import test from 'node:test';
import assert from 'node:assert/strict';
import {answer} from '../lib/assistant.mjs';

const local={env:{}};
const examples={
 streetlight:['The streetlight has stopped working','The street light is broken','The street lamp is broken','எங்க தெருவில் இரண்டு வாரமாக தெருவிளக்கு எரியவில்லை.','हमारी गली की स्ट्रीट लाइट दो हफ्ते से खराब है।'],
 aadhaar:['My Aadhaar biometrics do not match','How do I link my mobile number to Aadhaar?','Find an active Aadhaar enrolment centre','ஆதாரில் மொபைல் எண் மாற்ற வேண்டும்','आधार में मोबाइल नंबर बदलना है'],
 voter:['I moved house and need Form 8 for my voter ID','My EPIC delivery is delayed','How do I register to vote?'],
 ration:['Add a new family member to my ration card','I need to split my ration card','My NFSA inclusion was refused because of income eligibility'],
 caste:['I need a caste certificate for admission','My community certificate is delayed due to lineage verification'],
 legal_heir:['How do I get a legal heir certificate after my father died?','I need a succession certificate to claim assets','I need a legal heir certificate using the death certificate as proof'],
 residence:['How do I get a domicile certificate?','I need an official document proving where I live','I need a residence certificate using my birth certificate as proof'],
 transport:['How do I book a driving test slot?','I need to transfer the RC for a vehicle','Remove hypothecation from my RC','Update the address on my vehicle registration certificate'],
 land:['How do I obtain an encumbrance certificate?','I need a Patta transfer','My Khata land records do not match the survey records','How do I get a copy of my ROR?'],
 building:['My building plan approval is delayed','How do I get an occupancy certificate?','My building plan approval is delayed by fire and water NOCs'],
 pension:['Apply for an old age pension','My widow pension has stopped','I need a disability pension','My pension needs Aadhaar seeding in my bank account','How do I submit Jeevan Pramaan?'],
 waste:['Door-to-door waste collection was missed','There is roadside garbage dumping','எங்க குப்பை எடுக்க வரல','हमारी गली में कचरा जमा है'],
 sewer:['The sewer is overflowing','There is a missing manhole cover','சாக்கடை அடைப்பு ஏற்பட்டுள்ளது'],
 road:['There are potholes on our road','The road has an unpaved trench','The street was dug up and not repaired','Our street is broken','சாலையில் பெரிய குழி உள்ளது'],
 encroachment:['Vehicles are illegally parked on the footpath','A shop has encroached on the pavement'],
 animals:['Stray cattle are blocking our street','Stray dogs are biting people in the neighbourhood'],
 power:['The voltage keeps fluctuating','The transformer has blown','மின்சாரம் வரவில்லை'],
 water:['The tap water is contaminated','Our taps have low pressure','தண்ணீர் வரவில்லை','paani nahi aa raha'],
 mosquito:['Mosquitoes are breeding in stagnant drains','There is a mosquito breeding problem near my home'],
 pollution:['Construction dust is entering our homes','The building site is violating noise limits']
};
for(const [subject,requests] of Object.entries(examples))for(const text of requests)test('Route: '+text,async()=>{
 const r=await answer({text},local);assert.equal(r.subject,subject);assert.notEqual(r.intent,'UNKNOWN');
});

test('Ambiguous requests offer the replacement categories without guessing',async()=>{
 const r=await answer({text:'There is a problem outside my house'},local);
 assert.equal(r.intent,'UNKNOWN');assert.equal(r.locationOptions,undefined);assert.equal(r.clarificationChoices.length,20);
});

test('Multiple active problems offer only the relevant choices',async()=>{
 for(const [text,expected] of [
  ['The road has potholes and garbage is piling up',['road','waste']],
  ['The sewer is overflowing and the voltage keeps fluctuating',['power','sewer']],
  ['I need an Aadhaar correction and a ration card',['aadhaar','ration']],
  ['The road has potholes and the street lights are broken',['road','streetlight']]
 ]){
  const r=await answer({text},local);assert.equal(r.intent,'UNKNOWN',text);assert.deepEqual(r.clarificationChoices.map(c=>c.id).sort(),expected);
 }
});

test('Removed and unsupported standalone topics request clarification',async()=>{
 for(const text of ['Birth certificate','Death certificate','Income certificate','Property tax','How do I renew my passport?'])assert.equal((await answer({text},local)).intent,'UNKNOWN',text);
});

test('Negated or resolved issues are not treated as active complaints',async()=>{
 for(const text of ['There is no problem with garbage collection','The road is already repaired','I do not need a caste certificate'])assert.equal((await answer({text},local)).intent,'UNKNOWN',text);
});


test('Related evidence and separate requested actions remain distinct',async()=>{
 const pension=await answer({text:'ஓய்வூதியத்துக்கு ஆதார் வங்கிக் கணக்குடன் இணைக்க வேண்டும்'},local);
 assert.equal(pension.subject,'pension');
 const separate=await answer({text:'My pension needs Aadhaar seeding and I also need to update my Aadhaar mobile number'},local);
 assert.equal(separate.intent,'UNKNOWN');
 assert.deepEqual(separate.clarificationChoices.map(c=>c.id).sort(),['aadhaar','pension']);
 const voter=await answer({text:'Voter ID registration'},local);
 assert.equal(voter.subject,'voter');
});

test('Sanitation context distinguishes contamination, mosquitoes and blocked sewers',async()=>{
 assert.equal((await answer({text:'Sewage is mixed with our drinking water'},local)).subject,'water');
 assert.equal((await answer({text:'Drinking water is contaminated with sewage'},local)).subject,'water');
 assert.equal((await answer({text:'There are no mosquitoes, but the drain is blocked'},local)).subject,'sewer');
 const separate=await answer({text:'There are mosquitoes and the sewer is overflowing'},local);
 assert.equal(separate.intent,'UNKNOWN');
 assert.deepEqual(separate.clarificationChoices.map(c=>c.id).sort(),['mosquito','sewer']);
});
