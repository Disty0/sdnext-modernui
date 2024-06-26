// Original credits: <https://github.com/anapnoe/stable-diffusion-webui-ux/blob/8307896c59032a9cdac1ab24c975102ff9a674d3/extensions-builtin/anapnoe-sd-uiux/javascript/anapnoe_sd_uiux_core.js>

const template_path = './file=extensions-builtin/sdnext-modernui/html/templates/';
const template_root = 'template-app-root';
const uiux_app_id = '#sdnext_app';
const uiux_tab_id = '#tab_sdnext_uiux_core';

const split_instances = [];
let portalTotal = 0;
let appUiUx;
let isBackendDiffusers;

//= ====================== OVERRIDES =======================
window.getUICurrentTabContent = () => gradioApp().querySelector('.xtabs-item:not(.hidden) > .split');
window.getSettingsTabs = () => gradioApp().querySelectorAll('#layout-settings .tabitem');

//= ====================== READY STATES =======================
function functionWaitForFlag(checkFlag) {
  return async function () { // eslint-disable-line func-names
    return new Promise((resolve) => {
      const check = () => checkFlag() ? resolve() : setTimeout(check);
      check();
    });
  };
}

let uiFlagInitialized = false;
let uiFlagPortalInitialized = false;

window.waitForUiReady = functionWaitForFlag(() => uiFlagInitialized);
const waitForUiPortal = functionWaitForFlag(() => uiFlagPortalInitialized);

//= ====================== UTILS =======================
function logPrettyPrint() {
  let output = '';
  let arg;
  let i;
  output += `<div class="log-row"><span class="log-date">${new Date().toISOString().replace('T', ' ').replace('Z', '')}</span>`;

  for (i = 0; i < arguments.length; i++) {
    arg = arguments[i];
    if (arg === undefined) arg = 'undefined';
    if (arg === null) arg = 'null';
    const argstr = arg.toString().toLowerCase();
    let acolor = '';
    if (argstr.indexOf('error') !== -1) {
      acolor += ' log-remove';
    } else if (argstr.indexOf('loading') !== -1
      || argstr.indexOf('load') !== -1
      || argstr.indexOf('init') !== -1
      || argstr.indexOf('submit') !== -1
      || argstr.indexOf('success') !== -1) {
      acolor += ' log-load';
    } else if (argstr.indexOf('[') !== -1) {
      acolor += ' log-object';
    }
    if (arg.toString().indexOf('.css') !== -1 || arg.toString().indexOf('.html') !== -1) acolor += ' log-url';
    else if (arg.toString().indexOf('\n') !== -1) output += '<br />';
    output += `<span class="log-${(typeof arg)} ${acolor}">`;
    if (typeof arg === 'object') output += JSON.stringify(arg);
    else output += arg;
    output += ' </span>';
  }
  output += '</div>';
  return output;
}

//= ====================== MOBILE =======================
function applyDefaultLayout(isMobile) {
  appUiUx.querySelectorAll('[mobile]').forEach((tabItem) => {
    if (isMobile) {
      if (tabItem.childElementCount === 0) {
        const mobile_target = appUiUx.querySelector(tabItem.getAttribute('mobile'));
        if (mobile_target) {
          const target_parent_id = mobile_target.parentElement.id;
          if (target_parent_id) tabItem.setAttribute('mobile-restore', `#${target_parent_id}`);
          else log('UI missing id for parent', mobile_target.id);
          tabItem.append(mobile_target);
        }
      }
    } else if (tabItem.childElementCount > 0) {
      const mobile_restore_target = appUiUx.querySelector(tabItem.getAttribute('mobile-restore'));
      if (mobile_restore_target) {
        tabItem.removeAttribute('mobile-restore');
        mobile_restore_target.append(tabItem.firstElementChild);
      }
    }
  });

  if (isMobile) {
    //additional mobile actions
    appUiUx.querySelector('.accordion-vertical.expand #mask-icon-acc-arrow')?.click();
    if (!appUiUx.querySelector('.accordion-vertical.expand #mask-icon-acc-arrow-control')) {
      appUiUx.querySelector('.accordion-vertical #mask-icon-acc-arrow-control').click();
    }
    appUiUx.querySelector('#control_dynamic_input:not(:checked)')?.click();
    appUiUx.querySelector('#control_dynamic_control:not(:checked)')?.click();

    appUiUx.classList.add('media-mobile');
    appUiUx.classList.remove('media-desktop');
  } else {
    appUiUx.classList.add('media-desktop');
    appUiUx.classList.remove('media-mobile');
  }
}

