function pad(n){return String(n).padStart(2,'0')}

function updateClock(){
  const d = new Date();
  document.getElementById('clock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function fetchJSON(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

function dayTypeLabel(dt){
  return dt === 'weekday' ? '平日' : dt === 'saturday' ? '土曜' : '休日';
}

function lineToClass(line){
  if(line.includes('23')) return 'm-23';
  if(line.includes('25')) return 'm-25';
  if(line.includes('28')) return 'm-28';
  return 'm-other';
}

function renderTable(timetable, dayType){
  const root = document.getElementById('table');
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
        sp.title = it.line;
        md.appendChild(sp);
      }
    }
    row.appendChild(md);
    root.appendChild(row);
  }
}

async function main(){
  updateClock();
  setInterval(updateClock, 1000);
  try{
    const data = await fetchJSON('https://digital-twin-bus-server.vercel.app/timetable');
    document.getElementById('daytype').textContent = `（${dayTypeLabel(data.dayTypeToday)}）`;
    renderTable(data.timetable, data.dayTypeToday);
  }catch(e){
    const root = document.getElementById('table');
    root.textContent = '読み込みに失敗しました';
  }
}

main();

