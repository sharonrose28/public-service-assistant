// Intentionally memory-only: drafts and checklist progress disappear when this page closes.
export function createSessionState() {
 const drafts=new Map(), checklists=new Map();
 const boundedSet=(map,key,value)=>{map.delete(key);map.set(key,value);if(map.size>20)map.delete(map.keys().next().value);return value;};
 return {
  openDraft(key, generated, context) {
   const old=drafts.get(key);
   if(old?.dirty)return {...old,preserved:old.context!==context};
   return boundedSet(drafts,key,{text:generated,context,dirty:false,opened:true,preserved:false});
  },
  editDraft(key,text) {const old=drafts.get(key);if(old)boundedSet(drafts,key,{...old,text,dirty:true});},
  resetDraft(key,text,context) {return boundedSet(drafts,key,{text,context,dirty:false,opened:true,preserved:false});},
  draft(key) {return drafts.get(key);},
  checklist(id) {return checklists.get(id)||new Set();},
  check(id,item,checked) {const values=new Set(checklists.get(id));if(checked)values.add(item);else values.delete(item);boundedSet(checklists,id,values);}
 };
}