function switchMobile() {
  function detectMobile() {
    return (window.innerWidth <= 768);
  }

  const optslayout = window.opts.uiux_default_layout;
  if (optslayout === 'Auto') {
    window.addEventListener('resize', () => applyDefaultLayout(detectMobile()));
    applyDefaultLayout(detectMobile());
  } else if (optslayout === 'Mobile') {
    applyDefaultLayout(true);
  } else if (optslayout === 'Desktop') {
    applyDefaultLayout(false);
  }
}

//= ====================== UIUX READY =======================
async function extraTweaks() {
  // System tab click second tab
  document.querySelectorAll('#system .tab-nav button')[1].click();

  // Control tab flex row
  async function adjustFlexDirection(flexContainer) {
    const childCount = flexContainer.childElementCount;
    const firstChildMinWidth = parseFloat(getComputedStyle(flexContainer.firstElementChild).minWidth);
    const gapWidth = parseFloat(getComputedStyle(flexContainer).gap);
    const minWidth = childCount * firstChildMinWidth + (childCount - 1) * gapWidth;
    const currentDirection = getComputedStyle(flexContainer).flexDirection;
    const currentWidth = flexContainer.clientWidth;
    if (currentWidth < minWidth && !flexContainer.classList.contains('flex-force-column')) flexContainer.classList.add('flex-force-column');
    else if (currentWidth >= minWidth && flexContainer.classList.contains('flex-force-column')) flexContainer.classList.remove('flex-force-column');
  }

  const controlColumns = document.getElementById('control-columns');
  adjustFlexDirection(controlColumns);
  new ResizeObserver(() => adjustFlexDirection(controlColumns)).observe(controlColumns);

  // Extra networks tab
  ['txt2img', 'img2img', 'control'].forEach((key) => {
    const buttonNav = document.getElementById(`${key}_nav`);
    const buttonEN = document.getElementById(`btn-en-layout-${key}`);
    buttonNav.addEventListener('click', () => {
      buttonEN.click();
    });
  });

  // Default tab
  const logoNav = document.getElementById('logo_nav');
  const txt2imgNav = document.getElementById('txt2img_nav');
  const controlNav = document.getElementById('control_nav');

  logoNav.addEventListener('click', () => {
    if (isBackendDiffusers) controlNav.click();
    else txt2imgNav.click();
  });
  logoNav.click();
}
extraTweaks = logFn(extraTweaks); // eslint-disable-line no-func-assign

