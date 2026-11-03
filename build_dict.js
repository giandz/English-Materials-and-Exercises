/* makes pron-dict.js from cmudict.dict: node build_dict.js cmudict.dict (needs Playwright; run it in the folder with pron-mark.js and house-character.js). Run again whenever the rules in pron-mark.js change: words the rules already get right are left out. */
const { chromium } = require('playwright');const fs=require('fs');
(async()=>{const src=process.argv[2];const raw=new Map();
for(const l of fs.readFileSync(src,'utf8').split('\n')){const m=/^([a-z]+)(?:\(\d+\))? ([^#]+)/.exec(l);if(!m)continue;const p=(m[2].match(/[012]/g)||[]).join('');if(!p)continue;if(!raw.has(m[1]))raw.set(m[1],[]);raw.get(m[1]).push(p);}
const b=await chromium.launch();const p=await (await b.newContext()).newPage();await p.setContent('<body></body>');
await p.addScriptTag({content:fs.readFileSync(fs.existsSync('house-character.js')?'house-character.js':'hc-speech.js','utf8')});await p.addScriptTag({content:fs.readFileSync('pron-mark.js','utf8')});
const R=await p.evaluate(list=>{
 /* noun or verb? The dictionary lists the verb first for these, and the spelling cannot say which it is: the noun or adjective is the commoner one in lessons */
 const NOUN_FIRST=new Set('abstract accent addict adult adults concrete conflicts costume costumes discount discounts import imports increase insert inserts insult insults perfect permit permits record records refund refunds reject rejects subject suspect suspects transfer transfers transport upgrade upgrades update updates survey surveys impact'.split(' '));const sig=a=>a.map(s=>s.from+':'+s.to+':'+s.stress).join(',');
 const want=new Map(),keep=new Map(),badFit=[];
 for(const [w,vs] of list){const first=vs[0],prim=first.indexOf('1');if(prim<0)continue;
  PronMark.useDict(null);const rule=PronMark.syllables(w);
  /* a variant with the same main stress and as many syllables as the spelling shows reads best: different, chocolate */
  const nounFirst=NOUN_FIRST.has(w)&&vs.find(x=>x.indexOf('1')===0);
  const v=nounFirst||vs.find(x=>x.indexOf('1')===prim&&x.length===rule.length)||first;
  PronMark.useDict({[v]:w});const d=PronMark.syllables(w);want.set(w,[v,sig(d)]);
  if(sig(d)!==sig(rule)){keep.set(w,v);if(d.length!==v.length)badFit.push(w+':'+v+'→'+d.length);}
 }
 /* a word left out can lean on a shorter word that is kept: check again with the finished list, until nothing moves */
 let rounds=0,moved=true;while(moved&&rounds++<5){moved=false;PronMark.useDict(null);const all={};for(const [w,v] of keep)(all[v]=all[v]||[]).push(w);for(const k in all)PronMark.useDict({[k]:all[k].join(' ')});
  for(const [w,[v,s]] of want)if(!keep.has(w)&&sig(PronMark.syllables(w))!==s){keep.set(w,v);moved=true;}}
 const out={};for(const [w,v] of keep)(out[v]=out[v]||[]).push(w);
 return{out,kept:keep.size,dropped:want.size-keep.size,badFit,rounds};},[...raw]);
await b.close();
const body=Object.keys(R.out).sort().map(k=>JSON.stringify(k)+':'+JSON.stringify(R.out[k].join(' '))).join(',\n');
fs.writeFileSync('pron-dict.js',`/* pron-dict.js: word stress for PronMark, from the CMU Pronouncing Dictionary.
   Each key is the stress of a word's syllables (0 weak, 1 main, 2 secondary), followed by the words that have it.
   Words the rules in pron-mark.js already get right are left out, so run build_dict.js again if those rules change.
   CMU Pronouncing Dictionary, Copyright (C) 1993-2015 Carnegie Mellon University. All rights reserved. Used under its BSD licence,
   which asks that this notice stays with any copy. */
PronMark.useDict({
${body}
});
window.PRON_DICT_LOADED = true;
`);
console.log('kept',R.kept,'dropped',R.dropped,'bytes',fs.statSync('pron-dict.js').size,'rounds',R.rounds,'fit misses',R.badFit.length,R.badFit.slice(0,25).join(' '));
})();
