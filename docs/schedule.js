function pad(n){return String(n).padStart(2,'0')}

function dayTypeLabel(dt){
  return dt === 'weekday' ? '平日' : dt === 'saturday' ? '土曜' : '休日';
}

function lineToClass(line){
  if(line.includes('23')) return 'm-23';
  if(line.includes('25')) return 'm-25';
  if(line.includes('28')) return 'm-28';
  if(line.startsWith('辻') && line.includes('34')) return 'm-t34';
  if(line.startsWith('辻') && line.includes('35')) return 'm-t35';
  return 'm-other';
}

function lineToLegendClass(line){
  if(line.includes('23')) return 'legend-23';
  if(line.includes('25')) return 'legend-25';
  if(line.includes('28')) return 'legend-28';
  if(line.startsWith('辻') && line.includes('34')) return 'legend-t34';
  if(line.startsWith('辻') && line.includes('35')) return 'legend-t35';
  return 'legend-other';
}

function renderTable(targetId, timetable, dayType){
  const root = document.getElementById(targetId);
  root.innerHTML = '';
  const hours = Array.from({length:24}, (_,i)=>i);
  for(const h of hours){
    const row = document.createElement('div');
    row.className = 'tt-row';
    const hh = document.createElement('div');
    hh.className = 'tt-hour';
    hh.textContent = pad(h);
    row.appendChild(hh);

    const mins = [];
    for(const line of Object.keys(timetable)){
      const mlist = (timetable[line]?.[dayType]?.[h]) || [];
      for(const m of mlist){ mins.push({m, line}); }
    }
    mins.sort((a,b)=>a.m-b.m);

    const md = document.createElement('div');
    md.className = 'tt-mins';
    if(mins.length === 0){
      md.innerHTML = '<span class="muted">--</span>';
    }else{
      for(const it of mins){
        const sp = document.createElement('span');
        sp.textContent = pad(it.m);
        sp.className = `ttm ${lineToClass(it.line)}`;
        const desc = timetable[it.line]?.description;
        sp.title = desc ? `${it.line} ${desc}` : it.line;
        md.appendChild(sp);
      }
    }
    row.appendChild(md);
    root.appendChild(row);
  }
}

// Build legend for given (filtered) timetable
function renderLegend(targetId, timetable){
  const legend = document.getElementById(targetId);
  if(!legend) return;
  legend.innerHTML = '';
  for(const line of Object.keys(timetable)){
    const sp = document.createElement('span');
    sp.className = `legend ${lineToLegendClass(line)}`;
    const desc = timetable[line]?.description;
    sp.textContent = desc ? `${desc}` : line;
    legend.appendChild(sp);
  }
}

// Direction toggle (shared)
function initToggle(onChange){
  const btn = document.getElementById('dir-toggle');
  if(btn && window.DirectionToggle){
    window.DirectionToggle.attach(btn);
    if(onChange) window.DirectionToggle.onChange(onChange);
  }
}

function filterTimetableByDirection(all, dir){
  const shonan = {};
  const tsuji = {};
  for(const k of Object.keys(all)){
    const isShonan = k.startsWith('湘');
    const isTsuji = k.startsWith('辻');
    if(isShonan) shonan[k] = all[k];
    if(isTsuji) tsuji[k] = all[k];
  }
  if(dir === 'back') return {shonan, tsuji};
  return {shonan, tsuji:{}};
}

let _timetableAll = null;
let _dayType = 'weekday';

async function main(){
  initToggle(()=>{
    if(!_timetableAll) return;
    const dir = window.DirectionToggle ? window.DirectionToggle.getDirection() : 'go';
    const {shonan, tsuji} = filterTimetableByDirection(_timetableAll, dir);
    renderLegend('legend-shonan', shonan);
    renderTable('table-shonan', shonan, _dayType);
    const hasTsuji = Object.keys(tsuji).length > 0;
    document.getElementById('card-tsuji').style.display = hasTsuji ? '' : 'none';
    if(hasTsuji){
      renderLegend('legend-tsuji', tsuji);
      renderTable('table-tsuji', tsuji, _dayType);
    }
  });
  try{
    const data = await AppUtil.fetchAPI('/timetable', AppUtil.BASE.api);
    _timetableAll = data.timetable || {};
    _dayType = data.dayTypeToday || 'weekday';
    document.getElementById('daytype').textContent = `（${dayTypeLabel(_dayType)}）`;
    const dir = window.DirectionToggle ? window.DirectionToggle.getDirection() : 'go';
    const {shonan, tsuji} = filterTimetableByDirection(_timetableAll, dir);
    renderLegend('legend-shonan', shonan);
    renderTable('table-shonan', shonan, _dayType);
    const hasTsuji = Object.keys(tsuji).length > 0;
    document.getElementById('card-tsuji').style.display = hasTsuji ? '' : 'none';
    if(hasTsuji){
      renderLegend('legend-tsuji', tsuji);
      renderTable('table-tsuji', tsuji, _dayType);
    }
  }catch(e){
    const r1 = document.getElementById('table-shonan');
    if(r1) r1.textContent = '読み込みに失敗しました';
    const r2 = document.getElementById('table-tsuji');
    if(r2) r2.textContent = '';
  }
}

main();