async function uiuxOptionSettings() {
  // settings max output resolution
  function sdMaxOutputResolution(value) {
    gradioApp().querySelectorAll('[id$="2img_width"] input,[id$="2img_height"] input').forEach((elem) => { elem.max = value; });
  }
  gradioApp().querySelector('#setting_uiux_max_resolution_output').addEventListener('input', (e) => {
    let intvalue = parseInt(e.target.value);
    intvalue = Math.min(Math.max(intvalue, 512), 16384);
    sdMaxOutputResolution(intvalue);
  });
  sdMaxOutputResolution(window.opts.uiux_max_resolution_output);

  // settings input ranges
  function uiux_show_input_range_ticks(value, interactive) {
    if (value) {
      gradioApp().querySelectorAll("input[type='range']").forEach((elem) => {
        const spacing = (elem.step / (elem.max - elem.min)) * 100.0;
        const tsp = `max(3px, calc(${spacing}% - 1px))`;
        const fsp = `max(4px, calc(${spacing}% + 0px))`;
        const overlay = `repeating-linear-gradient(90deg, transparent, transparent ${tsp}, var(--sd-input-border-color) ${tsp}, var(--sd-input-border-color) ${fsp})`;
        elem.style.setProperty('--sd-slider-bg-overlay', overlay);
      });
    } else if (interactive) {
      gradioApp().querySelectorAll("input[type='range']").forEach((elem) => { elem.style.setProperty('--sd-slider-bg-overlay', 'transparent'); });
    }
  }
  gradioApp().querySelector('#setting_uiux_show_input_range_ticks input').addEventListener('click', (e) => {
    uiux_show_input_range_ticks(e.target.checked, true);
  });
  uiux_show_input_range_ticks(window.opts.uiux_show_input_range_ticks);

  // settings looks
  function setupUiUxSetting(settingId, className) {
    function updateUiUxClass(cn, value) {
      if (value) appUiUx.classList.add(cn);
      else appUiUx.classList.remove(cn);
    }
    gradioApp().querySelector(`#setting_${settingId} input`).addEventListener('click', (e) => updateUiUxClass(className, e.target.checked));
    updateUiUxClass(className, window.opts[settingId]);
  }

  setupUiUxSetting('uiux_hide_legacy', 'option-hide-legacy');
  setupUiUxSetting('uiux_no_slider_layout', 'option-no-slider-layout');
  setupUiUxSetting('uiux_show_labels_aside', 'option-aside-labels');
  setupUiUxSetting('uiux_show_labels_main', 'option-main-labels');
  setupUiUxSetting('uiux_show_labels_tabs', 'option-tab-labels');
  setupUiUxSetting('uiux_show_labels_control', 'option-control-labels');
  setupUiUxSetting('uiux_no_headers_params', 'option-hide-headers-params');
  setupUiUxSetting('uiux_show_outline_params', 'option-show-outline-params');

  // hide legacy and activate control tab
  log('hideLegacy', window.opts.uiux_hide_legacy);
  gradioApp().getElementById('tab_txt2img').style.display = window.opts.uiux_hide_legacy ? 'none' : 'block';
  gradioApp().getElementById('tab_img2img').style.display = window.opts.uiux_hide_legacy ? 'none' : 'block';
  gradioApp().getElementById('tab_control').style.display = window.opts.uiux_hide_legacy ? 'block' : 'none';

  // settings mobile scale
  function uiux_mobile_scale(value) {
    const viewport = document.head.querySelector('meta[name="viewport"]');
    viewport.setAttribute('content', `width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=${value}`);
  }
  gradioApp().querySelector('#setting_uiux_mobile_scale input[type=number]').addEventListener('change', (e) => uiux_mobile_scale(e.target.value));
  uiux_mobile_scale(window.opts.uiux_mobile_scale);
}

async function setupErrorObserver() {
  const console = appUiUx.querySelector('#logMonitorData');
  const consoleBtn = appUiUx.querySelector('#btn_console');
  if (console && consoleBtn) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          const secondTd = node.querySelector('td:nth-child(2)');
          if (secondTd && secondTd.textContent === 'ERROR') {
            const errorCountAttr = consoleBtn.getAttribute('error-count');
            const errorCount = errorCountAttr ? parseInt(errorCountAttr) : 0;
            consoleBtn.setAttribute('error-count', errorCount + 1);
          }
        });
      });
    });
    observer.observe(console, { childList: true });
    consoleBtn.addEventListener('click', () => consoleBtn.removeAttribute('error-count'));
  }
}

