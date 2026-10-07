const ages=['7-9','10-12','13-15'];
function choose(age){
 if(!ages.includes(age))age='10-12';
 document.querySelectorAll('.drama-track').forEach(el=>el.hidden=el.dataset.age!==age);
 document.querySelectorAll('button[data-age]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.age===age)));
 const url=new URL(location.href);url.searchParams.set('age',age);history.replaceState(null,'',url);
}
document.querySelectorAll('button[data-age]').forEach(el=>el.onclick=()=>choose(el.dataset.age));
document.getElementById('translations').onclick=()=>{
 const hide=document.body.classList.toggle('no-translations'),button=document.getElementById('translations');
 button.textContent=hide?'显示中文释义':'隐藏中文释义';button.setAttribute('aria-pressed',String(hide));
};
document.getElementById('print-script').onclick=()=>print();
choose(new URLSearchParams(location.search).get('age'));
