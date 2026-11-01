async function collectTextContrast(page) {
 return page.evaluate(() => {
  const failures=[],skipped=[],checkedTargets=[],seen=new Set();let checked=0,skippedTotal=0;
  const rgba=value=>{if(!/^rgba?\(/.test(value))return null;const x=value.match(/[\d.]+/g).map(Number);return [x[0],x[1],x[2],x[3]===undefined?1:x[3]];};
  const blend=(top,bottom)=>top.slice(0,3).map((c,i)=>c*top[3]+bottom[i]*(1-top[3]));
  const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  function coveringPseudo(el){return ['::before','::after'].some(pseudo=>{const s=getComputedStyle(el,pseudo),c=rgba(s.backgroundColor);return s.content!=='none'&&s.content!=='normal'&&s.position==='absolute'&&[s.top,s.right,s.bottom,s.left].every(v=>v==='0px')&&(s.backgroundImage!=='none'||c&&c[3]>0);});}
  function background(el){const ancestors=[];for(let p=el;p;p=p.parentElement){const s=getComputedStyle(p);if(Number(s.opacity)!==1||s.filter!=='none'||coveringPseudo(p))return null;ancestors.push(s);}const layers=[];for(const s of ancestors){const c=rgba(s.backgroundColor);if(!c||s.backgroundImage!=='none')return null;layers.push(c);if(c[3]===1){let result=c.slice(0,3);for(let i=layers.length-2;i>=0;i--)result=blend(layers[i],result);return result;}}return null;}
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){
   const text=node.textContent.trim(),el=node.parentElement;
   if(!text||!el||el.closest('script,style,svg,[hidden],[aria-hidden="true"],button:disabled,input:disabled'))continue;
   const range=document.createRange();range.selectNodeContents(node);if(![...range.getClientRects()].some(r=>r.width>=2&&r.height>=2))continue;
   const s=getComputedStyle(el);if(s.visibility!=='visible')continue;
   const selector=el.id?'#'+el.id:el.tagName.toLowerCase()+[...el.classList].slice(0,3).map(c=>'.'+c).join('');
   const fg=rgba(s.color),bg=background(el);
   if(!fg||!bg){skippedTotal++;if(skipped.length<12)skipped.push({selector,reason:'image-gradient-covering-pseudo-opacity-or-unsupported-color'});continue;}
   const painted=blend(fg,bg),a=luminance(painted),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   const size=parseFloat(s.fontSize),weight=parseFloat(s.fontWeight)||400,minimum=size>=24||(size>=18.6667&&weight>=700)?3:4.5;
   const target=el.getAttribute('data-contrast-target');if(target)checkedTargets.push(target);
   const key=selector+'|'+s.color+'|'+bg+'|'+size+'|'+minimum;if(seen.has(key))continue;seen.add(key);checked++;
   if(ratio+.0001<minimum){const ancestry=[];for(let p=el;p&&ancestry.length<4;p=p.parentElement)ancestry.push(p.tagName.toLowerCase()+(p.id?'#'+p.id:'')+[...p.classList].map(c=>'.'+c).join(''));failures.push({selector,ancestry,text:text.slice(0,90),foreground:s.color,background:bg,fontSize:size,fontWeight:weight,minimum,ratio:Number(ratio.toFixed(3))});}
  }
  return {checked,checkedTargets,failures,skippedTotal,skipped,scope:'Visible DOM text over known opaque compositable backgrounds, WCAG AA thresholds only. Images, gradients, covering pseudos, group opacity/filter and unknown transparent canvas are excluded; not full WCAG, AAA or assistive-technology certification.'};
 });
}
module.exports={collectTextContrast};