async function setupControlDynamicObservers() {
  const dynamicInput = document.getElementById('control_dynamic_input');
  const dynamicControl = document.getElementById('control_dynamic_control');

  const inputElems = document.querySelectorAll('#control-template-column-input, #control_params_mask');
  const controlElems = document.querySelectorAll('#control-template-column-preview, #control_params_elements');

  function setupDynamicListener(dynamic, elems) {
    function toggleDynamicElements(checked) {
      elems.forEach((elem) => {
        if (checked) {
          elem.classList.remove('hidden');
        } else {
          elem.classList.add('hidden');
        }
      });
    }

    dynamic.addEventListener('click', () => {
      toggleDynamicElements(dynamic.checked, elems);
    })
    toggleDynamicElements(false, elems);
  } 

  setupDynamicListener(dynamicInput, inputElems);
  setupDynamicListener(dynamicControl, controlElems);
}

async function setupGenerateObservers() {
  function addButtonIcon(button, iconClass) {
    const icon = document.createElement('div');
    icon.classList.add('mask-icon', iconClass);
    button.appendChild(icon);
  }

  function addButtonSpan(button, spanText) {
    const span = document.createElement('span');
    span.textContent = spanText;
    if (!spanText) span.style.display = 'none';
    button.appendChild(span);
  }

  function enableButtonAnimation(parentButton, enable) {
    if(enable) parentButton.classList.add('active');
    else parentButton.classList.remove('active');
  }

  const keys = ['#txt2img', '#img2img', '#extras', '#control'];
  keys.forEach((key) => {
    const loop = document.querySelector(`${key}_loop`);
    if (loop) loop.addEventListener('click', () => generateForever(`${key}_generate`));

    const tgb = document.querySelector(`${key}_generate`);
    if (tgb) {
      const tg = tgb.closest('.sd-button');

      new MutationObserver(() => {
        if (tgb.textContent && !tgb.querySelector('span')) {
          if (tgb.textContent === 'Generate') {
            enableButtonAnimation(tg, false)
            addButtonIcon(tgb, 'icon-generate');
          } else {
            enableButtonAnimation(tg, true)
          }
          addButtonSpan(tgb, tgb.textContent);
        }
      }).observe(tgb, { childList: true, subtree: true });
    }

    const teb = document.querySelector(`${key}_enqueue`);
    if (teb) {
      const te = teb.closest('.sd-button');

      new MutationObserver(() => {
        if (teb.textContent && !teb.querySelector('span')) {
          if (teb.textContent === 'Enqueue') {
            enableButtonAnimation(te, false)
            addButtonIcon(teb, 'icon-enqueue');
          } else {
            enableButtonAnimation(te, true)
          }
          addButtonSpan(teb, '');
        }
      }).observe(teb, { childList: true, subtree: true });
    }

    const tpb = document.querySelector(`${key}_pause`);
    if (tpb) {
      new MutationObserver(() => {
        if (tpb.textContent && !tpb.querySelector('span')) {
          if (tpb.textContent === 'Pause') {
            addButtonIcon(tpb, 'icon-pause');
          } else {
            addButtonIcon(tpb, 'icon-play');
          }
          addButtonSpan(tpb, '');
        }
      }).observe(tpb, { childList: true, subtree: true });
    }
  });
}

//= ====================== SETUP =======================
async function loadAllPortals() {
  appUiUx.querySelectorAll('.portal').forEach((elem, index, array) => {
    const onlyDiffusers = elem.classList.contains('only-diffusers');
    const onlyOriginal = elem.classList.contains('only-original');
    if ((onlyDiffusers && !isBackendDiffusers) || (onlyOriginal && isBackendDiffusers)) portalTotal += 1;
    else movePortal(elem, 1, index, array.length); // eslint-disable-line no-use-before-define
  });
}
loadAllPortals = logFn(loadAllPortals); // eslint-disable-line no-func-assign

