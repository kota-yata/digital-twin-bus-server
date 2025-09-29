
(function(){

  async function fetchFrom(url){
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error(`${url} ${res.status}`);
    return res.json();
  }

  async function fetchAPI(path, base){
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = (base && !p.startsWith('http')) ? `${base}${p}` : p;
    return fetchFrom(url);
  }

  function setText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = (value ?? '--');
  }

  function direction(){
    return (window.DirectionToggle ? window.DirectionToggle.getDirection() : 'go');
  }

  const BASE = {
    api: 'https://digital-twin-bus-server.vercel.app',
    // api: 'http://localhost:3000',
    rideshare: 'https://kawaemon.com',
  };

  window.AppUtil = { fetchAPI, setText, direction, BASE };
})();
