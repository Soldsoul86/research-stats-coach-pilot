/* Research Stats Coach. Dependency-free numerical analysis; no model-generated numerical results. */
(function (root, factory) {
  const API = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.StatsCoach = API;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const NA = new Set(['', 'na', 'n/a', 'nan', 'null', '.', 'missing', 'undefined']);
  const missing = (v) => v == null || NA.has(String(v).trim().toLowerCase());
  function numeric(v) {
    if (missing(v)) return null;
    const s = String(v).trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  function csvParse(text, delimiter) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Please paste or upload a CSV file.');
    text = text.replace(/^\uFEFF/, '');
    if (!delimiter) {
      const line = text.split(/\r?\n/, 1)[0];
      const scores = [',', '\t', ';'].map(d => [d, (line.match(new RegExp(d === '\t' ? '\\t' : d, 'g')) || []).length]);
      scores.sort((a,b)=>b[1]-a[1]);
      delimiter = scores[0][1] > 0 ? scores[0][0] : ',';
    }
    const rows = []; let fields = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (quoted && text[i+1] === '"') { cell += '"'; i++; }
        else if (quoted) quoted = false;
        else if (cell.length === 0) quoted = true;
        else cell += ch;
      } else if (ch === delimiter && !quoted) { fields.push(cell); cell = ''; }
      else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && text[i+1] === '\n') i++;
        fields.push(cell); cell = '';
        if (fields.some(x=>x.trim() !== '')) rows.push(fields);
        fields = [];
        if (rows.length > 5001) throw new Error('Pilot limit: 5,000 data rows.');
      } else cell += ch;
    }
    if (quoted) throw new Error('CSV contains an unclosed quoted cell.');
    fields.push(cell); if (fields.some(x=>x.trim() !== '')) rows.push(fields);
    if (rows.length < 2) throw new Error('CSV needs one header row and at least one data row.');
    const headers = rows.shift().map(s=>s.trim());
    if (headers.length > 120) throw new Error('Pilot limit: 120 columns.');
    if (headers.some(h=>!h)) throw new Error('Every CSV column needs a name.');
    if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV column names must be renamed.');
    if (rows.some(r=>r.length !== headers.length)) throw new Error('Some CSV rows have a different number of cells than the header. Check quotes or delimiters.');
    return {headers, rows: rows.map(r => Object.fromEntries(headers.map((h,i)=>[h,r[i].trim()]))) };
  }
  function summarizeColumns(data) {
    return data.headers.map(name=>{
      const values = data.rows.map(r=>r[name]).filter(v=>!missing(v));
      const numbers = values.map(numeric).filter(v=>v!==null);
      const unique = [...new Set(values)];
      const type = values.length && numbers.length===values.length ? 'numeric' : 'category';
      return {name,type,valid:values.length,missing:data.rows.length-values.length,unique:unique.length, levels:type==='category'?unique.slice(0,15):[]};
    });
  }
  function mean(x) { return x.reduce((a,b)=>a+b,0)/x.length; }
  function sampleVar(x) { if(x.length < 2) return NaN; const m=mean(x); return x.reduce((s,v)=>s+(v-m)**2,0)/(x.length-1); }
  function sd(x) {return Math.sqrt(sampleVar(x));}
  // Lanczos approximation (g=7) and continued fraction for regularized incomplete beta.
  const coefficients = [0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  function logGamma(z) {
    if (z < 0.5) return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
    z-=1;let x=coefficients[0];for(let i=1;i<coefficients.length;i++)x+=coefficients[i]/(z+i);
    const t=z+7.5;return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(x);
  }
  function betaCF(a,b,x) {
    const maxIter=300,eps=3e-14,fpmin=1e-300;
    let c=1,d=1-(a+b)*x/(a+1);
    if(Math.abs(d)<fpmin)d=fpmin;d=1/d;let h=d;
    for(let m=1;m<=maxIter;m++){
      const m2=2*m;let aa=m*(b-m)*x/((a+m2-1)*(a+m2));
      d=1+aa*d;if(Math.abs(d)<fpmin)d=fpmin;c=1+aa/c;if(Math.abs(c)<fpmin)c=fpmin;d=1/d;h*=d*c;
      aa=-(a+m)*(a+b+m)*x/((a+m2)*(a+m2+1));
      d=1+aa*d;if(Math.abs(d)<fpmin)d=fpmin;c=1+aa/c;if(Math.abs(c)<fpmin)c=fpmin;d=1/d;
      const change=d*c;h*=change;
      if(Math.abs(change-1)<eps) break;
    }
    return h;
  }
  function regBeta(x,a,b) {
    if (!(a>0 && b>0) || x<0 || x>1) return NaN;
    if (x===0) return 0;if(x===1) return 1;
    const bt=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));
    return x<(a+1)/(a+b+2) ? bt*betaCF(a,b,x)/a : 1-bt*betaCF(b,a,1-x)/b;
  }
  function twoSidedP(t,df) {
    if(df <= 0 || !Number.isFinite(df))return NaN;
    if(!Number.isFinite(t))return t===Infinity || t===-Infinity ? 0 : NaN;
    const y = df/(df+t*t);
    return Math.max(0,Math.min(1,regBeta(y,df/2,0.5)));
  }
  function tCritical(df,alpha=0.05) {
    let lo=0,hi=1;
    while(twoSidedP(hi,df)>alpha && hi<1e20)hi*=2;
    for(let i=0;i<90;i++){const mid=(lo+hi)/2;if(twoSidedP(mid,df)>alpha)lo=mid;else hi=mid;}
    return (lo+hi)/2;
  }
  function diagnosticSkew(values){
    if(values.length<4)return null;
    const mu=mean(values);const s=sd(values);if(!s)return null;
    const n=values.length;const m3=values.reduce((p,x)=>p+Math.pow((x-mu)/s,3),0);
    return (n/((n-1)*(n-2)))*m3; // adjusted Fisher skewness using sample SD
  }
  function pearson(data,xName,yName) {
    if(xName===yName)throw new Error('Choose two different quantitative variables.');
    const valid = data.rows.map(r=>({x:numeric(r[xName]),y:numeric(r[yName])})).filter(v=>v.x!==null&&v.y!==null);
    const n=valid.length;
    if(n<4)throw new Error('Pearson correlation requires at least four complete pairs for a 95% confidence interval.');
    const X=valid.map(v=>v.x),Y=valid.map(v=>v.y);
    const mx=mean(X),my=mean(Y);
    let sxx=0,syy=0,sxy=0;
    for(const {x,y} of valid){sxx+=(x-mx)**2;syy+=(y-my)**2;sxy+=(x-mx)*(y-my);}
    if(sxx===0 || syy===0)throw new Error('Correlation is undefined because one selected variable has no variation.');
    const r=Math.max(-1,Math.min(1,sxy/Math.sqrt(sxx*syy)));
    const df=n-2;
    const t=Math.abs(r)===1?Infinity:r*Math.sqrt(df/(1-r*r));
    const p=twoSidedP(t,df);
    const z=Math.atanh(Math.max(-1+1e-14,Math.min(1-1e-14,r))), dz=1.959963984540054/Math.sqrt(n-3);
    const ci=[Math.tanh(z-dz),Math.tanh(z+dz)];
    const notes=[];
    if(diagnosticSkew(X)!==null && Math.abs(diagnosticSkew(X))>1)notes.push(`${xName} is strongly skewed by a simple descriptive screen; inspect distribution and consider a rank-based test.`);
    if(diagnosticSkew(Y)!==null && Math.abs(diagnosticSkew(Y))>1)notes.push(`${yName} is strongly skewed by a simple descriptive screen; inspect distribution and consider a rank-based test.`);
    if(n<30) notes.push('Small sample: interpret p-values and interval width cautiously.');
    notes.push('Inspect the scatterplot for nonlinearity and influential observations. Pearson measures linear association, not causation.');
    notes.push('The pilot does not establish random sampling, independence, construct validity, or a formal normality test.');
    return {method:'pearson',x:xName,y:yName,n,excluded:data.rows.length-n,r,t,df,p,ci,notes,points:valid};
  }
  function welch(data,groupName,outcomeName) {
    if(groupName===outcomeName)throw new Error('Choose a category for groups and a different quantitative outcome variable.');
    const valid = data.rows.map(r=>({group:String(r[groupName]??'').trim(),value:numeric(r[outcomeName])})).filter(v=>!missing(v.group)&&v.value!==null);
    const names=[...new Set(valid.map(v=>v.group))];
    if(names.length!==2)throw new Error(`This independent two-group test requires exactly two group labels; found ${names.length} in complete cases.`);
    const a=valid.filter(v=>v.group===names[0]).map(v=>v.value);
    const b=valid.filter(v=>v.group===names[1]).map(v=>v.value);
    if(a.length<2 || b.length<2)throw new Error('Each group needs at least two valid observations.');
    const n1=a.length,n2=b.length,m1=mean(a),m2=mean(b),v1=sampleVar(a),v2=sampleVar(b);
    const vA=v1/n1,vB=v2/n2, se=Math.sqrt(vA+vB);
    if(se<=0)throw new Error('The comparison cannot estimate uncertainty because both groups have zero variance.');
    const diff=m1-m2,df=(vA+vB)**2/(vA*vA/(n1-1)+vB*vB/(n2-1));
    const t=diff/se,p=twoSidedP(t,df),crit=tCritical(df),ci=[diff-crit*se,diff+crit*se];
    const notes=[];
    if(Math.min(n1,n2)<15)notes.push('At least one group is small: inspect distributions and outliers; the t approximation may be unreliable for strongly nonnormal data.');
    if((diagnosticSkew(a)!==null&&Math.abs(diagnosticSkew(a))>1)||(diagnosticSkew(b)!==null&&Math.abs(diagnosticSkew(b))>1))notes.push('At least one group is skewed by a simple descriptive screen. Inspect a plot and consider sensitivity analysis.');
    notes.push('Welch’s test does not assume equal group variances, but observations still need to be independent.');
    notes.push('Use this only for independent groups; it is not the correct test for paired before/after observations. The pilot cannot validate study design.');
    return {method:'welch',group:groupName,outcome:outcomeName,groups:[{name:names[0],n:n1,mean:m1,sd:Math.sqrt(v1),values:a},{name:names[1],n:n2,mean:m2,sd:Math.sqrt(v2),values:b}],n:n1+n2,excluded:data.rows.length-(n1+n2),diff,se,t,df,p,ci,notes};
  }
  function fmtP(p){return p<0.001?'< .001':`= ${p.toFixed(3).replace(/^0\./,'.')}`;}
  function fmtStat(v, digits=2){return (Math.abs(v)<0.000000001?0:v).toFixed(digits).replace(/^-0\./,'-0.').replace(/^0\./,'.');}
  function apa(result){
    if(result.method==='pearson')return `A Pearson correlation between ${result.x} and ${result.y} was ${result.r>=0?'positive':'negative'}, r(${result.df}) = ${fmtStat(result.r,2)}, p ${fmtP(result.p)}, 95% CI [${fmtStat(result.ci[0],2)}, ${fmtStat(result.ci[1],2)}], n = ${result.n}. This association does not establish causation.`;
    const [a,b]=result.groups;
    return `An independent-samples Welch t-test compared ${result.outcome} between ${a.name} (M = ${fmtStat(a.mean)}, SD = ${fmtStat(a.sd)}, n = ${a.n}) and ${b.name} (M = ${fmtStat(b.mean)}, SD = ${fmtStat(b.sd)}, n = ${b.n}). The mean difference (${a.name} − ${b.name}) was ${fmtStat(result.diff)}, t(${result.df.toFixed(2)}) = ${fmtStat(result.t)}, p ${fmtP(result.p)}, 95% CI [${fmtStat(result.ci[0])}, ${fmtStat(result.ci[1])}].`;
  }
  function viva(result) {
    if(result.method==='pearson')return [
      ['Why did you choose Pearson correlation?',`The selected variables (${result.x}, ${result.y}) are quantitative, and the research question concerns their linear association. I must also inspect the scatterplot and sampling assumptions.`],
      ['What does the coefficient mean?',`The estimated sample correlation is ${fmtStat(result.r)}. Its sign indicates direction; its absolute size indicates the strength of the linear sample association.`],
      ['Does the p-value prove the hypothesis?',`No. The two-sided p-value (${result.p.toPrecision(3)}) measures compatibility with a null hypothesis of zero population correlation under model assumptions. It is not the probability that a hypothesis is true.`],
      ['Can you say one variable causes the other?','No. Correlation alone does not establish causation; confounding, measurement error and reverse direction are possible.'],
      ['Which limitations would you mention?',result.notes.join(' ')]
    ];
    return [
      ['Why use Welch rather than the conventional pooled t-test?','Welch does not require the two independent groups to have equal population variances. Independence and sensible study design are still needed.'],
      ['What does the difference estimate?',`The estimated sample difference is ${fmtStat(result.diff)} points (${result.groups[0].name} minus ${result.groups[1].name}) in ${result.outcome}.`],
      ['What does the 95% confidence interval mean?',`The interval [${fmtStat(result.ci[0])}, ${fmtStat(result.ci[1])}] is calculated by a method intended to cover the true difference in 95% of repeated suitable samples. It is not a 95% probability assigned to this fixed parameter.`],
      ['Would a significant result prove the intervention caused the difference?','Not necessarily. Causal inference also depends on allocation, confounding and design.'],
      ['When is this the wrong test?','For repeated measurements on the same people, more than two independent groups, or outcomes that are not appropriately quantitative.']
    ];
  }
  function reportMarkdown(result,question) {
    return `# Research Stats Coach — teaching report\n\n**Research question:** ${question||'(not provided)'}\n\n**Method:** ${result.method==='pearson'?'Pearson product-moment correlation':'Independent-samples Welch t-test'}\n\n**Complete observations:** ${result.n}. **Excluded incomplete rows:** ${result.excluded}.\n\n## Result (APA-style starting point)\n\n${apa(result)}\n\n## Study design and assumption checks that require human review\n\n${result.notes.map(n=>'- '+n).join('\n')}\n\n## Viva preparation\n\n${viva(result).map(([q,a])=>`**Q: ${q}**\n\nA: ${a}`).join('\n\n')}\n\n---\nThis teaching report is computed locally from supplied data using a restricted method set. It is not a clinical interpretation or a substitute for statistical supervision. No AI-generated statistical facts.\n`;
  }
  return {csvParse,numeric,missing,summarizeColumns,pearson,welch,apa,viva,reportMarkdown,math:{twoSidedP,tCritical,mean,sd}};
});

