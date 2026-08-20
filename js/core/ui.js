/* Kleine DOM-Helfer, die jede View benutzt. */
(function () {
  "use strict";
  window.AO = window.AO || {};
  var F = AO.fmt;

  AO.ui = {
    q:  function (sel, root) { return (root || document).querySelector(sel); },
    qa: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },

    /* <option>-Liste fuellen */
    fill: function (sel, options, value) {
      sel.innerHTML = options.map(function (o) {
        var v = (o.v !== undefined) ? o.v : o;
        var n = (o.n !== undefined) ? o.n : o;
        return '<option value="' + F.esc(v) + '">' + F.esc(n) + '</option>';
      }).join('');
      if (value !== undefined) sel.value = value;
      return sel;
    },

    /* Segment-Umschalter erzeugen */
    seg: function (items, active, id) {
      return '<div class="seg"' + (id ? ' id="' + id + '"' : '') + '>' + items.map(function (i) {
        return '<button data-v="' + F.esc(i.v) + '"' +
          (i.title ? ' title="' + F.esc(i.title) + '"' : '') +
          (i.v === active ? ' class="on"' : '') + '>' + F.esc(i.n) + '</button>';
      }).join('') + '</div>';
    },

    /* aktiven Knopf eines Segments setzen */
    segSet: function (box, value) {
      AO.ui.qa('button', box).forEach(function (b) { b.classList.toggle('on', b.dataset.v === value); });
    },

    /* Kennzahl-Kachel */
    stat: function (label, value, sub, cls) {
      return '<div class="stat"><div class="k">' + F.esc(label) + '</div>' +
        '<div class="v' + (cls ? ' ' + cls : '') + '">' + value + '</div>' +
        (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';
    },

    /* Kurzmeldung unten rechts */
    toast: function (msg, kind) {
      var t = document.getElementById('toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        document.body.appendChild(t);
      }
      t.className = 'show ' + (kind || 'info');
      t.textContent = msg;
      clearTimeout(t._h);
      t._h = setTimeout(function () { t.className = ''; }, 2600);
    },

    /* Alterspunkt neben einem Preis */
    dot: function (d, where) {
      var a = F.age(d);
      return a
        ? '<span class="age ' + a.cls + '" title="Marktdaten ' + F.esc(where || '') + ' ' + a.txt + '"></span>'
        : '<span class="age none" title="Keine Marktdaten' + (where ? ' in ' + F.esc(where) : '') + '"></span>';
    },

    /* Hat der Nutzer gerade Text markiert?
       Beim Markieren und Kopieren feuert am Ende ein click-Ereignis. Zeilen,
       die auf Klick reagieren, wuerden dann ungewollt ausloesen - deshalb
       vorher fragen. */
    hasSelection: function () {
      var s = window.getSelection && window.getSelection();
      return !!(s && !s.isCollapsed && String(s).trim().length > 0);
    },

    /* Nur scrollen, wenn das Ziel gar nicht sichtbar ist */
    scrollIntoViewIfNeeded: function (node) {
      if (!node) return;
      var r = node.getBoundingClientRect();
      var h = window.innerHeight || document.documentElement.clientHeight;
      if (r.top >= 0 && r.bottom <= h) return;
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },

    /* Einen Neuaufbau ausfuehren, ohne den Tastaturfokus zu verlieren.
       Preisfelder liegen in Kaesten, die beim Neurechnen komplett neu gebaut
       werden - danach waere das Feld aus dem DOM verschwunden. */
    keepFocus: function (root, fn) {
      var a = document.activeElement, mark = null, sel = null;
      if (a && root.contains(a) && a.dataset && a.dataset.id) {
        mark = [a.dataset.id, a.dataset.city, a.dataset.q, a.dataset.side].join('|');
        try { sel = [a.selectionStart, a.selectionEnd]; } catch (e) {}
      }
      fn();
      if (!mark) return;
      var again = AO.ui.qa('input[data-id]', root).filter(function (n) {
        return [n.dataset.id, n.dataset.city, n.dataset.q, n.dataset.side].join('|') === mark;
      })[0];
      if (!again) return;
      again.focus();
      if (sel) { try { again.setSelectionRange(sel[0], sel[1]); } catch (e) {} }
    },

    /* Eigene Preise gelten im ganzen Toolkit. Traegt eine Ansicht einen
       Preis ein, muessen alle anderen nachziehen: die sichtbare sofort, die
       verborgenen beim naechsten Aufruf. Wuerden auch verborgene Ansichten
       bei jedem Tastenanschlag rechnen, waere die Eingabe zaeh. */
    onPrices: function (root, fn) {
      root._aoRefresh = fn;
      function frisch() { root._aoDirty = false; AO.ui.keepFocus(root, fn); }

      document.addEventListener('ao:prices', function () {
        if (!document.contains(root)) return;
        /* Verborgene Ansichten rechnen erst beim naechsten Aufruf nach -
           sonst rechnete bei jedem Tastenanschlag das ganze Toolkit mit. */
        if (root.hidden) { root._aoDirty = true; return; }
        /* Tippt jemand gerade in ein Preisfeld DIESER Ansicht, wird der
           Neuaufbau bis zum Verlassen des Feldes aufgeschoben: er wuerde das
           Feld mitten in der Eingabe ersetzen und die eingetippte Zahl auf
           den bereits gespeicherten Stand zuruecksetzen. Ihre eigenen Zahlen
           frischt jede Ansicht bei jedem Zeichen selbst auf. */
        var a = document.activeElement;
        if (a && a.classList && a.classList.contains('pinput') && root.contains(a)) {
          root._aoDirty = true; return;
        }
        frisch();
      });

      /* Das Aufgeschobene wird nachgeholt, sobald der Nutzer das Preisfeld
         verlaesst - und ersatzweise beim naechsten Klick oder Tastendruck
         ausserhalb eines Preisfeldes, falls der Browser kein focusout
         liefert (etwa weil das Fenster gar keinen Fokus hat). */
      function nachholen(e) {
        if (e.target.classList && e.target.classList.contains('pinput')) return;
        if (root._aoDirty && !root.hidden && document.contains(root)) frisch();
      }
      root.addEventListener('focusout', function (e) {
        if (!(e.target.classList && e.target.classList.contains('pinput'))) return;
        setTimeout(function () {
          if (root._aoDirty && !root.hidden && document.contains(root)) frisch();
        }, 0);
      });
      root.addEventListener('pointerdown', nachholen);
      root.addEventListener('keydown', nachholen);
    },

    /* --- Karten auf- und zuklappen --------------------------------------
       Die Ansichten sind mit der Zeit lang geworden: Rechnung, Vergleich,
       Uebersicht, Suche - alles untereinander. Karten mit data-fold
       bekommen deshalb einen Schalter im Kopf; der Zustand haelt sich je
       Ansicht. Zugeklappt bleibt die Karte im DOM, es wird nur nicht
       gezeichnet - so laufen die Rechnungen unveraendert weiter. */
    foldCards: function (root, viewId) {
      AO.ui.qa('.card[data-fold]', root).forEach(function (card) {
        var head = card.querySelector('.card-head');
        if (!head || head.querySelector('.fold')) return;
        var key = 'fold.' + viewId + '.' + card.dataset.fold;
        if (AO.store.get(key, card.dataset.foldDefault === 'zu')) card.classList.add('folded');

        var btn = document.createElement('button');
        btn.className = 'fold';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Karte auf- oder zuklappen');
        btn.innerHTML = '<span>\u25be</span>';
        btn.addEventListener('click', function () {
          var zu = card.classList.toggle('folded');
          AO.store.set(key, zu);
          btn.title = zu ? 'Aufklappen' : 'Zuklappen';
        });
        btn.title = card.classList.contains('folded') ? 'Aufklappen' : 'Zuklappen';

        var rechts = head.querySelector('.right');
        if (!rechts) {
          rechts = document.createElement('div');
          rechts.className = 'right';
          head.appendChild(rechts);
        }
        rechts.appendChild(btn);
      });
    },

    /* Debounce fuer Eingabefelder */
    debounce: function (fn, ms) {
      var h;
      return function () {
        var a = arguments, self = this;
        clearTimeout(h);
        h = setTimeout(function () { fn.apply(self, a); }, ms || 180);
      };
    }
  };
})();
