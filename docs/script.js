function pad(n){return String(n).padStart(2,'0')}

async function fetchJSON(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

async function loadBus(){
  try{
    const data = await fetchJSON('https://digital-twin-bus-server.vercel.app/bus');
    const items = Array.isArray(data.items)? data.items: [];
    const shonan = [];
    const tsuji = [];
    for(const it of items){
      const line = String(it.line||'');
      if(line.startsWith('湘')) shonan.push(it.minutesUntil);
      if(line.startsWith('辻')) tsuji.push(it.minutesUntil);
    }
    document.getElementById('bus-shonan-1').textContent = (shonan[0] ?? '--');
    document.getElementById('bus-shonan-2').textContent = (shonan[1] ?? '--');
    document.getElementById('bus-tsuji-1').textContent = (tsuji[0] ?? '--');
    document.getElementById('bus-tsuji-2').textContent = (tsuji[1] ?? '--');
  }catch(e){
    document.getElementById('bus-shonan-1').textContent = '--';
    document.getElementById('bus-shonan-2').textContent = '--';
    document.getElementById('bus-tsuji-1').textContent = '--';
    document.getElementById('bus-tsuji-2').textContent = '--';
  }
}

async function loadCongestion(){
  try{
    const data = await fetchJSON('https://digital-twin-bus-server.vercel.app/congestion');
    const badge = document.getElementById('crowd');
    const lv = String(data.level||'').toLowerCase();
    const jp = { low: '混雑なし', mid: 'やや混雑', high: '混雑' };
    badge.textContent = `${jp[lv] || '--'}`;
    badge.classList.remove('low','mid','high');
    if(lv==='low'||lv==='mid'||lv==='high') badge.classList.add(lv);
  }catch(e){
    document.getElementById('crowd').textContent = '--';
  }
}

async function loadBike(){
  try{
    const data = await fetchJSON('https://digital-twin-bus-server.vercel.app/bike');
    document.getElementById('bike-avail').textContent = data.total_available ?? '--';
    document.getElementById('bike-return').textContent = data.total_returnable ?? '--';
    const el = document.getElementById('bike-return-secondary');
    if(el){
      if(typeof data.returnable_secondary === 'number'){
        el.textContent = `+${data.returnable_secondary}(駅遠)`;
      }else{
        el.textContent = '+--(駅遠)';
      }
    }
  }catch(e){
    document.getElementById('bike-avail').textContent = '--';
    document.getElementById('bike-return').textContent = '--';
    const el = document.getElementById('bike-return-secondary');
    if(el) el.textContent = '+--(駅遠)';
  }
}

async function loadRideshare(){
  try{
    const data = await fetchJSON('https://digital-twin-bus-server.vercel.app/rideshare');
    const dir = (window.DirectionToggle ? window.DirectionToggle.getDirection() : 'go');
    let aLabel = '湘南台', bLabel = '辻堂';
    let a = null, b = null;
    if(dir === 'go'){
      a = data?.toSchool?.fromSyonandai || {};
      b = data?.toSchool?.fromTsujido || {};
      aLabel = '湘南台から';
      bLabel = '辻堂から';
    }else{
      a = data?.fromSchool?.toSyonandai || {};
      b = data?.fromSchool?.toTsujido || {};
      aLabel = '湘南台まで';
      bLabel = '辻堂まで';
    }
    document.getElementById('rs-col1-label').textContent = aLabel;
    document.getElementById('rs-col2-label').textContent = bLabel;
    document.getElementById('rs-col1-veh').textContent = (a.vehicles ?? '--');
    document.getElementById('rs-col1-min').textContent = (a.untilEarliestMin ?? '--');
    document.getElementById('rs-col2-veh').textContent = (b.vehicles ?? '--');
    document.getElementById('rs-col2-min').textContent = (b.untilEarliestMin ?? '--');
  }catch(e){
    const dir = (window.DirectionToggle ? window.DirectionToggle.getDirection() : 'go');
    document.getElementById('rs-col1-label').textContent = (dir === 'go' ? '湘南台から' : '湘南台まで');
    document.getElementById('rs-col2-label').textContent = (dir === 'go' ? '辻堂から' : '辻堂まで');
    document.getElementById('rs-col1-veh').textContent = '--';
    document.getElementById('rs-col1-min').textContent = '--';
    document.getElementById('rs-col2-veh').textContent = '--';
    document.getElementById('rs-col2-min').textContent = '--';
  }
}

// Direction toggle (shared)
function initToggle(){
  const btn = document.getElementById('dir-toggle');
  if(btn && window.DirectionToggle){
    window.DirectionToggle.attach(btn);
    window.DirectionToggle.onChange(()=>{
      // If future logic depends on direction, refresh data
      refresh();
    });
  }
}

async function refresh(){
  await Promise.all([loadBus(), loadCongestion(), loadBike(), loadRideshare()]);
}

setInterval(refresh, 30000);
initToggle();
refresh();
