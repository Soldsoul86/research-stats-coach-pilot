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
  function quantile(sorted, fraction) {
    const position=(sorted.length-1)*fraction, low=Math.floor(position), high=Math.ceil(position);
    return sorted[low]+(sorted[high]-sorted[low])*(position-low);
  }
  // Exploratory screening, NOT an assumption-validation test.
  function outlierCount(values) {
    if(values.length<8)return null;
    const sorted=[...values].sort((a,b)=>a-b),q1=quantile(sorted,.25),q3=quantile(sorted,.75),iqr=q3-q1;
    if(!(iqr>0))return null;
    return values.filter(v=>v<q1-1.5*iqr||v>q3+1.5*iqr).length;
  }
  function roughMagnitude(value,kind) {
    const v=Math.abs(value);
    // Context-dependent teaching conventions; never clinical or substantive cutoffs.
    if(kind==='r')return v<.1?'near zero':v<.3?'small':v<.5?'moderate':'large';
    return v<.2?'near zero':v<.5?'small':v<.8?'moderate':'large';
  }
  function sharedPercent(rSquared) {
    const percent=100*rSquared;
    if(percent<.001)return '< 0.001%';
    if(percent<.01)return percent.toFixed(3)+'%';
    if(percent<.1)return percent.toFixed(2)+'%';
    return percent.toFixed(1)+'%';
  }
  function plainConclusion(r) {
    const significant=r.p<.05;
    if(r.method==='pearson'){
      const size=roughMagnitude(r.r,'r'),direction=r.r>=0?'positive':'negative';
      return {
        heading:significant?'Evidence of a linear association':'Insufficient evidence of a linear association',
        summary:`${size==='near zero'?'The observed linear relationship is close to zero.':`The sample shows a ${size} ${direction} linear relationship between ${r.x} and ${r.y}.`} ${significant?'At the conventional 5% threshold, the data provide evidence against zero population correlation.':'At the conventional 5% threshold, the data do not provide enough evidence against zero population correlation.'} This does not prove ${significant?'causation':'there is no relationship'}.`,
        effect:`Pearson’s r = ${fmtStat(r.r)} is already an effect-size estimate. In this sample r² corresponds to ${sharedPercent(r.rSquared)} shared linear variation, not a causal attribution.`,
        caution:'The conventional effect-size labels are only rough guides. Use the confidence interval, measurement scale and research context before deciding what matters.'
      };
    }
    const [a,b]=r.groups, winner=r.diff>0?a.name:r.diff<0?b.name:null;
    return {
      heading:significant?'Evidence of a difference between groups':'Insufficient evidence of a difference between groups',
      summary:`${winner?`${winner} has the higher sample mean. The estimated difference (${a.name} − ${b.name}) is ${fmtStat(r.diff)} points.`:'The sample group means are equal.'} ${significant?'At the conventional 5% threshold, the data provide evidence against equal population means.':'At the conventional 5% threshold, the data do not provide enough evidence against equal population means.'} This does not prove ${significant?'a causal effect':'the groups are equivalent'}.`,
      effect:`Hedges’ g = ${fmtStat(r.hedgesG)} (${roughMagnitude(r.hedgesG,'g')} by a rough teaching convention). It expresses the difference in pooled SD units with small-sample correction.`,
      caution:'Because Welch allows unequal group variances, a pooled-SD effect size may not be ideal if the dispersions differ. Also examine the raw mean difference, interval, and construct meaning.'
    };
  }
  function assumptionChecks(r) {
    const checks=[{status:r.excluded?'inspect':'observed',label:'Missing data',detail:`${r.n} complete observations; ${r.excluded} excluded for missing selected values. This is a count, not proof that missingness is harmless.`}];
    if(r.method==='pearson'){
      const X=r.points.map(p=>p.x),Y=r.points.map(p=>p.y), outX=outlierCount(X),outY=outlierCount(Y), skewX=diagnosticSkew(X),skewY=diagnosticSkew(Y);
      checks.push({status:(outX||outY)?'inspect':'observed',label:'Outlier screening (descriptive)',detail:(outX||outY)?`Tukey IQR fences flag ${outX||0} values in ${r.x} and ${outY||0} values in ${r.y} for inspection.`:'No marginal Tukey IQR flags found (or data too limited to screen). Influential paired observations may still exist.'});
      checks.push({status:[skewX,skewY].some(v=>v!==null&&Math.abs(v)>1)?'inspect':'observed',label:'Skew screening (descriptive)',detail:[skewX,skewY].some(v=>v!==null&&Math.abs(v)>1)?'At least one variable has |adjusted skew| > 1. Inspect distributions; this is not a formal normality test.':'No strong marginal skew flagged by the |skew| > 1 heuristic. Bivariate normality is not established.'});
      checks.push({status:'review',label:'Linearity and influential cases',detail:'Inspect the scatterplot for curvature, clusters, influential points and nonconstant spread. This is not established automatically.'});
      checks.push({status:'review',label:'Independence and valid measurement',detail:'Confirm that rows represent independent units, variables represent meaningful quantitative scales, and the sampling process is appropriate.'});
    }else{
      const [a,b]=r.groups,outA=outlierCount(a.values),outB=outlierCount(b.values),skewA=diagnosticSkew(a.values),skewB=diagnosticSkew(b.values);
      checks.push({status:Math.min(a.n,b.n)<15?'inspect':'observed',label:'Group sizes',detail:`${a.name}: ${a.n}; ${b.name}: ${b.n}. ${Math.min(a.n,b.n)<15?'At least one group has fewer than 15 observations; examine robustness carefully.':'Both groups have at least 15 observations; this alone cannot validate the test.'}`});
      checks.push({status:(outA||outB)?'inspect':'observed',label:'Outlier screening (descriptive)',detail:(outA||outB)?`IQR fences flag ${outA||0} values in ${a.name} and ${outB||0} in ${b.name} for inspection.`:'No marginal Tukey IQR flags found (or data too limited to screen). Inspect the dot plot regardless.'});
      checks.push({status:[skewA,skewB].some(v=>v!==null&&Math.abs(v)>1)?'inspect':'observed',label:'Skew screening (descriptive)',detail:[skewA,skewB].some(v=>v!==null&&Math.abs(v)>1)?'At least one group has |adjusted skew| > 1; check sensitivity. This is not a formal normality test.':'No strong skew flagged by the |skew| > 1 heuristic. Formal normality is not established.'});
      checks.push({status:'review',label:'Independent groups, not paired',detail:'Confirm participants are not repeated across the two groups. Before/after measurements on the same people require a paired approach.'});
      checks.push({status:'review',label:'Study design and practical interpretation',detail:'Confirm scale validity, sampling, confounders and any causal claims. Welch allows unequal variance, but pooled-SD Hedges’ g needs context.'});
    }
    return checks;
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
    return {method:'pearson',x:xName,y:yName,n,excluded:data.rows.length-n,r,rSquared:r*r,t,df,p,ci,notes,points:valid};
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
    const pooledDf=n1+n2-2, pooledSD=Math.sqrt(((n1-1)*v1+(n2-1)*v2)/pooledDf);
    // Exact Hedges small-sample correction for pooled-SD Cohen's d.
    const J=Math.exp(logGamma(pooledDf/2)-Math.log(pooledDf/2)/2-logGamma((pooledDf-1)/2));
    const hedgesG=pooledSD>0?J*diff/pooledSD:NaN;
    return {method:'welch',group:groupName,outcome:outcomeName,groups:[{name:names[0],n:n1,mean:m1,sd:Math.sqrt(v1),values:a},{name:names[1],n:n2,mean:m2,sd:Math.sqrt(v2),values:b}],n:n1+n2,excluded:data.rows.length-(n1+n2),diff,se,t,df,p,ci,hedgesG,pooledSD,notes};
  }
  function fmtP(p){return p<0.001?'< .001':`= ${p.toFixed(3).replace(/^0\./,'.')}`;}
  function fmtStat(v, digits=2){return (Math.abs(v)<0.000000001?0:v).toFixed(digits).replace(/^-0\./,'-0.').replace(/^0\./,'.');}
  function apa(result){
    if(result.method==='pearson')return `A Pearson correlation between ${result.x} and ${result.y} was ${roughMagnitude(result.r,'r')==='near zero'?'approximately zero':result.r>=0?'positive':'negative'}, r(${result.df}) = ${fmtStat(result.r,2)}, p ${fmtP(result.p)}, 95% CI [${fmtStat(result.ci[0],2)}, ${fmtStat(result.ci[1],2)}], n = ${result.n}. This association does not establish causation.`;
    const [a,b]=result.groups;
    return `An independent-samples Welch t-test compared ${result.outcome} between ${a.name} (M = ${fmtStat(a.mean)}, SD = ${fmtStat(a.sd)}, n = ${a.n}) and ${b.name} (M = ${fmtStat(b.mean)}, SD = ${fmtStat(b.sd)}, n = ${b.n}). The mean difference (${a.name} − ${b.name}) was ${fmtStat(result.diff)}, t(${result.df.toFixed(2)}) = ${fmtStat(result.t)}, p ${fmtP(result.p)}, 95% CI [${fmtStat(result.ci[0])}, ${fmtStat(result.ci[1])}]; Hedges’ g = ${fmtStat(result.hedgesG)} (pooled-SD standardized difference).`;
  }
  function viva(result) {
    if(result.method==='pearson')return [
      ['Why did you choose Pearson correlation?',`The selected variables (${result.x}, ${result.y}) are quantitative, and the research question concerns their linear association. I must also inspect the scatterplot and sampling assumptions.`],
      ['What does the coefficient mean?',`Pearson’s r = ${fmtStat(result.r)} is itself the effect size. The observed r² is ${sharedPercent(result.rSquared)} shared linear variation, not a causal estimate.`],
      ['Does the p-value prove the hypothesis?',`No. The two-sided p-value (${result.p.toPrecision(3)}) measures compatibility with a null hypothesis of zero population correlation under model assumptions. It is not the probability that a hypothesis is true.`],
      ['Can you say one variable causes the other?','No. Correlation alone does not establish causation; confounding, measurement error and reverse direction are possible.'],
      ['Which limitations would you mention?',result.notes.join(' ')]
    ];
    return [
      ['Why use Welch rather than the conventional pooled t-test?','Welch does not require the two independent groups to have equal population variances. Independence and sensible study design are still needed.'],
      ['How large is the group difference?',`The raw difference is ${fmtStat(result.diff)} points (${result.groups[0].name} minus ${result.groups[1].name}) in ${result.outcome}. Hedges’ g = ${fmtStat(result.hedgesG)} expresses it in pooled SD units with small-sample correction; unequal SDs complicate the interpretation.`],
      ['What does the 95% confidence interval mean?',`The interval [${fmtStat(result.ci[0])}, ${fmtStat(result.ci[1])}] is calculated by a method intended to cover the true difference in 95% of repeated suitable samples. It is not a 95% probability assigned to this fixed parameter.`],
      ['Would a significant result prove the intervention caused the difference?','Not necessarily. Causal inference also depends on allocation, confounding and design.'],
      ['When is this the wrong test?','For repeated measurements on the same people, more than two independent groups, or outcomes that are not appropriately quantitative.']
    ];
  }
  function reportMarkdown(result,question) {
    const conclusion=plainConclusion(result),checks=assumptionChecks(result);
    const effect=result.method==='pearson'
      ?`Pearson r = ${fmtStat(result.r)}, r² = ${result.rSquared.toFixed(5)} (${sharedPercent(result.rSquared)} sample shared linear variation).`
      :`Hedges’ g = ${fmtStat(result.hedgesG)} (small-sample corrected pooled-SD standardized difference); raw mean difference = ${fmtStat(result.diff)} ${result.outcome} units.`;
    return `# Research Stats Coach — teaching report\n\n**Research question:** ${question||'(not provided)'}\n\n**Method:** ${result.method==='pearson'?'Pearson product-moment correlation':'Independent-samples Welch t-test'}\n\n**Complete observations:** ${result.n}. **Excluded incomplete rows:** ${result.excluded}.\n\n## Plain-language conclusion (illustrative alpha = .05)\n\n**${conclusion.heading}**\n\n${conclusion.summary}\n\n${conclusion.effect}\n\n${conclusion.caution}\n\n## Result (APA-style starting point)\n\n${apa(result)}\n\n## Effect size\n\n${effect}\n\n## Assumptions: observational screens versus researcher's checks\n\n${checks.map(c=>`- [${c.status==='inspect'?'INSPECT':c.status==='observed'?'DESCRIPTIVE SCREEN':'REQUIRES HUMAN REVIEW'}] ${c.label}: ${c.detail}`).join('\n')}\n\n## Additional limitations\n\n${result.notes.map(n=>'- '+n).join('\n')}\n\n## Viva preparation\n\n${viva(result).map(([q,a])=>`**Q: ${q}**\n\nA: ${a}`).join('\n\n')}\n\n---\nThis teaching report is computed locally from supplied data using a restricted method set. It is not a clinical interpretation or a substitute for statistical supervision. No AI-generated statistical facts.\n`;
  }
  return {csvParse,numeric,missing,summarizeColumns,pearson,welch,apa,viva,plainConclusion,assumptionChecks,reportMarkdown,math:{twoSidedP,tCritical,mean,sd}};
});
