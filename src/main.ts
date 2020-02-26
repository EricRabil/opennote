import "mathquill/build/mathquill.css";
import "./polyfills";
import "d3/d3.js";
import Vue from 'vue';

const jQuery = require('jquery');
const $ = jQuery;
(window as any).$ = $;

const worker = require('./algebra.worker.ts');
(window as any).AlgebraWorker = new worker();

import App from './App.vue'
import './registerServiceWorker'
import router from './router'
import store from './store'
import _ from './util';

Vue.use(require('vue-resize-observer'));

Vue.config.productionTip = false;

window.MathQuill = MathQuill.getInterface(1);

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
