/* Browser-local educational pilot. Never sends uploaded content anywhere. */
(function(){
 'use strict';
 const S=window.StatsCoach;
 const $=id=>document.getElementById(id);
 const ns='http://www.w3.org/2000/svg';
 let dataset=null, columns=[], current=null, demo=false;
 function method(){return document.querySelector('input[name="method"]:checked').value;}
 function text(el,txt){el.textContent=String(txt);return el;}
 function el(tag,className,content){const n=document.createElement(tag);if(className)n.className=className;if(content!==undefined)text(n,content);return n;}
 function showError(message){const box=$('analysisMessage');box.hidden=false;text(box,message);}
 function hideError(){$('analysisMessage').hidden=true;}
 function clearResult(){current=null;$('results').replaceChildren(el('div','empty-state','Select variables and press Calculate & explain.'));hideError();}
 function message(str,good){$('dataMessage').textContent=str;$('dataMessage').className='message'+(good?' success':'');}
 function setOptions(target, names, prev, exclude=''){
   target.replaceChildren();
   const filtered=names.filter(x=>x!==exclude);
   if(!filtered.length){const option=new Option('No suitable columns', '');target.add(option);return;}
   filtered.forEach(name=>target.add(new Option(name,name)));
   target.value=filtered.includes(prev)?prev:filtered[0];
 }
 function refreshColumns(){
   if(!dataset)return;
   const type=method(); const numeric=columns.filter(c=>c.type==='numeric').map(c=>c.name);
   const categorical=columns.filter(c=>c.type==='category').map(c=>c.name);
   const old1=$('var1').value,old2=$('var2').value;
   $('var1Label').textContent=type==='pearson'?'Variable X (numeric)':'Grouping variable (2 categories)';
   $('var2Label').textContent=type==='pearson'?'Variable Y (numeric)':'Outcome (numeric)';
   setOptions($('var1'), type==='pearson'?numeric:categorical,old1);
   setOptions($('var2'),numeric,old2,type==='pearson' ? $('var1').value:'');
   if(demo){
     if(type==='pearson' && numeric.includes('SelfEsteemScore') && numeric.includes('StressScore')){
       $('var1').value='SelfEsteemScore';$('var2').value='StressScore';
     }else if(type==='welch' && categorical.includes('Group') && numeric.includes('SelfEsteemScore')){
       $('var1').value='Group';$('var2').value='SelfEsteemScore';
     }
   }
   $('methodNote').textContent=type==='pearson'?'Pearson measures a linear association between two quantitative variables. It does not establish causation.':'Welch compares two independent groups on a quantitative outcome. Do not use for paired before/after observations.';
   clearResult();
 }
 function loadData(){
   try{
     const parsed=S.csvParse($('csvText').value);
     dataset=parsed;columns=S.summarizeColumns(parsed);
     message(`${parsed.rows.length} rows and ${parsed.headers.length} columns loaded. Calculations happen only on this device.`,true);
     const box=$('datasetSummary');box.hidden=false;box.replaceChildren();
     box.append(el('strong','',`${parsed.rows.length} observations · ${columns.filter(c=>c.type==='numeric').length} numeric columns`));
     const c=el('div','columns-list');
     columns.forEach(x=>c.append(el('span','',`${x.name} · ${x.type}${x.missing?` (${x.missing} blank)`:''}`)));
     box.append(c);
     if(demo){$('question').value='Is self-esteem associated with stress among the students?';}
     refreshColumns();
     return true;
   } catch(error) {
     dataset=null;columns=[];$('datasetSummary').hidden=true;
     message(error.message,false);clearResult();return false;
   }
 }
 function loadDemo(){
   demo=true;
   $('csvText').value=window.DemoCSV;
   $('question').value='Is self-esteem associated with stress among the students?';
   document.querySelector('input[name="method"][value="pearson"]').checked=true;
   if(loadData()){
     analyze();
     (window.innerWidth<900 ? $('results') : $('workbench')).scrollIntoView({behavior:'smooth',block:'start'});
   }
 }
 function suggestMethod(){
   const q=$('question').value.toLowerCase();const note=$('suggestInfo');
   if(!q.trim()){text(note,'Describe your research question first.');return;}
   const comparative= /\b(compare|comparison|difference|differ|groups?|intervention|versus|vs\.?|higher|lower|between treatments?)\b/.test(q);
   const associated=/\b(correlation|correlate|relationship|associated|association|related|linked|predict)\b/.test(q);
   if(comparative && associated){text(note,'Ambiguous question: check study design with your supervisor.');return;}
   if(comparative){document.querySelector('[name="method"][value="welch"]').checked=true;refreshColumns();text(note,'Suggested: independent-groups Welch test; confirm your groups are not paired.');}
   else if(associated){document.querySelector('[name="method"][value="pearson"]').checked=true;refreshColumns();text(note,'Suggested: Pearson correlation; inspect measurement scales and scatterplot.');}
   else{text(note,'Not enough keywords. Choose a method based on your study design.');}
 }
 function tag(name,attrs,content){const n=document.createElementNS(ns,name);for(const [k,v]of Object.entries(attrs||{}))n.setAttribute(k,String(v));if(content!==undefined)n.textContent=content;return n;}
 function drawScatter(root,result){
   const {points,x,y}=result;
   const w=430,h=240,left=49,right=18,top=20,bottom=46;
   const allX=points.map(p=>p.x),allY=points.map(p=>p.y);
   const mnX=Math.min(...allX),mxX=Math.max(...allX),mnY=Math.min(...allY),mxY=Math.max(...allY);
   const padX=Math.max(.5,(mxX-mnX)*.06),padY=Math.max(.5,(mxY-mnY)*.06);
   const xmin=mnX-padX,xmax=mxX+padX,ymin=mnY-padY,ymax=mxY+padY;
   const px=x=>left+(x-xmin)/(xmax-xmin)*(w-left-right),py=y=>top+(ymax-y)/(ymax-ymin)*(h-top-bottom);
   const svg=tag('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':`Scatterplot of ${x} against ${y} from ${points.length} complete pairs`});
   for(let i=0;i<=4;i++){
     const ax=left+(w-left-right)*i/4,ay=top+(h-top-bottom)*i/4;
     svg.append(tag('line',{x1:ax,y1:top,x2:ax,y2:h-bottom,stroke:'#ebeff4'}),tag('line',{x1:left,y1:ay,x2:w-right,y2:ay,stroke:'#ebeff4'}));
     svg.append(tag('text',{x:ax,y:h-bottom+17,'font-size':10,'text-anchor':'middle',fill:'#7f91a3'},(xmin+(xmax-xmin)*i/4).toFixed(1)));
     svg.append(tag('text',{x:left-9,y:ay+3,'font-size':10,'text-anchor':'end',fill:'#7f91a3'},(ymax-(ymax-ymin)*i/4).toFixed(1)));
   }
   for(const p of points)svg.append(tag('circle',{cx:px(p.x),cy:py(p.y),r:3.3,fill:'#2e957d',opacity:.7}));
   svg.append(tag('text',{x:w/2,y:h-5,'font-size':11,'text-anchor':'middle',fill:'#52677c'},x));
   svg.append(tag('text',{x:13,y:h/2,'font-size':11,'text-anchor':'middle',fill:'#52677c',transform:`rotate(-90 13 ${h/2})`},y));
   root.append(svg);
 }
 function drawWelch(root,result){
   const {groups}=result;
   const w=430,h=240,left=60,right=20,top=19,bottom=53;
   const all=[...groups[0].values,...groups[1].values];const ymin=Math.min(...all),ymax=Math.max(...all),spread=Math.max(.5,ymax-ymin);
   const minimum=ymin-spread*.08,maximum=ymax+spread*.08;
   const py=y=>top+(maximum-y)/(maximum-minimum)*(h-top-bottom);
   const svg=tag('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':`Dot plot of ${result.outcome} values by ${result.group}`});
   for(let i=0;i<=4;i++){
     const ay=top+(h-top-bottom)*i/4;
     svg.append(tag('line',{x1:left,y1:ay,x2:w-right,y2:ay,stroke:'#ecf1f5'}));
     svg.append(tag('text',{x:left-10,y:ay+3,'font-size':10,'text-anchor':'end',fill:'#7f91a3'},(maximum-(maximum-minimum)*i/4).toFixed(1)));
   }
   const xPositions=[135,300];
   groups.forEach((g,gi)=>{
     g.values.forEach((v,i)=>{const jitter=Math.sin(i*119.17+gi*17)*27;svg.append(tag('circle',{cx:xPositions[gi]+jitter,cy:py(v),r:3,fill:gi?'#7c9bc7':'#309c7c',opacity:.55}));});
     svg.append(tag('line',{x1:xPositions[gi]-35,x2:xPositions[gi]+35,y1:py(g.mean),y2:py(g.mean),stroke:'#183e48','stroke-width':3}));
     const label=g.name.length>18?g.name.slice(0,17)+'…':g.name;
     svg.append(tag('text',{x:xPositions[gi],y:h-bottom+20,'font-size':12,'text-anchor':'middle',fill:'#52677c'},label));
   });
   root.append(svg);
 }
 function addTextDiv(parent,tagName,className,content){const d=el(tagName,className,content);parent.append(d);return d;}
 function numberCard(label,number,sub){const card=el('div','result-number');card.append(el('small','',label),el('strong','',number));if(sub)card.append(el('i','',sub));return card;}
 function render(r){
   const body=el('div','result-body');
   if(demo)body.append(el('div','demo-banner','⚑ SYNTHETIC EXAMPLE — not real participant data. Do not submit as research.'));
   const stats=el('div','result-pulse');
   if(r.method==='pearson'){
     const percent=100*r.rSquared;
     const percentText=percent<.001?'< 0.001%':percent<.01?percent.toFixed(3)+'%':percent<.1?percent.toFixed(2)+'%':percent.toFixed(1)+'%';
     stats.append(numberCard('Correlation r',r.r.toFixed(2)),numberCard('p-value',r.p<.001?'< .001':r.p.toFixed(3)),numberCard('Complete pairs',r.n,String(r.excluded)+' excluded'),numberCard('Shared variation r²',percentText,'Descriptive, not causal'));
   }else{
     stats.append(numberCard('Mean difference',r.diff.toFixed(2)),numberCard('p-value',r.p<.001?'< .001':r.p.toFixed(3)),numberCard('Valid sample',r.n,String(r.excluded)+' excluded'),numberCard('Hedges’ g',r.hedgesG.toFixed(2),'Standardized difference'));
   }
   body.append(stats);
   const c=S.plainConclusion(r),interpreted=el('section','interpretation-panel');
   interpreted.append(el('div','interpretation-eyebrow','PLAIN-LANGUAGE INTERPRETATION'));
   interpreted.append(el('h4','',c.heading));
   interpreted.append(el('p','interpretation-summary',c.summary));
   interpreted.append(el('p','interpretation-effect',c.effect));
   interpreted.append(el('p','interpretation-caution',c.caution));
   body.append(interpreted);
   const plot=el('div','plot-panel');plot.append(el('h4','',r.method==='pearson'?'Observed pairwise values':'Independent group observations'));
   if(r.method==='pearson')drawScatter(plot,r);else drawWelch(plot,r);
   body.append(plot);
   const apaSection=el('section','subsection');apaSection.append(el('h4','','APA-style result — review before submission'));apaSection.append(el('p','report-text',S.apa(r)));body.append(apaSection);
   const checks=el('section','subsection');checks.append(el('h4','','Assumption checks — what remains uncertain'));
   checks.append(el('p','checks-intro','These are descriptive data screens and design reminders, NOT automated approval of assumptions. Review flagged cases and confirm the study design.'));
   const checklist=el('div','assumption-list');
   S.assumptionChecks(r).forEach(c=>{
     const item=el('div','assumption-item');
     const heading=el('div','assumption-head');
     const status=el('span','assumption-status '+c.status,c.status==='inspect'?'Inspect':c.status==='observed'?'Data screen':'Human review');
     heading.append(el('strong','',c.label),status);
     item.append(heading,el('p','',c.detail));checklist.append(item);
   });
   checks.append(checklist);
   const details=el('details','extra-notes');details.append(el('summary','','More method limitations'));
   const ul=el('ul');r.notes.forEach(n=>ul.append(el('li','',n)));details.append(ul);checks.append(details);body.append(checks);
   const viva=el('section','subsection');viva.append(el('h4','','Practice for your viva'));const faq=el('div','viva-list');
   S.viva(r).forEach(([q,a])=>{const detail=el('details');detail.append(el('summary','',q),el('p','',a));faq.append(detail);});viva.append(faq);body.append(viva);
   const buttons=el('div','report-actions');
   const copy=el('button','secondary-small','Copy APA paragraph');copy.type='button';copy.addEventListener('click',async()=>{
     try{await navigator.clipboard.writeText(S.apa(r));text(copy,'Copied ✓');}catch{const ta=$('question');ta.focus();text(copy,'Clipboard unavailable; select text above');}
   });
   const download=el('button','mini-button','↓ Download report (.md)');download.type='button';download.addEventListener('click',()=>{
     const md=S.reportMarkdown(r,$('question').value.slice(0,700));const file=new Blob([md],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(file);
     const a=document.createElement('a');a.href=url;a.download='research-stats-coach-report.md';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   });buttons.append(copy,download);body.append(buttons);
   body.append(el('p','note-tiny','Statistics are computed locally from the supplied observations. The result is not an automatic judgment that the selected test suits your design. Ask your supervisor to verify variable definitions, study design and interpretation.'));
   $('results').replaceChildren(body);
 }
 function analyze(){hideError();if(!dataset){showError('First load or paste a CSV dataset.');return;}
   const a=$('var1').value,b=$('var2').value;
   if(!a || !b){showError('Choose suitable columns for the selected test.');return;}
   try{
     current=method()==='pearson'?S.pearson(dataset,a,b):S.welch(dataset,a,b);
     render(current);
     $('results').scrollIntoView({behavior:'smooth',block:'nearest'});
   }catch(error){current=null;showError(error.message);}
 }
 $('demoTop').addEventListener('click',loadDemo);
 $('loadDemo').addEventListener('click',loadDemo);
 $('demoEmpty').addEventListener('click',loadDemo);
 $('parse').addEventListener('click',()=>{demo=false;loadData();});
 $('upload').addEventListener('change',async function(){
   const file=this.files?.[0];if(!file)return;
   if(file.size>5*1024*1024){message('File too large. Pilot limit: 5 MB.',false);return;}
   if(!/\.(csv|tsv)$/i.test(file.name)){message('Use a .csv or .tsv file. SPSS .sav is not supported in this pilot.',false);return;}
   try{$('csvText').value=await file.text();demo=false;loadData();}catch(e){message('Unable to read file: '+e.message,false);}
 });
 $('suggest').addEventListener('click',suggestMethod);
 for(const radio of document.querySelectorAll('input[name="method"]'))radio.addEventListener('change',refreshColumns);
 for(const sel of [$('var1'),$('var2')])sel.addEventListener('change',clearResult);
 $('analyze').addEventListener('click',analyze);
})();
