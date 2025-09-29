function pad(n){return String(n).padStart(2,'0')}

async function loadBus(){
  function nextTwoFromTimetable(data, groupMarker){
    const tt = data?.timetable || {};
    const day = data?.dayTypeToday || 'weekday';
    const now = new Date();
    const nowMin = now.getHours()*60 + now.getMinutes();
    const mins = [];
    for(const line of Object.keys(tt)){
      if(!line.includes(groupMarker)) continue;
      const dayTbl = tt[line]?.[day] || {};
      for(const hStr of Object.keys(dayTbl)){
        const h = Number(hStr);
        const arr = Array.isArray(dayTbl[h]) ? dayTbl[h] : [];
        for(const m of arr){
          const t = h*60 + Number(m);
          let delta = t - nowMin;
          if(delta < 0) delta += 24*60; // wrap to next day if needed
          mins.push(delta);
        }
      }
    }
    mins.sort((a,b)=>a-b);
    return [mins[0] ?? '--', mins[1] ?? '--'];
  }

  try{
    const dir = AppUtil.direction();
    const endpoint = (dir === 'go') ? '/timetable/to-school' : '/timetable/from-school';
    const data = await AppUtil.fetchAPI(endpoint, AppUtil.BASE.api);
    const [s1,s2] = nextTwoFromTimetable(data, '湘');
    const [t1,t2] = nextTwoFromTimetable(data, '辻');
    AppUtil.setText('bus-shonan-1', s1);
    AppUtil.setText('bus-shonan-2', s2);
    AppUtil.setText('bus-tsuji-1', t1);
    AppUtil.setText('bus-tsuji-2', t2);
  }catch(e){
    AppUtil.setText('bus-shonan-1', '--');
    AppUtil.setText('bus-shonan-2', '--');
    AppUtil.setText('bus-tsuji-1', '--');
    AppUtil.setText('bus-tsuji-2', '--');
  }
}

async function loadCongestion(){
  try{
    const data = await AppUtil.fetchAPI('/congestion', AppUtil.BASE.api);
    const badge = document.getElementById('crowd');
    const lv = String(data.level||'').toLowerCase();
    const jp = { low: '混雑なし', mid: 'やや混雑', high: '混雑' };
    badge.textContent = `${jp[lv] || '--'}`;
    badge.classList.remove('low','mid','high');
    if(lv==='low'||lv==='mid'||lv==='high') badge.classList.add(lv);
  }catch(e){
    AppUtil.setText('crowd', '--');
  }
}

async function loadBike(){
  async function getData(){ return AppUtil.fetchAPI('/bike-direction', AppUtil.BASE.api); }
  try{
    const data = await getData();
    const dir = AppUtil.direction();
    const leftLabel = document.getElementById('bike-left-label');
    const rightLabel = document.getElementById('bike-right-label');
    const leftUnit = document.getElementById('bike-left-unit');
    const rightUnit = document.getElementById('bike-right-unit');
    const rightSmall = document.getElementById('bike-return-secondary');
    if(dir === 'go'){
      if(leftLabel) leftLabel.textContent = 'SFC前 返却';
      if(rightLabel) rightLabel.textContent = '湘南台駅前 貸出';
      if(leftUnit) leftUnit.textContent = '台空';
      if(rightUnit) rightUnit.textContent = '台有';
      AppUtil.setText('bike-avail', data?.go?.sfc_returnable);
      const pri = data?.go?.shonandai_rentable?.primary;
      const sec = data?.go?.shonandai_rentable?.secondary;
      AppUtil.setText('bike-return', (typeof pri === 'number') ? pri : '--');
      rightSmall.textContent = (typeof sec === 'number') ? `+${sec}(駅遠)` : '+--(駅遠)';
    }else{
      if(leftLabel) leftLabel.textContent = 'SFC前 貸出';
      if(rightLabel) rightLabel.textContent = '湘南台駅前 返却';
      if(leftUnit) leftUnit.textContent = '台有';
      if(rightUnit) rightUnit.textContent = '台空';
      AppUtil.setText('bike-avail', data?.back?.sfc_rentable);
      const pri = data?.back?.shonandai_returnable?.primary;
      const sec = data?.back?.shonandai_returnable?.secondary;
      AppUtil.setText('bike-return', (typeof pri === 'number') ? pri : '--');
      rightSmall.textContent = (typeof sec === 'number') ? `+${sec}(駅遠)` : '+--(駅遠)';
    }
  }catch(e){
    AppUtil.setText('bike-avail', '--');
    AppUtil.setText('bike-return', '--');
    const el = document.getElementById('bike-return-secondary');
    if(el) el.textContent = '+--(駅遠)';
  }
}

async function loadRideshare(){
  try{
    const data = await AppUtil.fetchAPI('/rideshare', AppUtil.BASE.rideshare);
    const dir = AppUtil.direction();
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
    AppUtil.setText('rs-col1-label', aLabel);
    AppUtil.setText('rs-col2-label', bLabel);
    AppUtil.setText('rs-col1-veh', a.vehicles);
    AppUtil.setText('rs-col1-min', a.untilEarliestMin);
    AppUtil.setText('rs-col2-veh', b.vehicles);
    AppUtil.setText('rs-col2-min', b.untilEarliestMin);
  }catch(e){
    const dir = AppUtil.direction();
    AppUtil.setText('rs-col1-label', (dir === 'go' ? '湘南台から' : '湘南台まで'));
    AppUtil.setText('rs-col2-label', (dir === 'go' ? '辻堂から' : '辻堂まで'));
    AppUtil.setText('rs-col1-veh', '--');
    AppUtil.setText('rs-col1-min', '--');
    AppUtil.setText('rs-col2-veh', '--');
    AppUtil.setText('rs-col2-min', '--');
  }
}

// Direction toggle (shared)
function initToggle(){
  const btn = document.getElementById('dir-toggle');
  if(btn && window.DirectionToggle){
    window.DirectionToggle.attach(btn);
    window.DirectionToggle.onChange(()=>{
      updateBusTitles();
      // If future logic depends on direction, refresh data
      refresh();
    });
  }
}

function updateBusTitles(){
  const dir = AppUtil.direction();
  const s = document.getElementById('bus-title-shonan');
  const t = document.getElementById('bus-title-tsuji');
  if(!s || !t) return;
  if(dir === 'go'){
    s.textContent = '湘南台から';
    t.textContent = '辻堂から';
  }else{
    s.textContent = '湘南台行き';
    t.textContent = '辻堂行き';
  }
}

async function refresh(){
  await Promise.all([loadBus(), loadCongestion(), loadBike(), loadRideshare()]);
}

setInterval(refresh, 30000);
initToggle();
updateBusTitles();
refresh();