/* Synthetic data for demonstration only — not collected from students. */
window.DemoCSV = "StudentID,Group,StudyHours,SelfEsteemScore,StressScore\nS001,Workshop,2.8,13.5,25.5\nS002,Comparison,1.1,15.7,21.5\nS003,Workshop,2.3,29.5,11.5\nS004,Comparison,3.0,21.4,8.6\nS005,Workshop,3.0,24.3,16.5\nS006,Comparison,0.7,13.8,20.1\nS007,Workshop,1.4,21.1,11.5\nS008,Comparison,4.3,21.5,22.9\nS009,Workshop,1.2,18.8,13.9\nS010,Comparison,3.0,15.9,18.1\nS011,Workshop,1.0,18.5,15.9\nS012,Comparison,4.1,16.1,23.1\nS013,Workshop,2.6,22.4,13.8\nS014,Comparison,3.0,15.4,12.6\nS015,Workshop,0.9,15.7,19.2\nS016,Comparison,3.1,17.9,23.3\nS017,Workshop,0.5,19.7,16.1\nS018,Comparison,1.3,22.0,10.1\nS019,Workshop,1.5,17.2,16.8\nS020,Comparison,2.5,15.5,19.5\nS021,Workshop,3.8,25.1,15.0\nS022,Comparison,3.0,13.5,19.1\nS023,Workshop,3.1,23.7,11.0\nS024,Comparison,1.3,22.5,9.1\nS025,Workshop,1.0,16.8,17.7\nS026,Comparison,1.1,18.1,13.8\nS027,Workshop,3.8,12.8,29.0\nS028,Comparison,3.4,22.3,6.4\nS029,Workshop,1.6,18.7,10.0\nS030,Comparison,2.5,16.2,24.0\nS031,Workshop,2.9,19.9,16.7\nS032,Comparison,2.6,13.0,24.0\nS033,Workshop,1.9,24.1,19.4\nS034,Comparison,2.0,27.4,8.7\nS035,Workshop,2.1,11.2,26.1\nS036,Comparison,3.0,15.8,14.9\nS037,Workshop,2.0,24.5,15.0\nS038,Comparison,1.5,15.4,9.4\nS039,Workshop,4.7,21.9,11.8\nS040,Comparison,2.9,22.0,12.2\nS041,Workshop,1.9,20.9,10.8\nS042,Comparison,3.6,12.0,18.3\nS043,Workshop,2.1,18.2,23.3\nS044,Comparison,1.5,21.1,16.1\nS045,Workshop,3.3,15.6,19.3\nS046,Comparison,0.5,18.0,15.4\nS047,Workshop,3.6,17.5,20.3\nS048,Comparison,3.4,19.6,11.6\nS049,Workshop,4.1,19.0,18.8\nS050,Comparison,2.7,14.4,17.0\nS051,Workshop,3.4,21.7,14.2\nS052,Comparison,2.2,21.9,11.2\nS053,Workshop,1.7,24.3,7.5\nS054,Comparison,4.7,9.8,17.3\nS055,Workshop,4.5,28.7,7.8\nS056,Comparison,2.2,20.2,16.5\nS057,Workshop,4.1,24.9,5.6\nS058,Comparison,0.5,19.3,15.5\nS059,Workshop,2.8,29.9,12.5\nS060,Comparison,1.9,18.8,20.0\nS061,Workshop,1.6,21.7,17.4\nS062,Comparison,1.4,15.8,22.7\nS063,Workshop,4.9,17.1,19.1\nS064,Comparison,4.9,25.8,7.5\nS065,Workshop,2.9,15.2,16.2\nS066,Comparison,3.1,22.2,17.1\nS067,Workshop,2.4,13.1,12.5\nS068,Comparison,1.7,20.5,14.8\nS069,Workshop,0.5,21.6,18.2\nS070,Comparison,3.3,23.5,20.4\nS071,Workshop,2.5,17.9,16.4\nS072,Comparison,3.4,26.7,12.4\n";

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
     stats.append(numberCard('Correlation r',S.apa(r).match(/r\(\d+\) = ([^,]+)/)?.[1]||r.r.toFixed(2)),numberCard('p-value',r.p<.001?'< .001':r.p.toFixed(3)),numberCard('Complete pairs',r.n,String(r.excluded)+' excluded'));
   }else{
     stats.append(numberCard('Mean difference',r.diff.toFixed(2)),numberCard('p-value',r.p<.001?'< .001':r.p.toFixed(3)),numberCard('Valid sample',r.n,String(r.excluded)+' excluded'));
   }
   body.append(stats);
   const plot=el('div','plot-panel');plot.append(el('h4','',r.method==='pearson'?'Observed pairwise values':'Independent group observations'));
   if(r.method==='pearson')drawScatter(plot,r);else drawWelch(plot,r);
   body.append(plot);
   const apaSection=el('section','subsection');apaSection.append(el('h4','','APA-style result — review before submission'));apaSection.append(el('p','report-text',S.apa(r)));body.append(apaSection);
   const checks=el('section','subsection');checks.append(el('h4','','Check these assumptions and limitations'));const ul=el('ul');r.notes.forEach(n=>ul.append(el('li','',n)));checks.append(ul);body.append(checks);
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