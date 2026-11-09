async function diagnoseOverflow(page) {
 return page.evaluate(() => {
  const root=document.documentElement, limit=innerWidth+1, baseline=root.scrollWidth, out=[];
  const label=n=>n.tagName.toLowerCase()+(n.id?'#'+n.id:n.classList.length?'.'+[...n.classList].slice(0,2).join('.'):'');
  const describe=n=>({node:label(n),width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right,client:n.clientWidth,scroll:n.scrollWidth,overflow:getComputedStyle(n).overflowX,min:getComputedStyle(n).minWidth});
  function measure(nodes,property,value){const old=nodes.map(n=>n.getAttribute('style'));try{nodes.forEach(n=>n.style.setProperty(property,value,'important'));return root.scrollWidth;}finally{nodes.forEach((n,i)=>old[i]===null?n.removeAttribute('style'):n.setAttribute('style',old[i]));void root.scrollWidth;}}
  for(const selector of ['input','select','button','details:not([open])','[type=date]','[type=month]','.owner-metrics','#historyList','#quoteWorkspace','#salesPipeline','#commercialCalendar','.sales-command-surface']){
   const nodes=[...document.querySelectorAll(selector)];if(!nodes.length)continue;
   out.push({selector,hide:measure(nodes,'display','none'),clip:measure(nodes,'overflow','hidden'),nodes:nodes.length});
  }
  const controls=[...document.querySelectorAll('input,select')].filter(n=>n.getClientRects().length);
  const controlCauses=controls.map(n=>({...describe(n),hide:measure([n],'display','none'),clip:measure([n],'overflow','hidden')})).filter(n=>n.hide<baseline||n.clip<baseline);
  const reductions=[];
  const candidates=[...document.querySelectorAll('main, main > *, .workspace > *, .team-panel > *, .quote-layout > *, .form-section, .proposal-paper, .summary-panel')];
  for(const n of candidates){const width=measure([n],'display','none');if(width<baseline)reductions.push({...describe(n),without:width});}
  return {baseline,limit,groups:out,controlCauses,reductions,restored:root.scrollWidth};
 });
}
module.exports={diagnoseOverflow};
