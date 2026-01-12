(function(){
function $(id){return document.getElementById(id);}
function hideSplash(){var sp=$("splash");if(sp){sp.className+=" fadeout";}setTimeout(function(){if(sp)sp.style.display="none";$("main").style.opacity=1;loadManifest();},560);}
window.addEventListener("load",function(){setTimeout(hideSplash,2000);});
var allData=null,currentCat="all";
function loadManifest(){fetch("quizzes/manifest.json",{cache:"no-store"}).then(function(r){return r.json();}).then(function(j){allData=j;buildSeg();render();});}
function cats(){var set={},arr=["すべて"];if(!allData||!allData.quizzes)return arr;for(var i=0;i<allData.quizzes.length;i++){var q=allData.quizzes[i];set[q.category||"その他"]=1;}var keys=Object.keys(set);keys.sort();for(var k=0;k<keys.length;k++){arr.push(keys[k]);}return arr;}
function buildSeg(){var h=$("segments");h.innerHTML="";var cs=cats();for(var i=0;i<cs.length;i++){(function(c,idx){var b=document.createElement("button");b.className="seg"+(idx===0?" seg-active":"");b.innerText=c;b.onclick=function(){var ch=h.children;for(var j=0;j<ch.length;j++){ch[j].classList.remove("seg-active");}b.classList.add("seg-active");currentCat=(c==="すべて")?"all":c;render();};h.appendChild(b);})(cs[i],i);}}
function bestTime(id,mode){try{var arr=JSON.parse(localStorage.getItem("quizRecords:"+id+":"+mode)||"[]");var best=null;for(var i=0;i<arr.length;i++){var r=arr[i];if(r.correct===r.total && typeof r.time==='number'){if(best===null||r.time<best)best=r.time;}}return best;}catch(e){return null;}}
function render(){var list=$("quizList");list.innerHTML="";if(!allData||!allData.quizzes)return;
for(var i=0;i<allData.quizzes.length;i++){
 (function(q){
   if(currentCat!=="all" && (q.category||"その他")!==currentCat) return;
   var wrap=document.createElement("div");wrap.className="card";
   var row=document.createElement("div");row.className="row";
   var h2=document.createElement("h2");h2.innerText=q.title;row.appendChild(h2);
   if(q.category){var pill=document.createElement("span");pill.className="pill";pill.innerText=q.category;row.appendChild(pill);}
   wrap.appendChild(row);
   var p=document.createElement("p");p.className="muted";p.innerText="更新日: "+q.updated;wrap.appendChild(p);

   // fetch each quiz file to know real max count
   fetch("quizzes/"+q.id+".json",{cache:"no-store"}).then(function(r){return r.json();}).then(function(data){
     var maxCount=(data && data.questions)?data.questions.length: (q.count||1);
     var sliderrow=document.createElement("div");sliderrow.className="sliderrow";
     var lab=document.createElement("label");lab.innerText="出題数";sliderrow.appendChild(lab);
     var range=document.createElement("input");range.type="range";range.min="1";range.max=String(maxCount);range.value=String(maxCount);range.className="slider";
     var badge=document.createElement("span");badge.className="badge";badge.innerText=String(maxCount);
     range.oninput=function(){badge.innerText=range.value;};
     sliderrow.appendChild(range);sliderrow.appendChild(badge);wrap.appendChild(sliderrow);

     var row2=document.createElement("div");row2.className="end-actions";
     var nbtn=document.createElement("button");nbtn.className="btn ghost";nbtn.innerText="ノーマル";
     nbtn.onclick=function(){start(q.id, range.value, "normal");};
     var cbtn=document.createElement("button");cbtn.className="btn";cbtn.innerText="チャレンジ";
     cbtn.onclick=function(){start(q.id, range.value, "challenge");};
     row2.appendChild(nbtn);row2.appendChild(cbtn);

     // best time + trophy
     var best=bestTime(q.id,"challenge");var info=document.createElement("span");info.className="small muted";
     if(best!=null){
       info.innerText="⏱"+best.toFixed(2)+"秒";
       var avg=best/maxCount; var trophy=document.createElement("span");trophy.style.marginLeft="6px";
       if(avg<=2){trophy.innerText="👑";}
       else if(avg<=3){trophy.innerText="🥈";}
       else{trophy.innerText="👑";trophy.style.opacity="0.3";}
       info.appendChild(trophy);
     }else{info.innerText="記録なし 👑";info.style.opacity="0.3";}
     row2.appendChild(info);

     wrap.appendChild(row2);
   });
   list.appendChild(wrap);
 })(allData.quizzes[i]);
}
}
function start(id,count,mode){location.href="quiz.html?id="+encodeURIComponent(id)+"&count="+encodeURIComponent(count)+"&mode="+encodeURIComponent(mode);}
})();