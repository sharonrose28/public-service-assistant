import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLocation,locationOptions} from '../lib/locations.mjs';

test('The compatibility location dataset keeps states and cities correctly paired',()=>{
 const options=locationOptions('residence');
 assert.equal(options.length,36);assert.equal(options.reduce((n,s)=>n+s.cities.length,0),4198);
 for(const state of options){
  assert.equal(resolveLocation(state.value).state,state.id);
  for(const city of state.cities){const location=resolveLocation(city.value);assert.equal(location.state,state.id,city.value);assert.equal(location.city,city.id);}
 }
});

test('City aliases and native scripts resolve without becoming service authority claims',()=>{
 for(const [name,state] of [['Tamil Nadu','tn'],['சென்னை','tn'],['चेन्नई','tn'],['Bangalore','ka'],['Mumbai','mh'],['दिल्ली','dl'],['Coimbatore, Tamil Nadu','tn']])assert.equal(resolveLocation(name).state,state);
});

test('Conflicting and unrecognised locations are not guessed',()=>{
 for(const text of ['Mumbai, Tamil Nadu','Chennai and Madurai','Delhi or Mumbai'])assert.equal(resolveLocation(text).status,'ambiguous');
 assert.equal(resolveLocation('Chennaiville').status,'unsupported');assert.equal(resolveLocation('').status,'missing');
});

test('Same city names are disambiguated by state',()=>{
 const options=locationOptions('residence'),seen=new Map();let duplicate;
 for(const state of options)for(const city of state.cities){if(seen.has(city.name)&&seen.get(city.name)!==state.id)duplicate=city.name;seen.set(city.name,state.id);}
 assert.ok(duplicate);
 for(const state of options)for(const city of state.cities.filter(c=>c.name===duplicate))assert.equal(resolveLocation(city.value).state,state.id);
});

test('A missing town can retain its state without claiming a known city',()=>{
 const location=resolveLocation('Example Missing Town, Kerala');
 assert.equal(location.customCity,true);assert.equal(location.city,undefined);assert.equal(location.state,'kl');
});
