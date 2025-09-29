(function(){
  let direction = (localStorage.getItem('direction') || 'go');
  const listeners = [];

  function getDirection(){ return direction; }

  function setDirection(next){
    const val = (next === 'back') ? 'back' : 'go';
    if(val === direction) return;
    direction = val;
    localStorage.setItem('direction', direction);
    updateAllButtons();
    for(const fn of listeners){ try{ fn(direction); }catch(_){} }
  }

  function updateButton(btn){
    if(!btn) return;
    btn.setAttribute('data-dir', direction);
    btn.setAttribute('aria-checked', direction === 'back' ? 'true' : 'false');
    const label = (direction === 'go') ? '現在: 行き。クリックで帰りに切替' : '現在: 帰り。クリックで行きに切替';
    btn.setAttribute('aria-label', label);
  }

  function updateAllButtons(){
    document.querySelectorAll('#dir-toggle').forEach(updateButton);
  }

  function attach(btn){
    if(!btn) return;
    updateButton(btn);
    btn.addEventListener('click', ()=> setDirection(direction === 'go' ? 'back' : 'go'));
    btn.addEventListener('keydown', (e)=>{
      if(e.key === ' ' || e.key === 'Enter'){
        e.preventDefault();
        btn.click();
      }
    });
  }

  function onChange(fn){ if(typeof fn === 'function') listeners.push(fn); }

  window.DirectionToggle = { getDirection, setDirection, attach, onChange, _update:updateAllButtons };
})();