function movePortal(portalElem, tries, index, length) {
  const MAX_TRIES = 3;
  const sp = portalElem.getAttribute('data-parent-selector');
  const s = portalElem.getAttribute('data-selector');
  const targetElem = document.querySelector(`${sp} ${s}`); // (tries % 2 == 0) ? document.querySelector(`${sp} ${s}`) : appUiUx.querySelector(`${s}`);
  if (portalElem && targetElem) {
    if (window.opts.uiux_enable_console_log) log('UI register', index, sp, s, tries);
    portalElem.append(targetElem);
    portalTotal += 1;
    const droppable = portalElem.getAttribute('droppable');
    if (droppable) {
      Array.from(portalElem.children).forEach((child) => {
        if (child !== targetElem) {
          if (targetElem.className.indexOf('gradio-accordion') !== -1) targetElem.children[2].append(child);
          else targetElem.append(child);
        }
      });
    }
    const showButton = portalElem.getAttribute('show-button');
    if (showButton) document.querySelector(showButton)?.classList.remove('hidden');
  } else if (tries < MAX_TRIES) {
    const timeout = portalElem.getAttribute('data-timeout');
    const delay = timeout ? parseInt(timeout) : 500;
    setTimeout(() => movePortal(portalElem, tries + 1, index, length), delay);
  } else {
    log('UI error not found', index, sp, s);
    if (window.opts.uiux_enable_console_log) portalElem.style.backgroundColor = 'pink';
    portalTotal += 1;
  }
  if (portalTotal === length) uiFlagPortalInitialized = true;
}

function initSplitComponents() {
  appUiUx.querySelectorAll('div.split').forEach((elem) => {
    const id = elem.id;
    const nid = appUiUx.querySelector(`#${id}`);
    const direction = nid?.getAttribute('direction') === 'vertical' ? 'vertical' : 'horizontal';
    const gutterSize = nid?.getAttribute('gutterSize') || '8';
    const ids = [];
    const initSizes = [];
    const minSizes = [];
    const containers = appUiUx.querySelectorAll(`#${id} > div.split-container`);
    containers.forEach(((c) => {
      const ji = c.getAttribute('data-initSize');
      const jm = c.getAttribute('data-minSize');
      ids.push(`#${c.id}`);
      initSizes.push(ji ? parseInt(ji) : 100 / containers.length);
      minSizes.push(jm ? parseInt(jm) : Infinity);
    }));
    if (window.opts.uiux_enable_console_log) log('UI split component', ids, initSizes, minSizes, direction, gutterSize);
    split_instances[id] = Split(ids, { // eslint-disable-line no-undef
      sizes: initSizes,
      minSize: minSizes,
      direction,
      gutterSize: parseInt(gutterSize),
      snapOffset: 0,
      dragInterval: 1,
      elementStyle(dimension, size, gs) {
        return { 'flex-basis': `calc(${size}% - ${gs}px)` };
      },
      gutterStyle(dimension, gs) {
        return {
          'flex-basis': `${gs}px`,
          'min-width': `${gs}px`,
          'min-height': `${gs}px`,
        };
      },
    });
  });
}

