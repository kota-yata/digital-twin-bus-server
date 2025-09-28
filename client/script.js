function pad(n){return String(n).padStart(2,'0')}

function updateClock(){
  const d = new Date();
  const s = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  document.getElementById('clock').textContent = s;
}

async function fetchJSON(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

async function loadBus(){
  try{
    const data = await fetchJSON('https://digital-twin-bus-server.vercel.app/bus');
    const items = Array.isArray(data.items)? data.items: [];
    const a = items[0]?.minutesUntil ?? '--';
    const b = items[1]?.minutesUntil ?? '--';
    document.getElementById('bus-next-1').textContent = a;
    document.getElementById('bus-next-2').textContent = b;
  }catch(e){
    document.getElementById('bus-next-1').textContent = '--';
    document.getElementById('bus-next-2').textContent = '--';
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
  }catch(e){
    document.getElementById('bike-avail').textContent = '--';
    document.getElementById('bike-return').textContent = '--';
  }
}

function tick(){
  updateClock();
}

async function refresh(){
  await Promise.all([loadBus(), loadCongestion(), loadBike()]);
}

setInterval(tick, 1000);
setInterval(refresh, 30000);
tick();
refresh();
