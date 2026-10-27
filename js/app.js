(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const els = {
    search:$("search"), type:$("type-filter"), year:$("year-filter"), sort:$("sort"),
    clear:$("clear-filters"), rows:$("release-rows"), mobile:$("mobile-results"),
    table:$("table-wrap"), loading:$("loading"), empty:$("empty"), error:$("error"),
    count:$("result-count"), status:$("source-status"), prev:$("prev"), next:$("next"),
    page:$("page-label"), size:$("page-size"), statReleases:$("stat-releases"),
    statBands:$("stat-bands"), statAnniversaries:$("stat-anniversaries")
  };
  let allReleases = [];
  let currentPage = 1;
  let filtered = [];
  const TYPE_LABELS = {album:"Álbum",ep:"EP",single:"Single",compilation:"Compilação",demo:"Demo",live:"Ao vivo"};
  const clean = value => String(value ?? "").replace(/^\uFEFF/, "").trim();
  // Search normalization does not alter the original text shown to the user.
  const normalize = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/[\u200B-\u200D\uFEFF]/g,"").replace(/\s+/g," ");
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const parseDate = value => {
    const s = clean(value);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]), 12);
    return d.getFullYear()===Number(m[1]) && d.getMonth()===Number(m[2])-1 && d.getDate()===Number(m[3]) ? d : null;
  };
  const dateText = value => {
    const d = parseDate(value);
    return d ? new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric"}).format(d).replace(" de "," ") : (value || "Data desconhecida");
  };
  const today = () => { const d = new Date(); return {month:d.getMonth()+1,day:d.getDate()}; };
  const isAnniversaryToday = release => {
    const d = parseDate(release.data);
    if (!d) return false;
    const t = today();
    // 29 February anniversaries are shown on 28 February in non-leap years.
    return d.getMonth()+1===t.month && d.getDate()===t.day ||
      d.getMonth()===1 && d.getDate()===29 && t.month===2 && t.day===28 && !isLeapYear(new Date().getFullYear());
  };
  const isLeapYear = y => y%4===0 && (y%100!==0 || y%400===0);
  const yearsSince = release => {
    const d = parseDate(release.data);
    if (!d) return null;
    const now = new Date();
    let years = now.getFullYear()-d.getFullYear();
    const beforeAnniversary = now.getMonth()<d.getMonth() || (now.getMonth()===d.getMonth() && now.getDate()<d.getDate());
    if (beforeAnniversary) years--;
    return years;
  };
  const typeLabel = type => TYPE_LABELS[String(type||"").toLowerCase()] || (type ? String(type) : "Não informado");
  const normalizeRecord = row => {
    const keys = Object.keys(row || {});
    const find = wanted => {
      const key = keys.find(k => normalize(k).replace(/[_ -]/g,"") === wanted);
      return key === undefined ? "" : row[key];
    };
    const titulo = clean(find("titulo") || find("title"));
    const data = clean(find("data") || find("date"));
    const banda = clean(find("banda") || find("band"));
    const work_type = clean(find("worktype") || find("tipo") || find("type")).toLowerCase();
    if (!titulo && !banda) return null;
    return {titulo, data, banda, work_type:work_type || "unknown"};
  };
  // CSV parser supports quoted commas, escaped quotes and newlines inside quoted cells.
  const parseCSV = input => {
    const rows=[]; let row=[], field="", quoted=false;
    for(let i=0;i<input.length;i++){
      const c=input[i], n=input[i+1];
      if(quoted){
        if(c === '"' && n === '"'){field+='"';i++;}
        else if(c === '"') quoted=false;
        else field+=c;
      } else if(c === '"' && field.length===0) quoted=true;
      else if(c === ","){row.push(field);field="";}
      else if(c === "\n"){row.push(field);rows.push(row);row=[];field="";}
      else if(c !== "\r") field+=c;
    }
    if(field.length || row.length){row.push(field);rows.push(row);}
    if(!rows.length) return [];
    const headers=rows.shift().map(h=>clean(h).replace(/^"|"$/g,""));
    return rows.filter(r=>r.some(v=>clean(v))).map(r=>Object.fromEntries(headers.map((h,i)=>[h, r[i] ?? ""])));
  };
  const loadData = async () => {
    const url = window.BDRMD_CONFIG && window.BDRMD_CONFIG.SHEET_CSV_URL;
    if(url){
      if(!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\//.test(url) && !/^https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(url))
        throw new Error("A URL configurada não parece ser uma URL pública de CSV do Google Sheets.");
      const response = await fetch(url, {cache:"no-store"});
      if(!response.ok) throw new Error("Não foi possível ler a planilha (HTTP "+response.status+"). Confira se ela foi publicada na web como CSV.");
      const records=parseCSV(await response.text()).map(normalizeRecord).filter(Boolean);
      if(!records.length) throw new Error("A planilha foi acessada, mas nenhum registro foi encontrado. Confira os cabeçalhos: titulo, data, banda, work_type.");
      els.status.textContent="Fonte: IPF";
      return records;
    }
    const response = await fetch("data/releases.json");
    if(!response.ok) throw new Error("Não foi possível carregar data/releases.json.");
    els.status.textContent="Fonte: dados de demonstração";
    return (await response.json()).map(normalizeRecord).filter(Boolean);
  };
  const fillYears = () => {
    const selected=els.year.value;
    const years=[...new Set(allReleases.map(r=>parseDate(r.data)?.getFullYear()).filter(Boolean))].sort((a,b)=>b-a);
    els.year.innerHTML='<option value="">Todos os anos</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join("");
    if(years.includes(Number(selected))) els.year.value=selected;
  };
  const anniversaryText = r => {
    if(isAnniversaryToday(r)){
      const age=yearsSince(r);
      return age>0 ? `Faz ${age} ${age===1?"ano":"anos"} hoje` : "Lançado nesta data";
    }
    return "—";
  };
  const recordHTML = r => `<tr>
    <td class="band-cell">${escapeHTML(r.banda || "—")}</td>
    <td class="title-cell">${escapeHTML(r.titulo || "—")}</td>
    <td class="date-cell">${escapeHTML(dateText(r.data))}</td>
    <td><span class="type-pill">${escapeHTML(typeLabel(r.work_type))}</span></td>
    <td><span class="anniversary ${isAnniversaryToday(r)?"":"none"}">${escapeHTML(anniversaryText(r))}</span></td>
  </tr>`;
  const cardHTML = r => `<article class="release-card">
    <div class="card-top"><span class="card-band">${escapeHTML(r.banda || "Banda não informada")}</span><span class="type-pill">${escapeHTML(typeLabel(r.work_type))}</span></div>
    <h3 class="card-title">${escapeHTML(r.titulo || "Título não informado")}</h3>
    <div class="card-meta"><span>${escapeHTML(dateText(r.data))}</span><span>${escapeHTML((r.data||"").slice(0,4))}</span></div>
    ${isAnniversaryToday(r)?`<div class="card-anniversary">★ ${escapeHTML(anniversaryText(r))}</div>`:""}
  </article>`;
  const sortRecords = records => {
    const collator=new Intl.Collator("pt-BR",{sensitivity:"base",numeric:true});
    const key=els.sort.value;
    return records.sort((a,b)=>{
      if(key==="date-asc" || key==="date-desc"){
        const av=parseDate(a.data)?.getTime() ?? 0, bv=parseDate(b.data)?.getTime() ?? 0;
        return key==="date-asc" ? av-bv : bv-av;
      }
      const av=key==="band-asc"?a.banda:a.titulo, bv=key==="band-asc"?b.banda:b.titulo;
      return collator.compare(av||"",bv||"") || collator.compare(a.titulo||"",b.titulo||"");
    });
  };
  const render = () => {
    const query=normalize(els.search.value), type=els.type.value, year=els.year.value;
    filtered=sortRecords(allReleases.filter(r=>{
      const matchesQuery=!query || normalize([r.banda,r.titulo,r.data,r.work_type].join(" ")).includes(query);
      const matchesType=!type || r.work_type===type;
      const matchesYear=!year || (parseDate(r.data)?.getFullYear()===Number(year));
      return matchesQuery && matchesType && matchesYear;
    }));
    const pageSize=Number(els.size.value), pages=Math.max(1,Math.ceil(filtered.length/pageSize));
    currentPage=Math.min(Math.max(1,currentPage),pages);
    const start=(currentPage-1)*pageSize, pageItems=filtered.slice(start,start+pageSize);
    els.rows.innerHTML=pageItems.map(recordHTML).join("");
    els.mobile.innerHTML=pageItems.map(cardHTML).join("");
    els.table.hidden=pageItems.length===0;
    els.mobile.hidden=pageItems.length===0;
    els.empty.hidden=filtered.length!==0;
    els.loading.hidden=true;
    els.count.textContent=filtered.length===allReleases.length
      ? `${filtered.length.toLocaleString("pt-BR")} registros`
      : `${filtered.length.toLocaleString("pt-BR")} de ${allReleases.length.toLocaleString("pt-BR")} registros`;
    els.page.textContent=`Página ${currentPage} de ${pages}`;
    els.prev.disabled=currentPage<=1; els.next.disabled=currentPage>=pages;
    els.statReleases.textContent=allReleases.length.toLocaleString("pt-BR");
    els.statBands.textContent=new Set(allReleases.map(r=>normalize(r.banda)).filter(Boolean)).size.toLocaleString("pt-BR");
    els.statAnniversaries.textContent=allReleases.filter(isAnniversaryToday).length.toLocaleString("pt-BR");
  };
  const resetPageAndRender=()=>{currentPage=1;render();};
  [els.search,els.type,els.year,els.sort,els.size].forEach(el=>el.addEventListener(el===els.search?"input":"change",resetPageAndRender));
  els.clear.addEventListener("click",()=>{els.search.value="";els.type.value="";els.year.value="";els.sort.value="date-desc";currentPage=1;render();});
  els.prev.addEventListener("click",()=>{currentPage--;render();});
  els.next.addEventListener("click",()=>{currentPage++;render();});
  loadData().then(records=>{
    allReleases=records;
    fillYears();
    els.error.hidden=true;
    render();
  }).catch(err=>{
    els.loading.hidden=true; els.error.hidden=false;
    els.error.textContent=err.message+" Para testar sem Google Sheets, deixe SHEET_CSV_URL vazio em config.js.";
    els.status.textContent="Erro ao carregar dados";
    console.error(err);
  });
})();