function initAccordionComponents() {
  appUiUx.querySelectorAll('.accordion-bar').forEach((elem) => {
    const acc = elem.parentElement;
    const accSplit = acc.closest('.split-container');
    const accTrigger = appUiUx.querySelector(acc.getAttribute('iconTrigger'));
    if (accTrigger) elem.classList.add('pointer-events-none');
    if (acc.className.indexOf('accordion-vertical') !== -1 && accSplit.className.indexOf('split') !== -1) {
      acc.classList.add('expand');
      const splitInstance = split_instances[accSplit.parentElement.id];
      accSplit.setAttribute('data-sizes', JSON.stringify(splitInstance.getSizes()));
      accTrigger?.addEventListener('click', () => {
        acc.classList.toggle('expand');
        if (accSplit.className.indexOf('v-expand') !== -1) {
          accSplit.classList.remove('v-expand');
          accSplit.style.removeProperty('min-width');
          splitInstance.setSizes(JSON.parse(accSplit.getAttribute('data-sizes')));
        } else {
          accSplit.classList.add('v-expand');
          const sizes = splitInstance.getSizes();
          accSplit.setAttribute('data-sizes', JSON.stringify(sizes));
          if (acc.className.indexOf('left') !== -1) {
            sizes[sizes.length - 1] = 100;
            sizes[sizes.length - 2] = 0;
          } else {
            sizes[sizes.length - 1] = 0;
            sizes[sizes.length - 2] = 100;
          }
          const padding = parseFloat(window.getComputedStyle(elem, null).getPropertyValue('padding-left')) * 2;
          accSplit.style.minWidth = `${elem.offsetWidth + padding}px`;
          splitInstance.setSizes(sizes);
        }
      });
    } else {
      accTrigger?.addEventListener('click', () => { acc.classList.toggle('expand'); });
    }

    const fullTrigger = acc.getAttribute('iconFullTrigger');
    if (fullTrigger) appUiUx.querySelector(fullTrigger)?.addEventListener('click', () => { acc.classList.toggle('full-expand');})
  });
}

function initTabComponents() {
  function callToAction(elem) {
    // Expand closest accordion
    const accBar = elem.closest('.accordion-bar');
    if (accBar) {
      const acc = accBar.parentElement;
      if (acc.className.indexOf('expand') === -1) {
        const accTrigger = appUiUx.querySelector(acc.getAttribute('iconTrigger'));
        if (accTrigger) accTrigger.click();
        else accBar.click();
      }
    }
  }

  function hideActive(tab) {
    tab.classList.remove('active');
    const tabItemId = tab.getAttribute('tabItemId');
    appUiUx.querySelectorAll(tabItemId).forEach((tabItem) => {
      tabItem.classList.remove('fade-in');
      tabItem.classList.add('fade-out');
    });
  }

  function showActive(tab) {
    tab.classList.add('active');
    const tabItemId = tab.getAttribute('tabItemId');
    appUiUx.querySelectorAll(tabItemId).forEach((tabItem) => {
      tabItem.classList.add('fade-in');
      tabItem.classList.remove('fade-out');
    });
  }

  appUiUx.querySelectorAll('.xtabs-tab').forEach((elem) => {
    elem.addEventListener('click', () => {
      const tabParent = elem.parentElement;
      const tabGroup = elem.getAttribute('tabGroup');

      if (tabGroup) {
        appUiUx.querySelectorAll(`[tabGroup="${tabGroup}"]`).forEach((tab) => {
          if (tab.className.indexOf('active') !== -1) hideActive(tab);
        });
      } else if (tabParent) {
        Array.from(tabParent.children).forEach((tab) => {
          if (tab.className.indexOf('active') !== -1) hideActive(tab);
        });
      }
      showActive(elem);
      callToAction(elem);
    });

    const active = elem.getAttribute('active');
    if (!active) hideActive(elem);
  });

  appUiUx.querySelectorAll('.xtabs-tab[active]').forEach((elem) => {
    showActive(elem);
    callToAction(elem);
  });

  function showHideAnchors(anchor, index) {
    Array.from(anchor.children).forEach((elem) => {
      if (elem.matches(`[anchor*="${index}"]`)) elem.style.display = 'flex';
      else elem.style.display = 'none';
    });
  }

  appUiUx.querySelectorAll('.xtabs-anchor').forEach((anchor) => {
    const tabNav = document.querySelector(anchor.getAttribute('anchorNav'));
    if (tabNav) {
      const observer = new MutationObserver(() => {
        const index = Array.from(tabNav.children).findIndex((btn) => btn.classList.contains('selected')) + 1;
        showHideAnchors(anchor, index);
      });
      observer.observe(tabNav, { attributes: true, attributeFilter: ['class'], childList: true });
    }
    showHideAnchors(anchor, 1);
  });
}

