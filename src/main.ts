import "./polyfills";
import "mathquill/build/mathquill.js";
import "./mathquill-patches";
import Vue from 'vue';

import('./algebra.worker.ts' as any).then(worker => {
  (window as any).AlgebraWorker = new worker.default();
});

import App from './App.vue'
import './registerServiceWorker'
import router from './router'
import store from './store'
import _ from './util';

Vue.config.productionTip = false;

window.MathQuill = MathQuill.getInterface(1);

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
