/* ==========================================================================
   M Perfumerie — Experiencia de inicio (prototipo experimental)
   1) Intro de marca  2) Carrusel de campaña  3) Transición al catálogo
   No toca productos, buscador, filtros, carrito ni WhatsApp: solo escucha
   el evento "mp:flyers" (flyers del admin) y usa window.mpOpenBrand si existe.
   ========================================================================== */
(function(){
  'use strict';
  var doc = document, root = doc.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('xp-js');
  if(/[?&]placeholders=1/.test(location.search)) root.classList.add('xp-show-ph');

  function onReady(fn){ if(doc.readyState !== 'loading') fn(); else doc.addEventListener('DOMContentLoaded', fn); }

  /* ------------------------------------------------------------ 1) INTRO */
  var introDone = false, introListeners = [];
  function whenIntroDone(fn){ if(introDone) fn(); else introListeners.push(fn); }
  function finishIntro(){
    if(introDone) return;
    introDone = true;
    try{ sessionStorage.setItem('xpIntroSeen', '1'); }catch(e){}
    var el = doc.getElementById('xpIntro');
    if(el && el.parentNode) el.parentNode.removeChild(el);
    doc.removeEventListener('keydown', onIntroKey);
    introListeners.splice(0).forEach(function(fn){ fn(); });
  }
  function onIntroKey(e){ if(e.key === 'Escape') skipIntro(); }
  function skipIntro(){
    var el = doc.getElementById('xpIntro');
    if(!el || el.classList.contains('is-leaving')) return;
    el.classList.add('is-leaving');
    setTimeout(finishIntro, 520);
  }
  function initIntro(){
    var el = doc.getElementById('xpIntro');
    // la barra de carga del logo la maneja el script que está dentro del index (arranca antes que este archivo)
    if(!el || window.__xpIntroFinished || reduceMotion || getComputedStyle(el).display === 'none'){ finishIntro(); return; }
    window.addEventListener('xp:introdone', finishIntro);
    window.__xpIntroSkip = function(){ introListeners.splice(0).forEach(function(fn){ fn(); }); skipIntro(); };
    if(el.classList.contains('is-complete')) window.__xpIntroSkip();
    el.addEventListener('animationend', function(e){ if(e.target === el && el.classList.contains('is-leaving')) finishIntro(); });
    el.addEventListener('click', skipIntro);
    doc.addEventListener('keydown', onIntroKey);
    setTimeout(finishIntro, 8000); // red de seguridad
  }

  /* ------------------------------------------------------------ 2) CARRUSEL */
  function initCarousel(){
    var section = doc.getElementById('top');
    var vp = doc.getElementById('xpViewport');
    if(!section || !vp) return;
    var prev = doc.getElementById('xpPrev'), next = doc.getElementById('xpNext');
    var dotsWrap = doc.getElementById('xpDots'), counter = doc.getElementById('xpCounter'), live = doc.getElementById('xpLive');
    var slides = [], index = 0, dragged = false;

    function collect(){ slides = Array.prototype.slice.call(vp.querySelectorAll('.xp-slide')); }
    function pad(n){ return (n < 10 ? '0' : '') + n; }

    function buildDots(){
      dotsWrap.innerHTML = '';
      slides.forEach(function(s, i){
        s.setAttribute('aria-label', (i + 1) + ' de ' + slides.length + (s.dataset.title ? ': ' + s.dataset.title : ''));
        var b = doc.createElement('button');
        b.type = 'button'; b.className = 'xp-dot';
        b.setAttribute('aria-label', 'Ir a la campaña ' + (i + 1) + (s.dataset.title ? ' (' + s.dataset.title + ')' : ''));
        b.addEventListener('click', function(){ goTo(i); });
        dotsWrap.appendChild(b);
      });
    }

    function setActive(i, announce){
      index = Math.max(0, Math.min(slides.length - 1, i));
      slides.forEach(function(s, k){
        var on = k === index;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
        // los elementos de slides no visibles no reciben foco con Tab
        Array.prototype.forEach.call(s.querySelectorAll('a,button'), function(el){ if(on) el.removeAttribute('tabindex'); else el.setAttribute('tabindex','-1'); });
        if(on && introDone) s.classList.add('is-shown');
      });
      Array.prototype.forEach.call(dotsWrap.children, function(d, k){ d.setAttribute('aria-current', k === index ? 'true' : 'false'); });
      if(prev) prev.classList.toggle('is-hidden', index === 0);
      if(next) next.classList.toggle('is-hidden', index === slides.length - 1);
      section.classList.toggle('is-single', slides.length < 2);
      if(announce && live) live.textContent = 'Campaña ' + (index + 1) + ' de ' + slides.length + (slides[index].dataset.title ? ': ' + slides[index].dataset.title : '');
    }

    function goTo(i){
      i = Math.max(0, Math.min(slides.length - 1, i));
      vp.scrollTo({ left: i * vp.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
      setActive(i, true);
    }

    // índice según el scroll (deslizar con el dedo/trackpad es nativo por scroll-snap)
    var ticking = false;
    vp.addEventListener('scroll', function(){
      if(ticking) return; ticking = true;
      requestAnimationFrame(function(){
        ticking = false;
        var i = Math.round(vp.scrollLeft / Math.max(1, vp.clientWidth));
        if(i !== index) setActive(i, true);
      });
    }, { passive:true });

    if(prev) prev.addEventListener('click', function(){ goTo(index - 1); });
    if(next) next.addEventListener('click', function(){ goTo(index + 1); });

    // teclado cuando el carrusel tiene el foco
    vp.addEventListener('keydown', function(e){
      if(e.target !== vp) return;
      if(e.key === 'ArrowRight'){ e.preventDefault(); goTo(index + 1); }
      else if(e.key === 'ArrowLeft'){ e.preventDefault(); goTo(index - 1); }
      else if(e.key === 'Home'){ e.preventDefault(); goTo(0); }
      else if(e.key === 'End'){ e.preventDefault(); goTo(slides.length - 1); }
    });

    // arrastrar con el mouse (en touch lo resuelve el scroll nativo)
    var down = false, startX = 0, startLeft = 0;
    vp.addEventListener('pointerdown', function(e){
      if(e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; dragged = false; startX = e.clientX; startLeft = vp.scrollLeft;
    });
    window.addEventListener('pointermove', function(e){
      if(!down) return;
      var dx = e.clientX - startX;
      if(!dragged && Math.abs(dx) > 6){ dragged = true; vp.classList.add('is-dragging'); }
      if(dragged) vp.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', function(e){
      if(!down) return; down = false;
      if(!dragged) return;
      vp.classList.remove('is-dragging');
      var dx = e.clientX - startX, w = vp.clientWidth, base = Math.round(startLeft / w);
      goTo(Math.abs(dx) > w * 0.12 ? base + (dx < 0 ? 1 : -1) : base);
    });
    // un arrastre no debe contar como click en un botón o flyer
    vp.addEventListener('click', function(e){ if(dragged){ e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);

    // al cambiar el tamaño de la ventana, mantener el slide actual alineado
    var rT;
    window.addEventListener('resize', function(){ clearTimeout(rT); rT = setTimeout(function(){ vp.scrollTo({ left: index * vp.clientWidth, behavior:'auto' }); }, 120); });

    // flyers administrados desde admin.html (evento emitido por index.html)
    var esc = function(t){ return String(t || '').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
    function addFlyers(lista){
      Array.prototype.forEach.call(vp.querySelectorAll('.xp-slide--flyer'), function(el){ el.remove(); });
      (lista || []).forEach(function(f){
        var titulo = f.titulo || f.marca || 'Campaña';
        var el = doc.createElement('div');
        el.className = 'xp-slide xp-slide--flyer is-shown';
        el.setAttribute('role', 'group');
        el.setAttribute('aria-roledescription', 'slide');
        el.dataset.title = titulo;
        el.dataset.brand = f.marca || '';
        el.innerHTML = '<picture><source media="(max-width:760px)" srcset="' + esc(f.mobile) + '"><img src="' + esc(f.pc) + '" alt="' + esc(titulo) + '" loading="lazy" draggable="false"></picture>' +
          '<button type="button" class="xp-sr">Ver perfumes ' + esc(f.marca || titulo) + '</button>';
        el.addEventListener('click', function(){
          if(el.dataset.brand && typeof window.mpOpenBrand === 'function') window.mpOpenBrand(el.dataset.brand, f); // f: datos del flyer (para mostrar primero sus perfumes)
        });
        vp.appendChild(el);
      });
      collect(); buildDots(); setActive(index, false);
    }
    window.addEventListener('mp:flyers', function(e){ addFlyers(e.detail); });
    if(window.__mpFlyers) addFlyers(window.__mpFlyers);

    collect(); buildDots(); setActive(0, false);
    whenIntroDone(function(){ slides.forEach(function(s, k){ if(k === index || s.classList.contains('xp-slide--flyer')) s.classList.add('is-shown'); }); });
    // al llegar a un slide por primera vez, su contenido entra con animación
    vp.addEventListener('scroll', function(){ if(introDone && slides[index]) slides[index].classList.add('is-shown'); }, { passive:true });

    // indicación "Explorar la colección" → baja suave al catálogo del inicio
    var cue = doc.getElementById('xpCue');
    if(cue) cue.addEventListener('click', function(){
      var target = doc.querySelector('.quick-cats') || doc.getElementById('tendencias');
      if(target){
        var y = target.getBoundingClientRect().top + window.pageYOffset - 70;
        window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    });
  }

  /* ------------------------------------------------------------ 3) TRANSICIÓN AL CATÁLOGO */
  function initReveal(){
    if(reduceMotion || !('IntersectionObserver' in window)) return;
    // la cinta de marcas se pausa cuando no está en pantalla
    var strip = doc.querySelector('.brands-strip');
    if(strip) new IntersectionObserver(function(en){ strip.classList.toggle('is-offscreen', !en[0].isIntersecting); }).observe(strip);
    var targets = doc.querySelectorAll('.gender-cats .gender-grid, .contact-grid'); // la cinta de marcas ya no se oculta hasta llegar: siempre visible
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin:'0px 0px -8% 0px', threshold:0.08 });
    Array.prototype.forEach.call(targets, function(t){
      // lo que ya está en pantalla al cargar no se oculta
      if(t.getBoundingClientRect().top < window.innerHeight) return;
      t.classList.add('xp-reveal'); io.observe(t);
    });
  }


  /* ------------------------------------------------------------ 4) PORTADA INTERACTIVA */
  function initHero(){
    var hero = doc.getElementById('xpHero');
    if(!hero) return;
    var canvas = doc.getElementById('xpDust');
    var mq = window.matchMedia('(max-width:760px)');

    // --- perfumes flotando: cada frasco es una capa recortada (Higgsfield) sobre un fondo limpio sin frascos.
    // Las capas son del mismo tamaño que la foto, así que alineadas quedan idénticas a la original.
    var FB = 'https://firebasestorage.googleapis.com/v0/b/m-perfumerie.firebasestorage.app/o/productos%2F_experimental%2F';
    function U(n, t){ return FB + n + '?alt=media&token=' + t; }
    var SCENES = {
      pc: { w:1536, h:850, fondo:U('hero-pc-v2-fondo.jpg','4c880bde-33dd-4e6d-bb5d-e094dbade37d'), marco:U('hero-pc-v2-marco.webp','58e5eada-51f4-412a-80e3-5fcc988dc69b'),
        capas:[ // orden: de atrás hacia adelante. fy = px que sube, fr = grados que gira (muy leve).
          // Los frascos que en la foto se tocan (dorado + Lancôme) comparten movimiento y centro de giro, así la unión nunca se abre.
          { src:U('hero-pc-v2-capa-armani.webp','dd1292fc-7921-49d8-8112-e017ce8a23d8'),   ox:46.9, oy:26.9, fy:3.5, fx:-1, fr:-0.7, dur:9.4,  delay:-3.1 },
          { src:U('hero-pc-v2-capa-rayo.webp','92dd977a-4213-4877-ba07-46b141ac64eb'),     ox:70.0, oy:34.2, fy:4,   fx:1,  fr:0.8,  dur:10.8, delay:-5.2 },
          { src:U('hero-pc-v2-capa-mariposa.webp','4291d669-e47f-4058-8a0a-2bda5ee00140'), ox:85.7, oy:54.3, fy:3.5, fx:-1, fr:-0.9, dur:10.1, delay:-1.7 },
          { src:U('hero-pc-v2-capa-jpg.webp','80416902-7ec6-461c-9c2a-8d962583572a'),      ox:38, oy:54, fy:3.5, fx:1, fr:0.5, dur:11.2, delay:-0.6 },
          { src:U('hero-pc-v2-capa-valentino.webp','e535298c-b43d-4090-b91e-6ada730063d1'),ox:65.4, oy:69.3, fy:3,   fx:1,  fr:0.65, dur:9.8,  delay:-6.4 },
          { src:U('hero-pc-v2-capa-lancome.webp','12c88559-82e1-43f4-a04a-f64b7cc055e4'),  ox:38, oy:54, fy:3.5, fx:1, fr:0.5, dur:11.2, delay:-0.6 }
        ] },
      mobile: { w:941, h:1672, fondo:U('hero-mobile-fondo.jpg','fe025b34-7e1a-4eb6-a54f-184d10cf8115'),
        capas:[
          { src:U('hero-mobile-capa-armani.webp','af11bf6a-056b-4112-8419-cb24798a1757'),   ox:43.8, oy:35.0, fy:3.6, fx:-1, fr:-0.7, dur:9.4,  delay:-3.1 },
          { src:U('hero-mobile-capa-rayo.webp','568f7998-91fc-4f7f-b99a-7d38a1c2c239'),     ox:70.5, oy:42.6, fy:4.0, fx:1, fr:0.8,  dur:10.8,  delay:-5.2 },
          { src:U('hero-mobile-capa-mariposa.webp','2ffe6e1a-3303-4d12-a281-48277a2468dd'), ox:84.8, oy:55.1, fy:3.6, fx:-1, fr:-0.9, dur:10.1,  delay:-1.7 },
          { src:U('hero-mobile-capa-jpg.webp','4b9432d1-13ab-4658-8ba9-81314b01384e'),      ox:40, oy:60, fy:3.5, fx:1, fr:0.45, dur:11.2, delay:-0.6 },
          { src:U('hero-mobile-capa-lancome.webp','7f08a1eb-099e-46ab-8806-91e3b9282abd'),  ox:40, oy:60, fy:3.5, fx:1, fr:0.45, dur:11.2, delay:-0.6 },
          { src:U('hero-mobile-capa-valentino.webp','eb1ca87d-608b-4644-9b2f-2d313bdc2165'),ox:40, oy:60, fy:3.5, fx:1, fr:0.45, dur:11.2, delay:-0.6 }
        ] }
    };
    var layer = doc.getElementById('xpHeroLayer'), scene = null, sceneKey = '';
    function fit(){ // mismo encuadre que object-fit:cover centrado
      if(!scene) return;
      var cfgS = SCENES[sceneKey], W = layer.clientWidth, H = layer.clientHeight;
      var sc = Math.max(W / cfgS.w, H / cfgS.h), w = cfgS.w * sc, h = cfgS.h * sc;
      scene.style.width = w + 'px'; scene.style.height = h + 'px';
      scene.style.left = (W - w) / 2 + 'px'; scene.style.top = (H - h) / 2 + 'px';
      scene.style.setProperty('--sc', Math.max(.6, sc).toFixed(3));
    }
    function buildScene(){
      if(reduceMotion || !layer) return;
      var key = mq.matches ? 'mobile' : 'pc';
      if(key === sceneKey){ fit(); return; }
      sceneKey = key;
      if(scene) scene.remove();
      var cfgS = SCENES[key];
      scene = doc.createElement('div'); scene.className = 'xp-scene';
      var html = '<img class="xp-scene-img" src="' + cfgS.fondo + '" alt="" draggable="false">';
      cfgS.capas.forEach(function(c){
        html += '<img class="xp-scene-img xp-bottle-layer" src="' + c.src + '" alt="" draggable="false" style="transform-origin:' + c.ox + '% ' + c.oy + '%;' +
          '--fy:' + c.fy + ';--fx:' + c.fx + ';--fr:' + c.fr + 'deg;--dur:' + c.dur + 's;--delay:' + c.delay + 's">';
      });
      if(cfgS.marco) html += '<img class="xp-scene-img" src="' + cfgS.marco + '" alt="" draggable="false">';
      scene.innerHTML = html;
      layer.appendChild(scene); fit();
      var imgs = scene.querySelectorAll('img'), left = imgs.length, done = false, el = scene;
      function ok(){ if(done) return; if(--left <= 0){ done = true; el.classList.add('is-ready'); } }
      Array.prototype.forEach.call(imgs, function(im){
        if(im.complete && im.naturalWidth) ok();
        else { im.addEventListener('load', ok); im.addEventListener('error', function(){ done = true; el.remove(); if(scene === el){ scene = null; sceneKey = ''; } }); }
      });
    }
    // EXPERIMENTAL 2: foto fija, los perfumes no flotan (queda la foto del <picture> del index)
    var STATIC_HERO = true;
    if(!STATIC_HERO){
      buildScene();
      var fT; window.addEventListener('resize', function(){ clearTimeout(fT); fT = setTimeout(buildScene, 150); });
    }

    /* polvo dorado + "rocío" al tocar */
    if(!canvas || reduceMotion || !canvas.getContext) return;
    var ctx = canvas.getContext('2d'), W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var dust = [], mist = [], running = false, visible = true, lastT = 0;
    var emit = true, target = 0, spawnAcc = 0, sized = false, gA = 1; // gA: brillo general (se apaga suave al bajar)
    // al cambiar el tamaño (en el celular pasa al bajar, cuando se esconde la barra del navegador)
    // los destellos NO se vuelven a crear: siguen su camino, solo se reacomodan (así no hay "saltos" de loop)
    function resize(){
      var r = canvas.getBoundingClientRect(), nW = r.width, nH = r.height;
      if(!nW || !nH) return;
      if(sized){ var sx = nW / W, sy = nH / H; dust.forEach(function(p){ p.x *= sx; p.y *= sy; }); }
      W = nW; H = nH;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      target = W < 760 ? 26 : 80; // cantidad de destellos (celular : compu)
      if(!sized){ sized = true; for(var i = 0; i < target; i++) dust.push(newDust(true)); } // al entrar ya hay destellos
    }
    function newDust(anyY){
      // nacen en la franja de abajo (más cerca de "Ver catálogo") y suben despacio
      var x = Math.random() < .45 ? W * (.06 + Math.random() * .42) : Math.random() * W;
      var y = anyY ? H - Math.pow(Math.random(), 1.4) * H * .95 : H * (.84 + Math.random() * .2);
      return { x: x, y: y, z: .3 + Math.random() * .7,
               r: .45 + Math.random() * 1.2, vy: .07 + Math.random() * .18, ph: Math.random() * 6.28, sw: .3 + Math.random() * .6 };
    }
    function dot(x, y, r, a){
      var g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      g.addColorStop(0, 'rgba(255,240,210,' + a + ')'); g.addColorStop(.4, 'rgba(240,206,149,' + a * .6 + ')'); g.addColorStop(1, 'rgba(201,151,78,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, 6.283); ctx.fill();
    }
    function frame(t){
      if(!running) return;
      var dt = Math.min(48, t - (lastT || t)); lastT = t;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      if(emit && dust.length < target){                    // volviste a la portada: aparecen de a poco desde abajo
        spawnAcc += dt * target / 2600;
        while(spawnAcc >= 1 && dust.length < target){ dust.push(newDust(false)); spawnAcc--; }
      }
      gA += ((emit ? 1 : 0) - gA) * Math.min(1, dt / 380);
      if(!emit && gA < .02){ dust.length = 0; gA = 0; }       // bajaste: se terminaron de apagar
      ctx.globalAlpha = gA;
      for(var i = dust.length - 1; i >= 0; i--){
        var p = dust[i];
        p.y -= p.vy * dt * .06 * (1 + p.z); p.ph += dt * .0012;
        if(p.y < -10){ if(emit) dust[i] = newDust(false); else dust.splice(i, 1); continue; } // bajaste: terminan de subir y no salen nuevos
        var x = p.x + Math.sin(p.ph) * 8 * p.sw, y = p.y;
        var fade = Math.max(0, Math.min(1, (y / H - .08) / .62)); // se van apagando al subir entre los perfumes
        fade = fade * fade * (3 - 2 * fade);
        dot(x, y, p.r * (0.7 + p.z * .6), (.4 + .45 * Math.abs(Math.sin(p.ph * 1.2))) * (.45 + p.z * .55) * fade);
      }
      ctx.globalAlpha = 1;
      for(var k = mist.length - 1; k >= 0; k--){
        var m = mist[k]; m.life -= dt;
        if(m.life <= 0){ mist.splice(k, 1); continue; }
        m.vx *= .985; m.vy = m.vy * .985 - .0009 * dt; m.x += m.vx * dt; m.y += m.vy * dt;
        dot(m.x, m.y, m.r, Math.min(1, m.life / 500) * .75);
      }
      ctx.globalCompositeOperation = 'source-over';
      if(!emit && !dust.length && !mist.length){ running = false; ctx.clearRect(0, 0, W, H); return; } // ya no queda ninguno: se frena
      requestAnimationFrame(frame);
    }
    var ratio = 1;
    window.__xpDust = function(){ return { n: dust.length, running: running, emit: emit, first: dust[0] ? Math.round(dust[0].y) : null }; }; // para revisar
    function update(){
      emit = ratio >= .55 && !doc.hidden && hero.classList.contains('is-active');
      if(!visible){ dust.length = 0; mist.length = 0; spawnAcc = 0; } // la portada salió de la pantalla: al volver, aparecen de nuevo desde abajo
      var should = visible && !doc.hidden && hero.classList.contains('is-active') && (emit || dust.length || mist.length);
      if(should && !running){ running = true; lastT = 0; requestAnimationFrame(frame); }
      else if(!should){ running = false; }
    }
    resize();
    window.addEventListener('resize', function(){ clearTimeout(canvas._t); canvas._t = setTimeout(resize, 150); });
    doc.addEventListener('visibilitychange', update);
    if('IntersectionObserver' in window) new IntersectionObserver(function(en){ visible = en[0].isIntersecting; ratio = en[0].intersectionRatio; update(); }, { threshold:[0, .05, .3, .55, .8, 1] }).observe(hero);
    new MutationObserver(update).observe(hero, { attributes:true, attributeFilter:['class'] });
    update();
    // tocar la foto (no los botones) suelta un "rocío" dorado, como un spray de perfume
    hero.addEventListener('click', function(e){
      if(e.target.closest('a,button')) return;
      var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      for(var i = 0; i < 28; i++){
        var ang = -Math.PI / 2 + (Math.random() - .5) * 2.2, sp = .05 + Math.random() * .22;
        mist.push({ x:x, y:y, vx:Math.cos(ang) * sp, vy:Math.sin(ang) * sp, r:.6 + Math.random() * 1.6, life:600 + Math.random() * 900 });
      }
      update();
    });
  }

  /* ------------------------------------------------------------ 5) TÍTULOS ANIMADOS */
  function initTitles(){
    var rows = doc.querySelectorAll('#tendencias .section-title-row, #ofertas .section-title-row, #nuevos-ingresos .section-title-row');
    if(!rows.length) return;
    root.classList.add('xp-titles');
    Array.prototype.forEach.call(rows, function(row){
      var h2 = row.querySelector('h2');
      if(h2 && !h2.dataset.xpSplit){
        var text = h2.textContent.trim();
        h2.dataset.xpSplit = '1';
        h2.setAttribute('aria-label', text);
        h2.innerHTML = text.split('').map(function(ch, i){
          return '<span class="xp-ch" aria-hidden="true" style="--c:' + i + '">' + (ch === ' ' ? '&nbsp;' : ch) + '</span>';
        }).join('');
      }
      // Tendencias: anillo de luz + destellos con forma de estrella
      var STAR = '<svg viewBox="0 0 20 20"><path d="M10 0c.6 5 2.2 7.4 4.3 8.6C16 9.5 18 9.8 20 10c-2 .2-4 .5-5.7 1.4C12.2 12.6 10.6 15 10 20c-.6-5-2.2-7.4-4.3-8.6C4 10.5 2 10.2 0 10c2-.2 4-.5 5.7-1.4C7.8 7.4 9.4 5 10 0Z" fill="#f0ce95"/></svg>';
      Array.prototype.forEach.call(row.querySelectorAll('.icon-tendencias'), function(icon){
        var b = doc.createElement('span'); b.className = 'xp-burst'; b.setAttribute('aria-hidden', 'true');
        b.innerHTML = '<span class="xp-ring"></span>';
        for(var i = 0; i < 10; i++){
          var sh = doc.createElement('span'); sh.className = 'xp-shard'; sh.innerHTML = STAR;
          sh.style.setProperty('--a', (i * 36 + Math.random() * 18) + 'deg');
          sh.style.setProperty('--r', (22 + Math.random() * 18) + 'px');
          sh.style.setProperty('--s', (4 + Math.random() * 6).toFixed(1) + 'px');
          sh.style.setProperty('--d', Math.round(Math.random() * 90) + 'ms');
          b.appendChild(sh);
        }
        icon.appendChild(b);
      });
      // Nuevos ingresos: caja con dos solapas (lados opuestos) que se abren hacia afuera y un destello que sale de adentro
      Array.prototype.forEach.call(row.querySelectorAll('.icon-nuevos svg'), function(svg){
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.innerHTML =
          '<ellipse class="xp-glow" cx="12" cy="9" rx="7" ry="4" fill="#f0ce95" opacity="0" style="filter:blur(1.5px)"/>' +
          '<path d="M3 9v7.6c0 .5.3 1 .8 1.2L12 22l8.2-4.2c.5-.2.8-.7.8-1.2V9L12 13.2Z" fill="#fdfbf7" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
          '<path d="M12 13.2V22" stroke="currentColor" stroke-width="1.3"/>' +
          '<path d="M3 9l9-4.4L21 9l-9 4.2Z" fill="#efe4d0" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
          '<path class="xp-flap xp-flap-b" d="M7.5 6.8L12 4.6L21 9L16.5 11.1Z" fill="#fdfbf7" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>' +
          '<path class="xp-flap xp-flap-a" d="M3 9L7.5 6.8L16.5 11.1L12 13.2Z" fill="#fdfbf7" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>' +
          '<path class="xp-gift" d="M12 3.2c.3 2.3 1 3.4 2 4 .8.4 1.7.5 2.6.6-.9.1-1.8.3-2.6.7-1 .6-1.7 1.7-2 4-.3-2.3-1-3.4-2-4-.8-.4-1.7-.6-2.6-.7.9-.1 1.8-.2 2.6-.6 1-.6 1.7-1.7 2-4Z" fill="#c9974e"/>';
      });
      var lastPlay = 0;
      function play(){
        var now = Date.now(); if(now - lastPlay < 1900) return; lastPlay = now;
        row.classList.remove('xp-play'); void row.offsetWidth; row.classList.add('xp-play');
        clearTimeout(row._xpT); row._xpT = setTimeout(function(){ row.classList.remove('xp-play'); }, 1900);
      }
      row.addEventListener('mouseenter', function(){ if(row.classList.contains('xp-in')) play(); });
      row.addEventListener('click', play);
      row._xpPlay = play;
    });
    if(reduceMotion || !('IntersectionObserver' in window)){
      Array.prototype.forEach.call(rows, function(r){ r.classList.add('xp-in'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(!en.isIntersecting) return;
        var row = en.target; // se repite cada vez que el título vuelve a entrar en pantalla
        row.classList.add('xp-in');
        setTimeout(function(){ row._xpPlay && row._xpPlay(); }, 150);
      });
    }, { threshold:0.6 });
    Array.prototype.forEach.call(rows, function(r){ io.observe(r); });
  }

  onReady(function(){ initIntro(); initCarousel(); initReveal(); initHero(); initTitles(); });
})();