function initButtonComponents() {
  appUiUx.querySelectorAll('.sd-button').forEach((elem) => {
    const toggle = elem.getAttribute('toggle');
    const active = elem.getAttribute('active');
    const input = elem.querySelector('input');

    if (input) {
      if (input.checked === true && !active) input.click();
      else if (input.checked === false && active) input.click();
    }
    if (active) elem.classList.add('active');
    else elem.classList.remove('active');
    if (toggle) {
      elem.addEventListener('click', (e) => {
        const inputEl = elem.querySelector('input');
        if (inputEl) {
          inputEl.click();
          if (inputEl.checked === true) {
            elem.classList.add('active');
          } else if (inputEl.checked === false) {
            elem.classList.remove('active');
          }
        } else {
          elem.classList.toggle('active');
        }
      });
    }

    // Useful to switch tab after button click
    const extraClicks = elem.getAttribute('data-click');
    if (extraClicks) {
      elem.addEventListener('click', () => {
        document.querySelectorAll(extraClicks).forEach((el) => el.click());
      });
    }
  });
}

async function setupAnimationEventListeners() {
  const notransition = window.opts.uiux_disable_transitions;
  document.addEventListener('animationstart', (e) => {
    if (e.animationName === 'fade-in') {
      e.target.classList.remove('hidden');
    }
    if (notransition && e.animationName === 'fade-out') {
      e.target.classList.add('notransition');
      e.target.classList.add('hidden');
    }
  });
  document.addEventListener('animationend', (e) => {
    if (e.animationName === 'fade-out') {
      e.target.classList.add('hidden');
    }
  });
}

async function checkBackend() {
  if (window.opts.sd_backend === 'original') {
    appUiUx.classList.add('backend-original');
    isBackendDiffusers = false;
    window.opts["uiux_hide_legacy"] = false;
  } else if (window.opts.sd_backend === 'diffusers') {
    appUiUx.classList.add('backend-diffusers');
    isBackendDiffusers = true;
  }
}

async function createButtonsForExtensions() {
  const other_extensions = document.querySelector('#other_extensions');
  const other_views = document.querySelector('#split-left');
  const no_button_tabs = ['tab_txt2img', 'tab_img2img', 'tab_process', 'tab_control', 'tab_interrogate', 'tab_train', 'tab_models', 'tab_extensions', 'tab_system', 'tab_gallery', 'tab_sdnext_uiux_core'];
  const snakeToCamel = (str) => str.replace(/(_\w)/g, (match) => match[1].toUpperCase());
  document.querySelectorAll('#tabs > .tabitem').forEach((c) => {
    const cid = c.id;
    const nid = cid.split('tab_')[1];
    if (!no_button_tabs.includes(cid)) {
      const temp = document.createElement('div');
      temp.innerHTML = `
        <button 
          tabItemId="#split-app, #${cid}_tabitem" 
          tabGroup="main_group" 
          data-click="#tabs" 
          onclick="mainTabs(this, '#${cid}')" 
          class="xtabs-tab"
        >
          <div class="icon-letters">${nid.slice(0, 2)}</div>
          <span>${snakeToCamel(nid)}</span>
        </button>
      `;
      other_extensions.append(temp.firstElementChild);
      temp.innerHTML = `
        <div id="${cid}_tabitem" class="xtabs-item other">
          <div data-parent-selector="gradio-app" data-selector="#${cid} > div" class="portal"></div>
        </div>
      `;
      other_views.append(temp.firstElementChild);
    }
  });
}

//= ====================== TEMPLATES =======================
async function replaceRootTemplate() {
  appUiUx = document.querySelector(uiux_app_id);
  gradioApp().insertAdjacentElement('afterbegin', appUiUx);
}

function getNestedTemplates(container) {
  const nestedData = [];
  container.querySelectorAll('.template:not([status])').forEach((el) => {
    const template = el.getAttribute('template');
    const key = el.getAttribute('key');

    nestedData.push({
      template: template,
      key: key,
      target: el
    });
  });
  return nestedData;
}

async function loadCurrentTemplate(data) {
  const curr_data = data.shift();
  if (curr_data) {
    if (window.opts.uiux_enable_console_log) log('UI loading template', curr_data.template);
    const response = await fetch(`${template_path}${curr_data.template}.html`);

    if (!response.ok) {
      log('UI failed to load template', curr_data.template);
      curr_data.target.setAttribute('status', 'error');
    } else {
      const text = await response.text();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = curr_data.key ? text.replace(/\s*\{\{.*?\}\}\s*/g, curr_data.key) : text;
      const nestedData = getNestedTemplates(tempDiv);
      data.push(...nestedData);

      curr_data.target.setAttribute('status', 'true');
      curr_data.target.append(tempDiv.firstElementChild);
    }
    return loadCurrentTemplate(data);
  }
  return Promise.resolve();
}

async function loadAllTemplates() {
  const data = [
    {
      template: template_root,
      target: document.querySelector(uiux_tab_id),
    },
  ];
  await loadCurrentTemplate(data);
  await replaceRootTemplate();
}
loadAllTemplates = logFn(loadAllTemplates); // eslint-disable-line no-func-assign

//= ====================== INITIALIZATION =======================
async function removeStyleAssets() {
  // Remove specific stylesheets
  let removedStylesheets = 0;
  document.querySelectorAll(`
    [rel="stylesheet"][href*="/assets/"], 
    [rel="stylesheet"][href*="theme.css"],
    [rel="stylesheet"][href*="base.css"],
    [rel="stylesheet"][href*="file=style.css"]
  `).forEach((stylesheet) => {
    stylesheet.remove();
    removedStylesheets++;
    if (window.opts.uiux_enable_console_log) log('UI removed stylesheet', stylesheet.getAttribute('href'));
  });
  log('UI removeStyleSheets', removedStylesheets);

  // Remove inline styles and svelte classes
  const stylers = document.querySelectorAll('.styler, [class*="svelte"]:not(input)');
  let count = 0;
  let removedCount = 0;

  stylers.forEach((element) => {
    if (element.style.display !== 'none' && element.style.display !== 'block') {
      element.removeAttribute('style');
      removedCount++;
    }

    [...element.classList].filter((className) => className.match(/^svelte.*/)).forEach((svelteClass) => {
      element.classList.remove(svelteClass);
    });
    count++;
  });
  log('UI removeElements', `${removedCount}/${count}`);
}

function logStartup() {
  log('userAgent', navigator.userAgent);
  const filteredOpts = Object.entries(window.opts).filter(([key, value]) => key.startsWith('uiux') && typeof value !== 'string');
  const uiOpts = {};
  for (const [key, value] of filteredOpts) uiOpts[key] = value;
  log('UI settings', uiOpts);
  if (navigator.userAgent.toLowerCase().includes('firefox')) {
    log('UI: Go to the Firefox about:config page, then search and toggle layout. css.has-selector. enabled');
  }
}

async function setupLogger() {
  const logMonitorJS = document.createElement('div');
  logMonitorJS.id = 'logMonitorJS';
  document.body.append(logMonitorJS);
  window.logger = logMonitorJS;
}

//= ====================== MAIN ROUTINE =======================
async function mainUiUx() {
  logStartup();
  await removeStyleAssets();
  await loadAllTemplates();
  checkBackend();
  createButtonsForExtensions();
  setupAnimationEventListeners();
  initSplitComponents();
  initAccordionComponents();
  await loadAllPortals();
  initTabComponents();
  initButtonComponents();
  await waitForUiPortal();
  setupGenerateObservers();
  setupControlDynamicObservers();
  setupErrorObserver();
  uiuxOptionSettings();
  showContributors();
  switchMobile();
  extraTweaks();
  uiFlagInitialized = true;
}

mainUiUx = logFn(mainUiUx); // eslint-disable-line no-func-assign
onUiReady(mainUiUx);
